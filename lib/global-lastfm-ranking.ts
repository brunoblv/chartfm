import type { TrackPlays } from "@/lib/lastfm";
import { fetchTracksBetweenUnix } from "@/lib/lastfm";
import { prisma } from "@/lib/prisma";
import {
  getPrimaryLimitedUntil,
  getSpotifyAlbumMetadataById,
  getSpotifyTrackMetadataById,
  searchSpotifyTracks,
} from "@/lib/spotify-server";
import { tryConsumeSpotifyBudget } from "@/lib/spotify-budget";
import { COVER_PALETTES } from "@/lib/data";
import { canonicalAlbumTitle, canonicalArtistName } from "@/lib/duplicate-utils";
import { brtDateKey, buildMyTrlScoringWindow, myTrlFetchWindow } from "@/lib/mytrl-chart-engine";

export const GLOBAL_AIRPLAY_PLAY_CAP = 10;
export const GLOBAL_ALBUMS_PLAY_CAP = 20;
export const GLOBAL_LASTFM_POINTS_MULTIPLIER = 10;
const MAX_TRACKS_PER_USER = 80;
const MAX_TRACKS_PER_USER_ALBUMS = 300;
const LASTFM_USER_CONCURRENCY = 4;
// Concorrência baixa de propósito: 10 buscas paralelas no /search eram gatilho de 429
// (rajada dentro da janela de 30s do Spotify). 2 mantém o throughput sem rajada.
const SPOTIFY_ENRICH_CONCURRENCY = 2;
/** Teto duro de /search por cálculo de ranking (álbuns sem match no DB). */
const MAX_SPOTIFY_SEARCHES_PER_RANKING = 40;

export type GlobalLastfmEntryStatus = "new" | "return" | "up" | "down" | "same";

export type GlobalLastfmEntry = {
  position: number;
  points: number;
  contributors: number;
  song: {
    id?: string | null;
    title: string;
    artist: string;
    album?: string | null;
    spotifyId?: string | null;
    albumSpotifyId?: string | null;
    artistSpotifyId?: string | null;
    imageUrl?: string | null;
  };
  cover: {
    palette: [string, string];
    seed: number;
    imageUrl?: string | null;
  };
  status: GlobalLastfmEntryStatus;
  delta: number | null;
  prevPos: number | null;
  peak: number;
  weeks: number;
  numberOnes: number;
};

export type GlobalLastfmMode = "airplay" | "albums";

type EnrichedTrack = {
  track: string;
  artist: string;
  album: string;
  spotifyId: string | null;
  albumSpotifyId: string | null;
  artistSpotifyId: string | null;
  imageUrl: string | null;
};

function brtDateKeyFromUnix(uts: number): string {
  return brtDateKey(new Date(uts * 1000));
}

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreTrackMatch(wantTitle: string, wantArtist: string, gotTitle: string, gotArtist: string): number {
  const wt = normalizeKey(wantTitle);
  const wa = normalizeKey(wantArtist.split(",")[0] ?? wantArtist);
  const ct = normalizeKey(gotTitle);
  const ca = normalizeKey(gotArtist.split(",")[0] ?? gotArtist);
  let s = 0;
  if (ct === wt) s += 100;
  else if (ct.includes(wt) || wt.includes(ct)) s += 58;
  if (ca === wa) s += 90;
  else if (ca.includes(wa) || wa.includes(ca)) s += 48;
  return Math.round(s);
}

function trackPlaysKey(track: string, artist: string): string {
  return `${normalizeKey(track)}|||${normalizeKey(artist)}`;
}

function countPlaysInWindow(dayPlays: TrackPlays["dayPlays"]): number {
  return dayPlays.reduce((sum, d) => sum + d.plays, 0);
}

/** Metadados do Last.fm — suficiente p/ pontuar airplay sem bater no Spotify. */
function enrichFromLastfm(tp: TrackPlays): EnrichedTrack {
  return {
    track: tp.track,
    artist: tp.artist,
    album: tp.album ?? "",
    spotifyId: null,
    albumSpotifyId: null,
    artistSpotifyId: null,
    imageUrl: null,
  };
}

async function lookupSongsInDb(
  chunk: Array<[string, TrackPlays]>,
  requireAlbumSpotifyId: boolean,
): Promise<Map<string, EnrichedTrack>> {
  const found = new Map<string, EnrichedTrack>();
  if (!chunk.length) return found;

  const rows = await prisma.song.findMany({
    where: {
      ...(requireAlbumSpotifyId ? { albumSpotifyId: { not: null } } : {}),
      OR: chunk.map(([, tp]) => ({
        AND: [
          { title: { equals: tp.track, mode: "insensitive" as const } },
          { artist: { equals: tp.artist, mode: "insensitive" as const } },
        ],
      })),
    },
    select: {
      title: true,
      artist: true,
      album: true,
      spotifyId: true,
      albumSpotifyId: true,
      artistSpotifyId: true,
      albumRef: { select: { spotifyId: true, coverUrl: true } },
    },
  });

  for (const s of rows) {
    const key = trackPlaysKey(s.title, s.artist);
    if (found.has(key)) continue;
    found.set(key, {
      track: s.title,
      artist: s.artist,
      album: s.album ?? "",
      spotifyId: s.spotifyId,
      albumSpotifyId: s.albumRef?.spotifyId ?? s.albumSpotifyId,
      artistSpotifyId: s.artistSpotifyId,
      imageUrl: s.albumRef?.coverUrl ?? null,
    });
  }
  return found;
}

const albumTypeCache = new Map<string, boolean>();

export async function isFullAlbumType(
  albumSpotifyId: string | null | undefined,
  skipSpotifyFallback = false,
): Promise<boolean> {
  const id = albumSpotifyId?.trim();
  if (!id) return false;
  if (albumTypeCache.has(id)) return albumTypeCache.get(id)!;

  const dbAlbum = await prisma.album.findUnique({
    where: { spotifyId: id },
    select: { albumType: true },
  });
  if (dbAlbum?.albumType) {
    const ok = dbAlbum.albumType === "ALBUM";
    albumTypeCache.set(id, ok);
    return ok;
  }

  const viaSong = await prisma.song.findFirst({
    where: { OR: [{ albumSpotifyId: id }, { albumRef: { spotifyId: id } }] },
    select: { albumRef: { select: { albumType: true } } },
  });
  if (viaSong?.albumRef?.albumType) {
    const ok = viaSong.albumRef.albumType === "ALBUM";
    albumTypeCache.set(id, ok);
    return ok;
  }

  if (skipSpotifyFallback) {
    // Sem dado local e sem consultar o Spotify: não descartar álbum já vinculado a faixas ouvidas.
    albumTypeCache.set(id, true);
    return true;
  }

  const meta = await getSpotifyAlbumMetadataById(id);
  if (!meta) {
    // Spotify indisponível no VPS: não descartar álbum já vinculado a faixas ouvidas.
    albumTypeCache.set(id, true);
    return true;
  }
  const ok = meta.albumType === "ALBUM";
  albumTypeCache.set(id, ok);
  return ok;
}

function albumCanonicalKey(album: string, artist: string): string {
  return `album_canonical:${canonicalAlbumTitle(album)}|||${canonicalArtistName(artist)}`;
}

function aggregationKey(mode: GlobalLastfmMode, meta: EnrichedTrack): string {
  if (mode === "albums") {
    const album = meta.album.trim() || meta.track.trim();
    return albumCanonicalKey(album, meta.artist);
  }
  if (meta.spotifyId) return `song_spotify:${meta.spotifyId}`;
  return `song_local:${normalizeKey(meta.track)}|||${normalizeKey(meta.artist)}`;
}

function mergeBucketMeta(existing: EnrichedTrack, incoming: EnrichedTrack): EnrichedTrack {
  if (!existing.albumSpotifyId && incoming.albumSpotifyId) return incoming;
  if (existing.albumSpotifyId && !incoming.albumSpotifyId) return existing;
  if (!existing.imageUrl && incoming.imageUrl) return { ...existing, imageUrl: incoming.imageUrl };
  return existing;
}

function coverFor(meta: EnrichedTrack, seed: number) {
  const palette = COVER_PALETTES[seed % COVER_PALETTES.length];
  return {
    palette: [palette[0], palette[1]] as [string, string],
    seed,
    imageUrl: meta.imageUrl,
  };
}

type ScoreBucket = {
  points: number;
  contributors: Set<string>;
  contributorPoints: Map<string, number>;
  meta: EnrichedTrack;
};

function entryKey(mode: GlobalLastfmMode, entry: GlobalLastfmEntry): string {
  if (mode === "albums") {
    const album = entry.song.album?.trim() || entry.song.title;
    return albumCanonicalKey(album, entry.song.artist);
  }
  if (entry.song.spotifyId) return `song_spotify:${entry.song.spotifyId}`;
  return `song_local:${normalizeKey(entry.song.title)}|||${normalizeKey(entry.song.artist)}`;
}

function buildMovementStats(
  mode: GlobalLastfmMode,
  ranked: Array<{ key: string; points: number; contributors: number; meta: EnrichedTrack }>,
  prevEntries: GlobalLastfmEntry[],
): GlobalLastfmEntry[] {
  const prevMap = new Map<string, GlobalLastfmEntry>();
  for (const e of prevEntries) prevMap.set(entryKey(mode, e), e);

  const histPeak = new Map<string, number>();
  const histWeeks = new Map<string, number>();
  const histOnes = new Map<string, number>();
  for (const e of prevEntries) {
    const k = entryKey(mode, e);
    histPeak.set(k, Math.min(histPeak.get(k) ?? 999, e.peak));
    histWeeks.set(k, (histWeeks.get(k) ?? 0) + 1);
    if (e.position === 1) histOnes.set(k, (histOnes.get(k) ?? 0) + 1);
  }

  return ranked.map((row, i) => {
    const position = i + 1;
    const prev = prevMap.get(row.key) ?? null;
    const prevPos = prev?.position ?? null;
    const everOnChart = prev != null || histPeak.has(row.key);

    let status: GlobalLastfmEntryStatus;
    let delta: number | null;
    let weeks: number;

    if (prevPos === null && !everOnChart) {
      status = "new";
      delta = null;
      weeks = 1;
    } else if (prevPos === null) {
      status = "return";
      delta = null;
      weeks = 1;
    } else if (position < prevPos) {
      status = "up";
      delta = prevPos - position;
      weeks = (prev?.weeks ?? 0) + 1;
    } else if (position > prevPos) {
      status = "down";
      delta = position - prevPos;
      weeks = (prev?.weeks ?? 0) + 1;
    } else {
      status = "same";
      delta = 0;
      weeks = (prev?.weeks ?? 0) + 1;
    }

    const peak = prev ? Math.min(position, prev.peak) : Math.min(position, histPeak.get(row.key) ?? position);
    const numberOnes = (histOnes.get(row.key) ?? 0) + (position === 1 ? 1 : 0);

    const title = row.meta.track;
    const artist = row.meta.artist;
    const displayTitle = row.meta.album && row.key.startsWith("album_") ? row.meta.album : title;

    return {
      position,
      points: row.points,
      contributors: row.contributors,
      song: {
        title: displayTitle,
        artist,
        album: row.meta.album,
        spotifyId: row.meta.spotifyId,
        albumSpotifyId: row.meta.albumSpotifyId,
        artistSpotifyId: row.meta.artistSpotifyId,
        imageUrl: row.meta.imageUrl,
      },
      cover: coverFor(row.meta, i),
      status,
      delta,
      prevPos,
      peak,
      weeks,
      numberOnes,
    };
  });
}

async function loadLastfmUsers(userIds?: string[]) {
  return prisma.user.findMany({
    where: {
      lastfmUser: { not: null },
      ...(userIds?.length ? { id: { in: userIds } } : {}),
    },
    select: { id: true, lastfmUser: true },
  });
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return out;
}

async function enrichTracksBatch(
  tracks: TrackPlays[],
  needAlbumMeta: boolean,
  skipSpotifyFallback = false,
): Promise<Map<string, EnrichedTrack | null>> {
  const unique = new Map<string, TrackPlays>();
  for (const tp of tracks) {
    const key = trackPlaysKey(tp.track, tp.artist);
    if (!unique.has(key)) unique.set(key, tp);
  }
  const entries = [...unique.entries()];
  const out = new Map<string, EnrichedTrack | null>();
  const DB_LOOKUP_CHUNK = 40;

  // Sempre DB-first (airplay e álbuns). Antes o airplay ia direto pro /search
  // por faixa única — milhares de chamadas e a maior fonte de 429 (2026-07-17).
  for (let c = 0; c < entries.length; c += DB_LOOKUP_CHUNK) {
    const chunk = entries.slice(c, c + DB_LOOKUP_CHUNK);
    const found = await lookupSongsInDb(chunk, needAlbumMeta);
    for (const [key, enriched] of found) {
      if (!out.has(key)) out.set(key, enriched);
    }
  }

  const needFallback: Array<[string, TrackPlays]> = [];
  for (const entry of entries) {
    if (!out.has(entry[0])) needFallback.push(entry);
  }

  // Airplay: metadados do Last.fm bastam p/ pontuar (song_local / song_spotify do DB).
  // Nunca /search aqui — era o caminho que estourava a cota.
  if (!needAlbumMeta) {
    for (const [key, tp] of needFallback) out.set(key, enrichFromLastfm(tp));
    return out;
  }

  if (skipSpotifyFallback || needFallback.length === 0) {
    for (const [key] of needFallback) out.set(key, null);
    return out;
  }

  // Álbuns sem match no DB: poucas buscas, com orçamento diário + abort se já em 429.
  const spotifyLimited = Date.now() < getPrimaryLimitedUntil();
  if (spotifyLimited) {
    console.warn(
      `[global-lastfm] Spotify limitado até ${new Date(getPrimaryLimitedUntil()).toISOString()} — pulando ${needFallback.length} buscas de álbum`,
    );
    for (const [key] of needFallback) out.set(key, null);
    return out;
  }

  const toSearch: Array<[string, TrackPlays]> = [];
  for (const entry of needFallback) {
    if (toSearch.length >= MAX_SPOTIFY_SEARCHES_PER_RANKING) break;
    if (!tryConsumeSpotifyBudget("lastfm")) break;
    toSearch.push(entry);
  }
  for (const [key] of needFallback.slice(toSearch.length)) out.set(key, null);

  if (toSearch.length < needFallback.length) {
    console.warn(
      `[global-lastfm] teto/orçamento Spotify: buscando ${toSearch.length}/${needFallback.length} faixas sem match no DB`,
    );
  }

  const matched = await mapPool(toSearch, SPOTIFY_ENRICH_CONCURRENCY, async ([key, tp]) => {
    const matches = await searchSpotifyTracks(`${tp.track} ${tp.artist}`, 8, "BR", undefined, {
      maxAttempts: 1,
    });
    let best: (typeof matches)[number] | null = null;
    let bestScore = -1;
    for (const m of matches) {
      const sc = scoreTrackMatch(tp.track, tp.artist, m.title, m.artist);
      if (sc > bestScore) {
        best = m;
        bestScore = sc;
      }
    }
    if (!best || bestScore < 120) return [key, null] as const;
    return [key, best.spotifyId, tp] as const;
  });

  const spotifyIds = matched
    .filter((m): m is [string, string, TrackPlays] => m[1] != null && typeof m[1] === "string")
    .map((m) => m[1]);

  const dbSongs = spotifyIds.length
    ? await prisma.song.findMany({
        where: { spotifyId: { in: spotifyIds } },
        select: {
          spotifyId: true,
          title: true,
          artist: true,
          album: true,
          artistSpotifyId: true,
          albumSpotifyId: true,
          albumRef: { select: { spotifyId: true, coverUrl: true } },
        },
      })
    : [];
  const dbBySpotifyId = new Map(dbSongs.map((s) => [s.spotifyId as string, s]));

  const metaQueue: Array<{ key: string; spotifyId: string }> = [];

  for (const item of matched) {
    const key = item[0];
    if (item[1] == null) {
      out.set(key, null);
      continue;
    }
    const spotifyId = item[1] as string;
    const db = dbBySpotifyId.get(spotifyId);
    if (db) {
      out.set(key, {
        track: db.title,
        artist: db.artist,
        album: db.album ?? "",
        spotifyId,
        albumSpotifyId: db.albumRef?.spotifyId ?? db.albumSpotifyId,
        artistSpotifyId: db.artistSpotifyId,
        imageUrl: db.albumRef?.coverUrl ?? null,
      });
    } else {
      metaQueue.push({ key, spotifyId });
    }
  }

  if (metaQueue.length) {
    const resolved = await mapPool(metaQueue, SPOTIFY_ENRICH_CONCURRENCY, async ({ key, spotifyId }) => {
      const meta = await getSpotifyTrackMetadataById(spotifyId);
      if (!meta) return [key, null] as const;
      return [
        key,
        {
          track: meta.title,
          artist: meta.artistDisplay,
          album: meta.album.title ?? "",
          spotifyId,
          albumSpotifyId: meta.album.spotifyId,
          artistSpotifyId: meta.primaryArtist?.spotifyId ?? null,
          imageUrl: meta.album.coverUrl,
        } satisfies EnrichedTrack,
      ] as const;
    });
    for (const [key, enriched] of resolved) out.set(key, enriched);
  }

  return out;
}

export async function computeGlobalLastfmRanking(
  mode: GlobalLastfmMode,
  referenceDate: Date = new Date(),
  prevEntries: GlobalLastfmEntry[] = [],
  options?: { userIds?: string[]; chartLimit?: number; skipSpotifyFallback?: boolean },
): Promise<{ entries: GlobalLastfmEntry[]; contributorCount: number; scoringWindow: string }> {
  const users = await loadLastfmUsers(options?.userIds);
  const { fromUnix, toUnix } = myTrlFetchWindow(referenceDate);
  const scoringWindow = buildMyTrlScoringWindow(brtDateKey(referenceDate));
  const playCap = mode === "airplay" ? GLOBAL_AIRPLAY_PLAY_CAP : GLOBAL_ALBUMS_PLAY_CAP;
  const globalScores = new Map<string, ScoreBucket>();

  type UserPlays = { userId: string; rows: Array<{ tp: TrackPlays; plays: number }> };

  const userPlaysList = (
    await mapPool(users, LASTFM_USER_CONCURRENCY, async (user): Promise<UserPlays | null> => {
      const username = user.lastfmUser?.trim();
      if (!username) return null;
      try {
        const rawPlays = await fetchTracksBetweenUnix(fromUnix, toUnix, username, brtDateKeyFromUnix);
        const rows = rawPlays
          .map((tp) => ({ tp, plays: countPlaysInWindow(tp.dayPlays) }))
          .filter((x) => x.plays > 0)
          .sort((a, b) => b.plays - a.plays)
          .slice(0, mode === "albums" ? MAX_TRACKS_PER_USER_ALBUMS : MAX_TRACKS_PER_USER);
        if (!rows.length) return null;
        return { userId: user.id, rows };
      } catch {
        return null;
      }
    })
  ).filter((x): x is UserPlays => x != null);

  const skipSpotifyFallback = options?.skipSpotifyFallback ?? false;
  const contributorCount = userPlaysList.length;
  const allTracks = userPlaysList.flatMap((u) => u.rows.map((r) => r.tp));
  const enrichMap = await enrichTracksBatch(allTracks, mode === "albums", skipSpotifyFallback);

  let allowedAlbumIds: Set<string> | null = null;
  if (mode === "albums") {
    const albumIds = [
      ...new Set(
        [...enrichMap.values()]
          .map((e) => e?.albumSpotifyId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const ok = await mapPool(albumIds, 12, async (id) =>
      (await isFullAlbumType(id, skipSpotifyFallback)) ? id : null,
    );
    allowedAlbumIds = new Set(ok.filter((id): id is string => id != null));
  }

  for (const { userId, rows } of userPlaysList) {
    if (mode === "airplay") {
      for (const { tp, plays } of rows) {
        const enriched = enrichMap.get(trackPlaysKey(tp.track, tp.artist));
        if (!enriched) continue;
        const aggKey = aggregationKey("airplay", enriched);
        const contribution = Math.min(plays, playCap) * GLOBAL_LASTFM_POINTS_MULTIPLIER;
        let bucket = globalScores.get(aggKey);
        if (!bucket) {
          bucket = {
            points: 0,
            contributors: new Set<string>(),
            contributorPoints: new Map<string, number>(),
            meta: enriched,
          };
          globalScores.set(aggKey, bucket);
        } else {
          bucket.meta = mergeBucketMeta(bucket.meta, enriched);
        }
        bucket.points += contribution;
        const isNewAirplay = !bucket.contributors.has(userId);
        bucket.contributors.add(userId);
        if (isNewAirplay) bucket.points += 10;
        bucket.contributorPoints.set(userId, (bucket.contributorPoints.get(userId) ?? 0) + contribution + (isNewAirplay ? 10 : 0));
      }
      continue;
    }

    const albumPlays = new Map<string, { plays: number; meta: EnrichedTrack }>();
    for (const { tp, plays } of rows) {
      const enriched = enrichMap.get(trackPlaysKey(tp.track, tp.artist));
      if (!enriched?.albumSpotifyId || !allowedAlbumIds?.has(enriched.albumSpotifyId)) continue;
      const aggKey = aggregationKey("albums", enriched);
      const cur = albumPlays.get(aggKey) ?? { plays: 0, meta: enriched };
      cur.plays += plays;
      cur.meta = mergeBucketMeta(cur.meta, enriched);
      albumPlays.set(aggKey, cur);
    }

    for (const [aggKey, { plays, meta }] of albumPlays) {
      const contribution = Math.min(plays, playCap) * GLOBAL_LASTFM_POINTS_MULTIPLIER;
      let bucket = globalScores.get(aggKey);
      if (!bucket) {
        bucket = {
          points: 0,
          contributors: new Set<string>(),
          contributorPoints: new Map<string, number>(),
          meta,
        };
        globalScores.set(aggKey, bucket);
      } else {
        bucket.meta = mergeBucketMeta(bucket.meta, meta);
      }
      bucket.points += contribution;
      const isNewAlbum = !bucket.contributors.has(userId);
      bucket.contributors.add(userId);
      if (isNewAlbum) bucket.points += 10;
      bucket.contributorPoints.set(userId, (bucket.contributorPoints.get(userId) ?? 0) + contribution + (isNewAlbum ? 10 : 0));
    }
  }

  const rankedWithBreakdown = [...globalScores.entries()]
    .map(([key, bucket]) => ({
      key,
      points: bucket.points,
      contributors: bucket.contributors.size,
      contributorPoints: bucket.contributorPoints,
      meta: bucket.meta,
    }))
    .sort((a, b) => b.points - a.points || b.contributors - a.contributors)
    .slice(0, options?.chartLimit ?? 100);

  const modeLabel = mode === "albums" ? "Álbuns" : "Airplay";
  console.log(`\n=== Global ${modeLabel} — breakdown por usuário (Top ${rankedWithBreakdown.length}) ===`);
  for (let i = 0; i < rankedWithBreakdown.length; i++) {
    const row = rankedWithBreakdown[i];
    const label = mode === "albums" ? (row.meta.album || row.meta.track) : row.meta.track;
    const contribs = [...row.contributorPoints.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([uid, pts]) => `${uid}=${pts}pts`)
      .join(" | ");
    console.log(`  #${String(i + 1).padStart(3, " ")}  ${label} — ${row.meta.artist}  [total: ${row.points}pts, ${row.contributors} ouvinte(s)]`);
    console.log(`         ${contribs}`);
  }
  console.log("");

  const ranked = rankedWithBreakdown.map(({ contributorPoints: _cp, ...rest }) => rest);
  const entries = buildMovementStats(mode, ranked, prevEntries);
  return { entries, contributorCount, scoringWindow };
}

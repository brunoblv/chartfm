/**
 * Preenche Spotify (track id, artist id, album id, URLs, etc.) em músicas sem spotify_id.
 *
 * Uso (na raiz do chartify):
 *   npx tsx scripts/backfill-song-spotify.ts
 *   npx tsx scripts/backfill-song-spotify.ts --dry-run
 *   npx tsx scripts/backfill-song-spotify.ts --limit=30
 *   npx tsx scripts/backfill-song-spotify.ts --offset=500 --limit=200
 *
 * Mercados e fallback (top tracks do artista) aumentam a taxa de match em K-pop/J-pop.
 *
 * Requer .env com SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET e DATABASE_URL.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import {
  getSpotifyArtistById,
  getSpotifyArtistTopTracks,
  getSpotifyTrackMetadataById,
  mapTrackToResult,
  searchSpotifyArtists,
  searchSpotifyTracks,
  spotifyConfigured,
  type SpotifyTrackMetadata,
} from "../lib/spotify-server";

function loadEnvFile() {
  const p = path.join(process.cwd(), ".env");
  if (!existsSync(p)) return;
  const txt = readFileSync(p, "utf8");
  for (const line of txt.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile();

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeQueryPart(s: string): string {
  return s.replace(/"/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
}

/** Remove sufixos entre parêntesis (ex.: versões, lixo de planilha). */
function stripParenSuffixes(title: string, maxRounds = 4): string {
  let s = title.trim();
  for (let i = 0; i < maxRounds; i++) {
    const m = s.match(/^(.+?)\s*\([^)]*\)\s*$/);
    if (m && m[1].trim().length >= 2) s = m[1].trim();
    else break;
  }
  return s.trim() || title.trim();
}

type TrackHit = { spotifyId: string; title: string; artist: string };

function tokenOverlapScore(a: string, b: string): number {
  const ta = new Set(a.split(" ").filter((w) => w.length > 1));
  const tb = new Set(b.split(" ").filter((w) => w.length > 1));
  if (!ta.size || !tb.size) return 0;
  let n = 0;
  for (const w of ta) if (tb.has(w)) n += 1;
  return Math.round((n / Math.max(ta.size, tb.size)) * 50);
}

function scoreTrackMatch(wantTitle: string, wantArtist: string, h: TrackHit): number {
  const wt = normalizeKey(wantTitle);
  const waRaw = normalizeKey(wantArtist.split(",")[0] ?? wantArtist);
  const wa = waRaw.split(" feat ")[0] ?? waRaw;
  const ct = normalizeKey(h.title);
  const ca = normalizeKey(h.artist.split(",")[0] ?? h.artist);
  let s = 0;
  if (ct === wt) s += 100;
  else if (ct.includes(wt) || wt.includes(ct)) s += 58;
  else s += tokenOverlapScore(wt, ct);
  if (ca === wa) s += 90;
  else if (ca.includes(wa) || wa.includes(ca)) s += 48;
  else s += tokenOverlapScore(wa, ca) * 0.6;
  return Math.round(s);
}

function pickBestTrackId(wantTitle: string, wantArtist: string, hits: TrackHit[]): string | null {
  if (!hits.length) return null;
  let bestId: string | null = null;
  let bestScore = -1;
  for (const h of hits) {
    const sc = scoreTrackMatch(wantTitle, wantArtist, h);
    if (sc > bestScore) {
      bestScore = sc;
      bestId = h.spotifyId;
    }
  }
  if (bestScore >= 35) return bestId;
  if (bestScore >= 28 && hits.length <= 8) return bestId;
  if (bestScore >= 26 && hits.length === 1) return bestId;
  return null;
}

function mainArtistFrom(artist: string): string {
  return (
    artist
      .split(",")[0]
      ?.trim()
      .split(/\s+feat\.?\s+/i)[0]
      ?.trim()
      .split(/\s+&\s+/)[0]
      ?.trim() ?? artist
  );
}

function buildTrackQueries(title: string, mainArtist: string, fullArtist: string): string[] {
  const t0 = sanitizeQueryPart(title);
  const t1 = sanitizeQueryPart(stripParenSuffixes(title));
  const ma = sanitizeQueryPart(mainArtist);
  const fa = sanitizeQueryPart(fullArtist);
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (q: string) => {
    if (q.length < 3) return;
    if (seen.has(q)) return;
    seen.add(q);
    out.push(q);
  };
  if (t0 && ma) {
    push(`track:"${t0}" artist:"${ma}"`);
    push(`${t0} ${ma}`);
    if (fa && fa !== ma) push(`${t0} ${fa}`);
  }
  if (t1 && ma && t1 !== t0) {
    push(`track:"${t1}" artist:"${ma}"`);
    push(`${t1} ${ma}`);
  }
  return out;
}

async function mergeSearchHits(
  title: string,
  artist: string,
  markets: string[],
  perQueryLimit: number,
  delayMs: number,
): Promise<TrackHit[]> {
  const main = mainArtistFrom(artist);
  const queries = buildTrackQueries(title, main, artist);
  const byId = new Map<string, TrackHit>();
  for (const market of markets) {
    for (const q of queries) {
      const batch = await searchSpotifyTracks(q, perQueryLimit, market);
      for (const h of batch) {
        if (!byId.has(h.spotifyId)) byId.set(h.spotifyId, h);
      }
      await sleep(delayMs);
    }
  }
  return [...byId.values()];
}

async function mergeTopTrackHits(
  artist: string,
  markets: string[],
  artistSearchLimit: number,
  delayMs: number,
): Promise<TrackHit[]> {
  const main = mainArtistFrom(artist);
  const byId = new Map<string, TrackHit>();
  for (const market of markets) {
    const profiles = await searchSpotifyArtists(main, artistSearchLimit, market);
    await sleep(delayMs);
    for (const ar of profiles) {
      const tops = await getSpotifyArtistTopTracks(ar.spotifyId, market);
      await sleep(delayMs);
      for (const t of tops) {
        const row = mapTrackToResult(t);
        const h: TrackHit = { spotifyId: row.spotifyId, title: row.title, artist: row.artist };
        if (!byId.has(h.spotifyId)) byId.set(h.spotifyId, h);
      }
    }
  }
  return [...byId.values()];
}

async function searchTrackCandidates(title: string, artist: string, markets: string[]) {
  const delay = 45;
  const searchHits = await mergeSearchHits(title, artist, markets, 15, delay);
  let merged = [...searchHits];
  const bestIdEarly = pickBestTrackId(title, artist, merged);
  const hitEarly = bestIdEarly ? merged.find((h) => h.spotifyId === bestIdEarly) : undefined;
  const earlyScore = hitEarly ? scoreTrackMatch(title, artist, hitEarly) : 0;
  if (!bestIdEarly || earlyScore < 42) {
    const extra = await mergeTopTrackHits(artist, markets.slice(0, 4), 5, delay);
    const map = new Map<string, TrackHit>();
    for (const h of merged) map.set(h.spotifyId, h);
    for (const h of extra) map.set(h.spotifyId, h);
    merged = [...map.values()];
  }
  const metaMarket = markets[0] ?? "US";
  return { hits: merged, market: metaMarket } as const;
}

async function applyMetadata(localSongId: string, meta: SpotifyTrackMetadata, dryRun: boolean) {
  const primaryArtist = meta.primaryArtist;
  const albumSpotifyId = meta.album.spotifyId;

  const owner = await prisma.song.findUnique({
    where: { id: localSongId },
    select: { id: true, title: true, artist: true, album: true },
  });
  if (!owner) return { ok: false as const, reason: "song_missing" };

  const taken = await prisma.song.findFirst({
    where: { spotifyId: meta.spotifyId, NOT: { id: localSongId } },
    select: { id: true },
  });
  if (taken) return { ok: false as const, reason: `spotify_id_conflict:${taken.id}` };

  if (dryRun) return { ok: true as const, reason: "dry_run" };

  async function upsertArtist(spotifyId: string, fallbackName: string) {
    const profile = await getSpotifyArtistById(spotifyId);
    await prisma.artist.upsert({
      where: { spotifyId },
      update: {
        name: profile?.name ?? fallbackName,
        genres: profile?.genres ?? [],
        spotifyUrl: profile?.spotifyUrl ?? undefined,
        ...(profile?.imageUrl ? { imageUrl: profile.imageUrl } : {}),
      },
      create: {
        spotifyId,
        name: profile?.name ?? fallbackName,
        genres: profile?.genres ?? [],
        spotifyUrl: profile?.spotifyUrl ?? null,
        imageUrl: profile?.imageUrl ?? null,
      },
    });
  }

  if (primaryArtist) await upsertArtist(primaryArtist.spotifyId, primaryArtist.name);

  if (primaryArtist && albumSpotifyId) {
    await prisma.album.upsert({
      where: { spotifyId: albumSpotifyId },
      update: {
        title: meta.album.title ?? undefined,
        artistSpotifyId: primaryArtist.spotifyId,
        albumType: meta.album.albumType ?? undefined,
        releaseDate: meta.album.releaseDate ?? undefined,
        coverUrl: meta.album.coverUrl ?? undefined,
        spotifyUrl: meta.album.spotifyUrl ?? undefined,
        totalTracks: meta.album.totalTracks ?? undefined,
      },
      create: {
        spotifyId: albumSpotifyId,
        title: meta.album.title ?? "Álbum",
        artistSpotifyId: primaryArtist.spotifyId,
        albumType: meta.album.albumType ?? undefined,
        releaseDate: meta.album.releaseDate ?? null,
        coverUrl: meta.album.coverUrl ?? null,
        spotifyUrl: meta.album.spotifyUrl ?? null,
        totalTracks: meta.album.totalTracks ?? null,
      },
    });
  }

  await prisma.song.update({
    where: { id: localSongId },
    data: {
      spotifyId: meta.spotifyId,
      artistSpotifyId: primaryArtist?.spotifyId ?? null,
      albumSpotifyId: albumSpotifyId ?? null,
      album: owner.album ?? meta.album.title ?? undefined,
      durationMs: meta.durationMs ?? undefined,
      previewUrl: meta.previewUrl ?? undefined,
      spotifyUrl: meta.spotifyUrl ?? undefined,
      trackNumber: meta.trackNumber ?? undefined,
    },
  });

  await prisma.chartEntry.updateMany({
    where: { songId: localSongId },
    data: {
      songSpotifyId: meta.spotifyId,
      albumSpotifyId: albumSpotifyId ?? null,
    },
  });

  if (meta.spotifyId) {
    const featured = meta.featuredArtists ?? [];
    const featIds = new Set<string>();
    for (const feat of featured) {
      featIds.add(feat.spotifyId);
      await upsertArtist(feat.spotifyId, feat.name);
      await prisma.songFeat.upsert({
        where: {
          songSpotifyId_artistSpotifyId: {
            songSpotifyId: meta.spotifyId,
            artistSpotifyId: feat.spotifyId,
          },
        },
        update: {},
        create: {
          songSpotifyId: meta.spotifyId,
          artistSpotifyId: feat.spotifyId,
        },
      });
    }
    await prisma.songFeat.deleteMany({
      where: {
        songSpotifyId: meta.spotifyId,
        ...(featIds.size ? { artistSpotifyId: { notIn: [...featIds] } } : {}),
      },
    });
  }

  return { ok: true as const, reason: "updated" };
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const limitArg = argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Math.max(1, parseInt(limitArg.split("=")[1] ?? "50", 10) || 50) : 2000;
  const offsetArg = argv.find((a) => a.startsWith("--offset="));
  const offset = offsetArg ? Math.max(0, parseInt(offsetArg.split("=")[1] ?? "0", 10) || 0) : 0;

  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  const songs = await prisma.song.findMany({
    where: { spotifyId: null },
    select: { id: true, title: true, artist: true, album: true },
    orderBy: { id: "asc" },
    skip: offset,
    take: limit,
  });

  console.log(`candidatas=${songs.length} offset=${offset} dry_run=${dryRun}`);
  let ok = 0;
  let skip = 0;
  let fail = 0;

  const markets = ["US", "JP", "KR", "BR", "GB"];

  for (const s of songs) {
    const { hits, market } = await searchTrackCandidates(s.title, s.artist, markets);
    const trackId = pickBestTrackId(s.title, s.artist, hits);
    if (!trackId) {
      console.log(`SKIP no_hit "${s.title}" — ${s.artist}`);
      skip += 1;
      await sleep(80);
      continue;
    }

    const meta = await getSpotifyTrackMetadataById(trackId, market);
    if (!meta) {
      console.log(`SKIP no_meta ${trackId} "${s.title}"`);
      skip += 1;
      await sleep(80);
      continue;
    }

    const res = await applyMetadata(s.id, meta, dryRun);
    if (!res.ok) {
      console.log(`FAIL "${s.title}" — ${s.artist} :: ${"reason" in res ? res.reason : ""}`);
      fail += 1;
    } else if (res.reason === "dry_run") {
      console.log(`DRY  "${s.title}" — ${s.artist} -> ${meta.spotifyId} (${meta.title})`);
      ok += 1;
    } else {
      console.log(`OK   "${s.title}" — ${s.artist} -> ${meta.spotifyId}`);
      ok += 1;
    }
    await sleep(100);
  }

  console.log(JSON.stringify({ ok, skip, fail, dryRun }));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

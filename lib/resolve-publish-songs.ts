import type { Prisma, PrismaClient } from "@prisma/client";
import {
  getSpotifyTrackMetadataById,
  getSpotifyTracksMetadataByIds,
  isSpotifyTrackId,
  searchSpotifyTracks,
  type SpotifyTrackMetadata,
} from "@/lib/spotify-server";

export type PublishEntryInput = {
  title: string;
  artist: string;
  album?: string | null;
  imageUrl?: string | null;
  spotifyId?: string | null;
  songId?: string | null;
};

export type ResolvedPublishSong = {
  id: string;
  spotifyId: string | null;
  albumSpotifyId: string | null;
};

type Db = PrismaClient | Prisma.TransactionClient;

const SONG_SELECT = { id: true, spotifyId: true, albumSpotifyId: true } as const;

function textMatchKey(title: string, artist: string): string {
  const primaryArtist = (artist.split(",")[0] ?? artist).trim().toLowerCase();
  return `${title.trim().toLowerCase()}|||${primaryArtist}`;
}

/** Resolve músicas para publicação rápida — só banco, sem chamadas ao Spotify. */
export async function resolveSongsForFastPublish(
  db: Db,
  entries: PublishEntryInput[],
): Promise<ResolvedPublishSong[]> {
  const results: (ResolvedPublishSong | null)[] = new Array(entries.length).fill(null);

  const songIds = [
    ...new Set(
      entries
        .map((e) => e.songId?.trim() || null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const byId = new Map<string, ResolvedPublishSong>();
  if (songIds.length > 0) {
    const rows = await db.song.findMany({ where: { id: { in: songIds } }, select: SONG_SELECT });
    for (const row of rows) {
      byId.set(row.id, {
        id: row.id,
        spotifyId: row.spotifyId ?? null,
        albumSpotifyId: row.albumSpotifyId ?? null,
      });
    }
  }

  for (let i = 0; i < entries.length; i++) {
    const songId = entries[i].songId?.trim();
    if (songId && byId.has(songId)) {
      results[i] = byId.get(songId)!;
    }
  }

  const spotifyIdsNeeded = new Set<string>();
  for (let i = 0; i < entries.length; i++) {
    if (results[i]) continue;
    const sid = entries[i].spotifyId?.trim();
    if (sid) spotifyIdsNeeded.add(sid);
  }

  const bySpotifyId = new Map<string, ResolvedPublishSong>();
  if (spotifyIdsNeeded.size > 0) {
    const rows = await db.song.findMany({
      where: { spotifyId: { in: [...spotifyIdsNeeded] } },
      select: SONG_SELECT,
    });
    for (const row of rows) {
      if (row.spotifyId) {
        bySpotifyId.set(row.spotifyId, {
          id: row.id,
          spotifyId: row.spotifyId,
          albumSpotifyId: row.albumSpotifyId ?? null,
        });
      }
    }
  }

  for (let i = 0; i < entries.length; i++) {
    if (results[i]) continue;
    const sid = entries[i].spotifyId?.trim();
    if (sid && bySpotifyId.has(sid)) {
      results[i] = bySpotifyId.get(sid)!;
    }
  }

  const needText: number[] = [];
  for (let i = 0; i < entries.length; i++) {
    if (!results[i]) needText.push(i);
  }

  if (needText.length > 0) {
    const titles = [...new Set(needText.map((i) => entries[i].title.trim()))];
    const textRows = await db.song.findMany({
      where: { title: { in: titles, mode: "insensitive" } },
      select: {
        id: true,
        title: true,
        artist: true,
        spotifyId: true,
        albumSpotifyId: true,
      },
    });
    const byTextKey = new Map<string, ResolvedPublishSong>();
    for (const row of textRows) {
      const key = textMatchKey(row.title, row.artist);
      if (!byTextKey.has(key)) {
        byTextKey.set(key, {
          id: row.id,
          spotifyId: row.spotifyId ?? null,
          albumSpotifyId: row.albumSpotifyId ?? null,
        });
      }
    }
    for (const i of needText) {
      const e = entries[i];
      const key = textMatchKey(e.title, e.artist);
      if (!byTextKey.has(key)) continue;

      const resolved = byTextKey.get(key)!;
      const sid = e.spotifyId?.trim();
      if (sid && isSpotifyTrackId(sid) && resolved.spotifyId !== sid) {
        const taken = await db.song.findFirst({
          where: { spotifyId: sid, NOT: { id: resolved.id } },
          select: { id: true },
        });
        if (!taken && (!resolved.spotifyId || !isSpotifyTrackId(resolved.spotifyId))) {
          const song = await db.song.update({
            where: { id: resolved.id },
            data: {
              spotifyId: sid,
              ...(e.album ? { album: e.album } : {}),
            },
            select: SONG_SELECT,
          });
          results[i] = {
            id: song.id,
            spotifyId: song.spotifyId ?? null,
            albumSpotifyId: song.albumSpotifyId ?? null,
          };
          continue;
        }
      }
      results[i] = resolved;
    }
  }

  for (let i = 0; i < entries.length; i++) {
    if (results[i]) continue;
    const e = entries[i];
    const sid = e.spotifyId?.trim() || null;

    if (sid) {
      const primaryArtist = (e.artist.split(",")[0] ?? e.artist).trim();
      const existingByName = await db.song.findFirst({
        where: {
          title: { equals: e.title, mode: "insensitive" },
          artist: { equals: primaryArtist, mode: "insensitive" },
        },
        select: SONG_SELECT,
      });
      if (existingByName) {
        const song = await db.song.update({
          where: { id: existingByName.id },
          data: {
            ...(existingByName.spotifyId == null ? { spotifyId: sid } : {}),
            ...(e.album ? { album: e.album } : {}),
          },
          select: SONG_SELECT,
        });
        results[i] = {
          id: song.id,
          spotifyId: song.spotifyId ?? null,
          albumSpotifyId: song.albumSpotifyId ?? null,
        };
        continue;
      }

      const song = await db.song.upsert({
        where: { spotifyId: sid },
        update: {
          title: e.title,
          artist: e.artist,
          ...(e.album ? { album: e.album } : {}),
        },
        create: {
          title: e.title,
          artist: e.artist,
          album: e.album ?? null,
          spotifyId: sid,
        },
        select: SONG_SELECT,
      });
      results[i] = {
        id: song.id,
        spotifyId: song.spotifyId ?? null,
        albumSpotifyId: song.albumSpotifyId ?? null,
      };
      continue;
    }

    const primaryArtist = (e.artist.split(",")[0] ?? e.artist).trim();
    const existingByName = await db.song.findFirst({
      where: {
        title: { equals: e.title, mode: "insensitive" },
        artist: { equals: primaryArtist, mode: "insensitive" },
      },
      select: SONG_SELECT,
    });
    if (existingByName) {
      results[i] = {
        id: existingByName.id,
        spotifyId: existingByName.spotifyId ?? null,
        albumSpotifyId: existingByName.albumSpotifyId ?? null,
      };
      continue;
    }

    const song = await db.song.create({
      data: {
        title: e.title,
        artist: e.artist,
        album: e.album ?? null,
      },
      select: SONG_SELECT,
    });
    results[i] = {
      id: song.id,
      spotifyId: song.spotifyId ?? null,
      albumSpotifyId: song.albumSpotifyId ?? null,
    };
  }

  return results as ResolvedPublishSong[];
}

/** Garante FKs válidas ao gravar `ChartEntry.songSpotifyId` / `albumSpotifyId`. */
export async function sanitizeChartEntrySpotifyRefs(
  db: Db,
  songs: ResolvedPublishSong[],
): Promise<Array<{ songSpotifyId: string | null; albumSpotifyId: string | null }>> {
  if (songs.length === 0) return [];

  const albumIds = [...new Set(songs.map((s) => s.albumSpotifyId).filter((id): id is string => Boolean(id)))];
  const songSpotifyIds = [...new Set(songs.map((s) => s.spotifyId).filter((id): id is string => Boolean(id)))];

  const [albumRows, songSpotifyRows] = await Promise.all([
    albumIds.length > 0
      ? db.album.findMany({ where: { spotifyId: { in: albumIds } }, select: { spotifyId: true } })
      : Promise.resolve([] as { spotifyId: string }[]),
    songSpotifyIds.length > 0
      ? db.song.findMany({ where: { spotifyId: { in: songSpotifyIds } }, select: { spotifyId: true } })
      : Promise.resolve([] as { spotifyId: string | null }[]),
  ]);

  const validAlbums = new Set(albumRows.map((r) => r.spotifyId));
  const validSongSpotifyIds = new Set(
    songSpotifyRows.map((r) => r.spotifyId).filter((id): id is string => Boolean(id)),
  );

  return songs.map((s) => ({
    songSpotifyId: s.spotifyId && validSongSpotifyIds.has(s.spotifyId) ? s.spotifyId : null,
    albumSpotifyId:
      s.albumSpotifyId && validAlbums.has(s.albumSpotifyId) ? s.albumSpotifyId : null,
  }));
}

const SONG_ENRICH_SELECT = {
  id: true,
  title: true,
  artist: true,
  spotifyId: true,
  albumSpotifyId: true,
  albumRef: { select: { coverUrl: true } },
} as const;

function normalizeMatchKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function primaryArtistName(artist: string): string {
  return (artist.split(",")[0] ?? artist).split(" feat ")[0]?.trim() || artist.trim();
}

function titleSearchVariants(title: string): string[] {
  const stripped = title.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  return [...new Set([title.trim(), stripped].filter(Boolean))];
}

function tokenOverlapScore(a: string, b: string): number {
  const ta = new Set(normalizeMatchKey(a).split(" ").filter((w) => w.length > 1));
  const tb = new Set(normalizeMatchKey(b).split(" ").filter((w) => w.length > 1));
  if (!ta.size || !tb.size) return 0;
  let n = 0;
  for (const w of ta) if (tb.has(w)) n += 1;
  return Math.round((n / Math.max(ta.size, tb.size)) * 50);
}

function scoreSearchMatch(wantTitle: string, wantArtist: string, gotTitle: string, gotArtist: string): number {
  const wt = normalizeMatchKey(wantTitle);
  const wa = normalizeMatchKey(primaryArtistName(wantArtist));
  const gt = normalizeMatchKey(gotTitle);
  const ga = normalizeMatchKey(primaryArtistName(gotArtist));
  let s = 0;
  if (gt === wt) s += 100;
  else if (gt.includes(wt) || wt.includes(gt)) s += 55;
  else s += tokenOverlapScore(wt, gt);
  if (ga === wa) s += 90;
  else if (ga.includes(wa) || wa.includes(ga)) s += 45;
  else s += Math.round(tokenOverlapScore(wa, ga) * 0.6);
  return s;
}

function searchQueriesForRow(row: { title: string; artist: string }): string[] {
  const artist = primaryArtistName(row.artist);
  const titles = titleSearchVariants(row.title);
  const out = new Set<string>();

  for (const title of titles) {
    // Estratégias principais: title + artist
    out.add(`${title} ${artist}`);
    out.add(`${artist} ${title}`);
    out.add(`track:${title} artist:${artist}`);

    // Fallback: só título (para covers/versões)
    out.add(title);

    // Fallback: só artista + título simplificado
    out.add(`artist:${artist} track:${title}`);
  }

  return [...out];
}

async function applySpotifyMetadataToSongRow(
  db: Db,
  rowId: string,
  meta: SpotifyTrackMetadata,
  opts?: { fixInvalidSpotifyId?: string | null },
): Promise<boolean> {
  const primaryArtist = meta.primaryArtist;
  const albumSpotifyId = meta.album.spotifyId;
  const currentInvalid =
    opts?.fixInvalidSpotifyId != null && !isSpotifyTrackId(opts.fixInvalidSpotifyId);

  let adoptSpotifyId: string | undefined;
  if (currentInvalid) {
    const taken = await db.song.findFirst({
      where: { spotifyId: meta.spotifyId, NOT: { id: rowId } },
      select: { id: true },
    });
    if (!taken) adoptSpotifyId = meta.spotifyId;
  }

  if (primaryArtist) {
    await db.artist.upsert({
      where: { spotifyId: primaryArtist.spotifyId },
      update: {
        name: primaryArtist.name,
        spotifyUrl: primaryArtist.spotifyUrl ?? undefined,
      },
      create: {
        spotifyId: primaryArtist.spotifyId,
        name: primaryArtist.name,
        spotifyUrl: primaryArtist.spotifyUrl ?? null,
      },
    });
  }

  if (primaryArtist && albumSpotifyId) {
    await db.album.upsert({
      where: { spotifyId: albumSpotifyId },
      update: {
        title: meta.album.title ?? "Álbum",
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

  await db.song.update({
    where: { id: rowId },
    data: {
      ...(currentInvalid ? { spotifyId: adoptSpotifyId ?? null } : {}),
      artistSpotifyId: primaryArtist?.spotifyId ?? undefined,
      albumSpotifyId: albumSpotifyId ?? undefined,
      album: meta.album.title ?? undefined,
      durationMs: meta.durationMs ?? undefined,
      previewUrl: meta.previewUrl ?? undefined,
      spotifyUrl: meta.spotifyUrl ?? undefined,
      trackNumber: meta.trackNumber ?? undefined,
    },
  });

  return Boolean(meta.album.coverUrl?.trim());
}

/** Copia álbum/capa de outra `Song` com mesmo título (ex.: duplicata com ID inválido). */
async function enrichSongRowFromExistingTwin(
  db: Db,
  row: { id: string; title: string; artist: string; spotifyId: string | null },
): Promise<boolean> {
  const wantArtist = normalizeMatchKey(primaryArtistName(row.artist));
  const twins = await db.song.findMany({
    where: {
      NOT: { id: row.id },
      title: { equals: row.title, mode: "insensitive" },
      albumSpotifyId: { not: null },
      albumRef: { coverUrl: { not: null } },
    },
    select: {
      artist: true,
      spotifyId: true,
      albumSpotifyId: true,
      albumRef: { select: { coverUrl: true } },
    },
  });

  const twin = twins.find((t) => {
    if (!t.albumRef?.coverUrl?.trim() || !t.albumSpotifyId) return false;
    const ga = normalizeMatchKey(primaryArtistName(t.artist));
    return ga === wantArtist || ga.includes(wantArtist) || wantArtist.includes(ga);
  });
  if (!twin?.albumSpotifyId) return false;

  const invalidCurrent = row.spotifyId != null && !isSpotifyTrackId(row.spotifyId);
  let adoptSpotifyId: string | null | undefined;
  if (invalidCurrent && twin.spotifyId && isSpotifyTrackId(twin.spotifyId)) {
    const taken = await db.song.findFirst({
      where: { spotifyId: twin.spotifyId, NOT: { id: row.id } },
      select: { id: true },
    });
    adoptSpotifyId = taken ? null : twin.spotifyId;
  }

  await db.song.update({
    where: { id: row.id },
    data: {
      ...(invalidCurrent ? { spotifyId: adoptSpotifyId ?? null } : {}),
      albumSpotifyId: twin.albumSpotifyId,
    },
  });
  return true;
}

async function enrichSongRowBySearch(
  db: Db,
  row: { id: string; title: string; artist: string; spotifyId: string | null },
  opts?: { maxAttempts?: number },
): Promise<boolean> {
  const invalidId = row.spotifyId != null && !isSpotifyTrackId(row.spotifyId);
  const minScore = invalidId ? 100 : 120;

  const seen = new Map<string, { title: string; artist: string; album: string; spotifyId: string }>();
  for (const query of searchQueriesForRow(row)) {
    const matches = await searchSpotifyTracks(query, 8, "BR", undefined, opts);
    for (const m of matches) seen.set(m.spotifyId, m);
  }
  if (seen.size === 0) return false;

  let best = [...seen.values()][0];
  let bestScore = -1;
  for (const m of seen.values()) {
    const sc = scoreSearchMatch(row.title, row.artist, m.title, m.artist);
    if (sc > bestScore) {
      best = m;
      bestScore = sc;
    }
  }
  if (bestScore < minScore) return false;

  const meta = await getSpotifyTrackMetadataById(best.spotifyId, "BR", opts);
  if (!meta?.album.coverUrl?.trim()) return false;

  return applySpotifyMetadataToSongRow(
    db,
    row.id,
    meta,
    invalidId ? { fixInvalidSpotifyId: row.spotifyId } : undefined,
  );
}

async function enrichSongRowFallback(
  db: Db,
  row: { id: string; title: string; artist: string; spotifyId: string | null },
  opts?: { maxAttempts?: number },
): Promise<boolean> {
  if (await enrichSongRowFromExistingTwin(db, row)) return true;
  return enrichSongRowBySearch(db, row, opts);
}

export type EnrichSongsResult = {
  updated: number;
  skipped: number;
  viaBatch: number;
  viaSearch: number;
  invalidSpotifyIds: number;
  tokenMissing: boolean;
  /** Ids não tentados por falta de tempo (deadline) — devem voltar em um próximo lote, não são falha. */
  deferredIds: string[];
};

/** Após publicação rápida, busca capas e vínculos de álbum no Spotify (lotes de 50). */
export async function enrichResolvedSongsWithSpotifyMetadata(
  db: Db,
  songs: ResolvedPublishSong[],
  opts?: {
    searchFallback?: boolean;
    /** Prazo absoluto (epoch ms) — o fallback por busca para ao atingi-lo; itens não tentados vão para `deferredIds`. */
    deadlineAt?: number;
    /** Coletor de ids pulados por falta de tempo (preenchido quando `deadlineAt` estoura). */
    deferredIds?: Set<string>;
  },
): Promise<ResolvedPublishSong[]> {
  if (songs.length === 0) return songs;

  const rows = await db.song.findMany({
    where: { id: { in: songs.map((s) => s.id) } },
    select: SONG_ENRICH_SELECT,
  });

  const needsEnrich = rows.filter((r) => !r.albumRef?.coverUrl?.trim());
  if (needsEnrich.length === 0) return songs;

  const batch = await getSpotifyTracksMetadataByIds(
    needsEnrich.map((r) => r.spotifyId).filter((id): id is string => Boolean(id && isSpotifyTrackId(id))),
    "BR",
    // Com deadline (backfill interativo), falha rápido; sem deadline (publicação), mantém retries.
    opts?.deadlineAt ? { maxAttempts: 1 } : undefined,
  );
  const updatedById = new Map<string, ResolvedPublishSong>();

  for (const row of needsEnrich) {
    const sid = row.spotifyId;
    const meta = sid && isSpotifyTrackId(sid) ? batch.metadata.get(sid) : undefined;
    if (!meta) continue;

    try {
      const ok = await applySpotifyMetadataToSongRow(db, row.id, meta);
      if (!ok) continue;
      updatedById.set(row.id, {
        id: row.id,
        spotifyId: meta.spotifyId,
        albumSpotifyId: meta.album.spotifyId ?? null,
      });
    } catch (err) {
      console.error(`[enrich] batch falhou para ${row.artist} — ${row.title}:`, err);
    }
  }

  if (opts?.searchFallback !== false) {
    for (const row of needsEnrich) {
      if (updatedById.has(row.id)) continue;
      if (opts?.deadlineAt && Date.now() >= opts.deadlineAt) {
        opts.deferredIds?.add(row.id);
        continue;
      }
      try {
        // Aumentar maxAttempts: 3 tentativas para buscas (vs 1 para batch Spotify)
        const ok = await enrichSongRowFallback(db, row, { maxAttempts: 3 });
        if (!ok) continue;
        const fresh = await db.song.findUnique({
          where: { id: row.id },
          select: { spotifyId: true, albumSpotifyId: true },
        });
        if (fresh) {
          updatedById.set(row.id, {
            id: row.id,
            spotifyId: fresh.spotifyId ?? null,
            albumSpotifyId: fresh.albumSpotifyId ?? null,
          });
        }
      } catch (err) {
        console.error(`[enrich] busca falhou para ${row.artist} — ${row.title}:`, err);
      }
    }
  }

  return songs.map((s) => updatedById.get(s.id) ?? s);
}

async function reloadResolvedSongs(db: Db, songs: ResolvedPublishSong[]): Promise<ResolvedPublishSong[]> {
  if (songs.length === 0) return songs;
  const rows = await db.song.findMany({
    where: { id: { in: songs.map((s) => s.id) } },
    select: SONG_SELECT,
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return songs.map((s) => {
    const row = byId.get(s.id);
    return row
      ? {
          id: row.id,
          spotifyId: row.spotifyId ?? null,
          albumSpotifyId: row.albumSpotifyId ?? null,
        }
      : s;
  });
}

/** Garante que o spotifyId da entrada (UI/Spotify) chegue na `Song` antes do enrich. */
async function promoteEntrySpotifyIds(
  db: Db,
  entries: PublishEntryInput[],
  songs: ResolvedPublishSong[],
): Promise<ResolvedPublishSong[]> {
  const out = [...songs];
  for (let i = 0; i < out.length; i++) {
    const sid = entries[i]?.spotifyId?.trim();
    if (!sid || !isSpotifyTrackId(sid)) continue;
    const song = out[i];
    if (song.spotifyId === sid) continue;
    if (song.spotifyId && isSpotifyTrackId(song.spotifyId) && song.spotifyId !== sid) continue;

    const taken = await db.song.findFirst({
      where: { spotifyId: sid, NOT: { id: song.id } },
      select: { id: true },
    });
    if (taken) continue;

    const updated = await db.song.update({
      where: { id: song.id },
      data: {
        spotifyId: sid,
        ...(entries[i].album ? { album: entries[i].album } : {}),
      },
      select: SONG_SELECT,
    });
    out[i] = {
      id: updated.id,
      spotifyId: updated.spotifyId ?? null,
      albumSpotifyId: updated.albumSpotifyId ?? null,
    };
  }
  return out;
}

/** Usa imageUrl da UI (busca Spotify) quando o batch ainda não vinculou capa. */
async function applyEntryCoverHints(
  db: Db,
  entries: PublishEntryInput[],
  songs: ResolvedPublishSong[],
): Promise<void> {
  const rows = await db.song.findMany({
    where: { id: { in: songs.map((s) => s.id) } },
    select: SONG_ENRICH_SELECT,
  });
  const entryIndexBySongId = new Map(songs.map((s, i) => [s.id, i]));

  const needCover = rows.filter((r) => !r.albumRef?.coverUrl?.trim());
  if (needCover.length === 0) return;

  const batchSpotifyIds = [
    ...new Set(
      needCover
        .map((r) => {
          const idx = entryIndexBySongId.get(r.id);
          const fromEntry = idx != null ? entries[idx]?.spotifyId?.trim() : null;
          const fromRow = r.spotifyId?.trim();
          const sid =
            fromEntry && isSpotifyTrackId(fromEntry)
              ? fromEntry
              : fromRow && isSpotifyTrackId(fromRow)
                ? fromRow
                : null;
          return sid;
        })
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const batchMeta = await getSpotifyTracksMetadataByIds(batchSpotifyIds);

  for (const row of needCover) {
    const idx = entryIndexBySongId.get(row.id);
    const entry = idx != null ? entries[idx] : undefined;
    const imageUrl = entry?.imageUrl?.trim();
    const entrySid = entry?.spotifyId?.trim();
    const sid =
      entrySid && isSpotifyTrackId(entrySid)
        ? entrySid
        : row.spotifyId && isSpotifyTrackId(row.spotifyId)
          ? row.spotifyId
          : null;

    const meta = sid ? batchMeta.metadata.get(sid) : undefined;
    if (meta?.album.coverUrl?.trim()) {
      await applySpotifyMetadataToSongRow(db, row.id, meta);
      continue;
    }

    if (imageUrl && row.albumSpotifyId) {
      await db.album.update({
        where: { spotifyId: row.albumSpotifyId },
        data: { coverUrl: imageUrl },
      });
      continue;
    }

    if (imageUrl && sid) {
      const single = meta ?? (await getSpotifyTrackMetadataById(sid));
      if (single) {
        await applySpotifyMetadataToSongRow(db, row.id, single);
      }
    }
  }
}

/**
 * Resolve rápido + capas: promove spotifyId da entrada, enrich em lote, hints de imageUrl, reload.
 */
export async function finalizeSongsForChartPublish(
  db: Db,
  entries: PublishEntryInput[],
  songs: ResolvedPublishSong[],
): Promise<ResolvedPublishSong[]> {
  let resolved = await promoteEntrySpotifyIds(db, entries, songs);
  // Lote Spotify (até 50 IDs por request) + searchFallback para fórmulas sem capa.
  // Deadline de 90s permite mais buscas para usuários com muitas faixas.
  // deadlineAt força maxAttempts 1 no lote: sob 429 a publicação não fica presa,
  // mas searchFallback tenta mais estratégias em paralelo (30s no fallback).
  resolved = await enrichResolvedSongsWithSpotifyMetadata(db, resolved, {
    searchFallback: true,
    deadlineAt: Date.now() + 90_000,
  });
  await applyEntryCoverHints(db, entries, resolved);
  return reloadResolvedSongs(db, resolved);
}

/**
 * Versão com feedback: retorna músicas + metadados sobre enriquecimento.
 * Útil para diagnosticar quais faixas não conseguiram capas/metadados.
 */
export async function finalizeSongsForChartPublishWithFeedback(
  db: Db,
  entries: PublishEntryInput[],
  songs: ResolvedPublishSong[],
): Promise<{
  songs: ResolvedPublishSong[];
  enrichmentStats: {
    withCover: number;
    withoutCover: number;
    missingCoverIndices: number[];
  };
}> {
  let resolved = await promoteEntrySpotifyIds(db, entries, songs);

  const deferredIds = new Set<string>();
  resolved = await enrichResolvedSongsWithSpotifyMetadata(db, resolved, {
    searchFallback: true,
    deadlineAt: Date.now() + 90_000,
    deferredIds,
  });

  await applyEntryCoverHints(db, entries, resolved);
  resolved = await reloadResolvedSongs(db, resolved);

  // Carregar informação de capas para feedback
  const final = await db.song.findMany({
    where: { id: { in: resolved.map((s) => s.id) } },
    select: { id: true, albumSpotifyId: true, albumRef: { select: { coverUrl: true } } },
  });

  const hasCovers = new Set(
    final
      .filter((s) => s.albumRef?.coverUrl?.trim())
      .map((s) => s.id),
  );

  const missingCoverIndices = resolved
    .map((s, idx) => (!hasCovers.has(s.id) ? idx : -1))
    .filter((idx) => idx >= 0);

  return {
    songs: resolved,
    enrichmentStats: {
      withCover: hasCovers.size,
      withoutCover: resolved.length - hasCovers.size,
      missingCoverIndices,
    },
  };
}

const SONG_COVER_SELECT = {
  id: true,
  spotifyId: true,
  albumSpotifyId: true,
  title: true,
  artist: true,
  albumRef: { select: { coverUrl: true } },
} as const;

/** Músicas sem capa vinculada (com ou sem spotifyId válido). */
export async function findSongsMissingCovers(db: Db, limit?: number) {
  const rows = await db.song.findMany({
    where: {
      OR: [
        { albumSpotifyId: null },
        { albumRef: null },
        { albumRef: { coverUrl: null } },
        { albumRef: { coverUrl: "" } },
      ],
    },
    select: SONG_COVER_SELECT,
    orderBy: { id: "asc" },
    ...(limit ? { take: limit } : {}),
  });
  return rows.filter((r) => !r.albumRef?.coverUrl?.trim());
}

export async function countSongsMissingCovers(db: Db): Promise<number> {
  const rows = await db.song.findMany({
    where: {
      OR: [
        { albumSpotifyId: null },
        { albumRef: null },
        { albumRef: { coverUrl: null } },
        { albumRef: { coverUrl: "" } },
      ],
    },
    select: { albumRef: { select: { coverUrl: true } } },
  });
  return rows.filter((r) => !r.albumRef?.coverUrl?.trim()).length;
}

/** Enriquece músicas por ID (backfill de capas). */
export async function enrichSongsWithSpotifyMetadataByIds(
  db: Db,
  songIds: string[],
  opts?: { searchFallback?: boolean; deadlineAt?: number },
): Promise<EnrichSongsResult> {
  if (songIds.length === 0) {
    return { updated: 0, skipped: 0, viaBatch: 0, viaSearch: 0, invalidSpotifyIds: 0, tokenMissing: false, deferredIds: [] };
  }

  const before = await db.song.findMany({
    where: { id: { in: songIds } },
    select: SONG_ENRICH_SELECT,
  });
  const needsEnrich = before.filter((r) => !r.albumRef?.coverUrl?.trim());
  const invalidSpotifyIds = needsEnrich.filter((r) => r.spotifyId && !isSpotifyTrackId(r.spotifyId)).length;
  const coveredBefore = new Set(
    before.filter((r) => r.albumRef?.coverUrl?.trim()).map((r) => r.id),
  );

  const deferredIds = new Set<string>();
  await enrichResolvedSongsWithSpotifyMetadata(
    db,
    songIds.map((id) => ({ id, spotifyId: null, albumSpotifyId: null })),
    { ...opts, deferredIds },
  );

  const after = await db.song.findMany({
    where: { id: { in: songIds } },
    select: {
      id: true,
      spotifyId: true,
      albumSpotifyId: true,
      albumRef: { select: { coverUrl: true } },
    },
  });

  let updated = 0;
  let viaSearch = 0;
  for (const row of after) {
    if (!row.albumRef?.coverUrl?.trim() || coveredBefore.has(row.id)) continue;
    updated += 1;
    const prev = before.find((b) => b.id === row.id);
    const hadValidBatchId =
      prev?.spotifyId && isSpotifyTrackId(prev.spotifyId) && prev.spotifyId === row.spotifyId;
    if (!hadValidBatchId) viaSearch += 1;

    if (row.albumSpotifyId) {
      await db.chartEntry.updateMany({
        where: { songId: row.id },
        data: {
          albumSpotifyId: row.albumSpotifyId,
          ...(row.spotifyId ? { songSpotifyId: row.spotifyId } : {}),
        },
      });
    }
  }

  const viaBatch = updated - viaSearch;
  const tokenMissing =
    needsEnrich.length > 0 &&
    updated === 0 &&
    needsEnrich.every((r) => r.spotifyId && isSpotifyTrackId(r.spotifyId));

  return {
    updated,
    skipped: songIds.length - updated,
    viaBatch,
    viaSearch,
    invalidSpotifyIds,
    tokenMissing,
    deferredIds: [...deferredIds],
  };
}

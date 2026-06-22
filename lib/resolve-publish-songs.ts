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
      if (byTextKey.has(key)) {
        results[i] = byTextKey.get(key)!;
      }
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

function scoreSearchMatch(wantTitle: string, wantArtist: string, gotTitle: string, gotArtist: string): number {
  const wt = normalizeMatchKey(wantTitle);
  const wa = normalizeMatchKey((wantArtist.split(",")[0] ?? wantArtist).split(" feat ")[0] ?? wantArtist);
  const gt = normalizeMatchKey(gotTitle);
  const ga = normalizeMatchKey((gotArtist.split(",")[0] ?? gotArtist));
  let s = 0;
  if (gt === wt) s += 100;
  else if (gt.includes(wt) || wt.includes(gt)) s += 55;
  if (ga === wa) s += 90;
  else if (ga.includes(wa) || wa.includes(ga)) s += 45;
  return s;
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

async function enrichSongRowBySearch(
  db: Db,
  row: { id: string; title: string; artist: string; spotifyId: string | null },
): Promise<boolean> {
  const matches = await searchSpotifyTracks(`${row.title} ${row.artist}`, 8);
  if (!matches.length) return false;

  let best = matches[0];
  let bestScore = -1;
  for (const m of matches) {
    const sc = scoreSearchMatch(row.title, row.artist, m.title, m.artist);
    if (sc > bestScore) {
      best = m;
      bestScore = sc;
    }
  }
  if (bestScore < 120) return false;

  const meta = await getSpotifyTrackMetadataById(best.spotifyId);
  if (!meta?.album.coverUrl?.trim()) return false;

  return applySpotifyMetadataToSongRow(
    db,
    row.id,
    meta,
    row.spotifyId && !isSpotifyTrackId(row.spotifyId)
      ? { fixInvalidSpotifyId: row.spotifyId }
      : undefined,
  );
}

export type EnrichSongsResult = {
  updated: number;
  skipped: number;
  viaBatch: number;
  viaSearch: number;
  invalidSpotifyIds: number;
  tokenMissing: boolean;
};

/** Após publicação rápida, busca capas e vínculos de álbum no Spotify (lotes de 50). */
export async function enrichResolvedSongsWithSpotifyMetadata(
  db: Db,
  songs: ResolvedPublishSong[],
  opts?: { searchFallback?: boolean },
): Promise<ResolvedPublishSong[]> {
  if (songs.length === 0) return songs;

  const rows = await db.song.findMany({
    where: { id: { in: songs.map((s) => s.id) } },
    select: SONG_ENRICH_SELECT,
  });

  const needsEnrich = rows.filter(
    (r) => r.spotifyId && (!r.albumSpotifyId || !r.albumRef?.coverUrl?.trim()),
  );
  if (needsEnrich.length === 0) return songs;

  const batch = await getSpotifyTracksMetadataByIds(needsEnrich.map((r) => r.spotifyId!));
  const updatedById = new Map<string, ResolvedPublishSong>();

  for (const row of needsEnrich) {
    const sid = row.spotifyId!;
    const meta = isSpotifyTrackId(sid) ? batch.metadata.get(sid) : undefined;
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
      try {
        const ok = await enrichSongRowBySearch(db, row);
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

const SONG_COVER_SELECT = {
  id: true,
  spotifyId: true,
  albumSpotifyId: true,
  title: true,
  artist: true,
  albumRef: { select: { coverUrl: true } },
} as const;

/** Músicas com Spotify ID mas sem álbum/capa vinculados. */
export async function findSongsMissingCovers(db: Db, limit?: number) {
  const rows = await db.song.findMany({
    where: {
      spotifyId: { not: null },
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
  return rows.filter((r) => r.spotifyId && (!r.albumSpotifyId || !r.albumRef?.coverUrl?.trim()));
}

/** Enriquece músicas por ID (backfill de capas). */
export async function enrichSongsWithSpotifyMetadataByIds(
  db: Db,
  songIds: string[],
  opts?: { searchFallback?: boolean },
): Promise<EnrichSongsResult> {
  if (songIds.length === 0) {
    return { updated: 0, skipped: 0, viaBatch: 0, viaSearch: 0, invalidSpotifyIds: 0, tokenMissing: false };
  }

  const before = await db.song.findMany({
    where: { id: { in: songIds } },
    select: SONG_ENRICH_SELECT,
  });
  const needsEnrich = before.filter(
    (r) => r.spotifyId && (!r.albumSpotifyId || !r.albumRef?.coverUrl?.trim()),
  );
  const invalidSpotifyIds = needsEnrich.filter((r) => r.spotifyId && !isSpotifyTrackId(r.spotifyId)).length;
  const coveredBefore = new Set(
    before.filter((r) => r.albumRef?.coverUrl?.trim()).map((r) => r.id),
  );

  await enrichResolvedSongsWithSpotifyMetadata(
    db,
    songIds.map((id) => ({ id, spotifyId: null, albumSpotifyId: null })),
    opts,
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
  };
}

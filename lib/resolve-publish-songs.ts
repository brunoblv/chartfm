import type { Prisma, PrismaClient } from "@prisma/client";
import { getSpotifyTracksMetadataByIds } from "@/lib/spotify-server";

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

/** Após publicação rápida, busca capas e vínculos de álbum no Spotify (lotes de 50). */
export async function enrichResolvedSongsWithSpotifyMetadata(
  db: Db,
  songs: ResolvedPublishSong[],
): Promise<ResolvedPublishSong[]> {
  if (songs.length === 0) return songs;

  const rows = await db.song.findMany({
    where: { id: { in: songs.map((s) => s.id) } },
    select: {
      id: true,
      spotifyId: true,
      albumSpotifyId: true,
      albumRef: { select: { coverUrl: true } },
    },
  });

  const needsEnrich = rows.filter(
    (r) => r.spotifyId && (!r.albumSpotifyId || !r.albumRef?.coverUrl?.trim()),
  );
  if (needsEnrich.length === 0) return songs;

  const metadataBySpotifyId = await getSpotifyTracksMetadataByIds(
    needsEnrich.map((r) => r.spotifyId!),
  );
  if (metadataBySpotifyId.size === 0) return songs;

  const updatedById = new Map<string, ResolvedPublishSong>();

  for (const row of needsEnrich) {
    const sid = row.spotifyId!;
    const meta = metadataBySpotifyId.get(sid);
    if (!meta) continue;

    const primaryArtist = meta.primaryArtist;
    const albumSpotifyId = meta.album.spotifyId;

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
      where: { id: row.id },
      data: {
        artistSpotifyId: primaryArtist?.spotifyId ?? undefined,
        albumSpotifyId: albumSpotifyId ?? undefined,
        album: meta.album.title ?? undefined,
        durationMs: meta.durationMs ?? undefined,
        previewUrl: meta.previewUrl ?? undefined,
        spotifyUrl: meta.spotifyUrl ?? undefined,
        trackNumber: meta.trackNumber ?? undefined,
      },
    });

    updatedById.set(row.id, {
      id: row.id,
      spotifyId: sid,
      albumSpotifyId: albumSpotifyId ?? null,
    });
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
): Promise<{ updated: number; skipped: number }> {
  if (songIds.length === 0) return { updated: 0, skipped: 0 };

  await enrichResolvedSongsWithSpotifyMetadata(
    db,
    songIds.map((id) => ({ id, spotifyId: null, albumSpotifyId: null })),
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
  for (const row of after) {
    if (!row.albumRef?.coverUrl?.trim()) continue;
    updated += 1;
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

  return { updated, skipped: songIds.length - updated };
}

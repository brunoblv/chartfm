import type { Prisma, PrismaClient } from "@prisma/client";

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

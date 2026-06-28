import type { PrismaClient } from "@prisma/client";
import { songEntityKey } from "@/lib/entity-page-snapshot/keys";
import { isSpotifyTrackId } from "@/lib/spotify-server";

type CoverSourceEntry = {
  song: { albumRef?: { coverUrl?: string | null } | null };
  albumBySpotify?: { coverUrl?: string | null } | null;
};

/** Capa da faixa: Song.albumRef primeiro, depois álbum ligado na ChartEntry. */
export function resolveChartEntryCoverUrl(entry: CoverSourceEntry): string | null {
  const fromSong = entry.song.albumRef?.coverUrl?.trim();
  if (fromSong) return fromSong;
  const fromEntry = entry.albumBySpotify?.coverUrl?.trim();
  if (fromEntry) return fromEntry;
  return null;
}

type SongPageSnapshotLike = { coverImageUrl?: string | null };

type CoverCarrier = {
  song: { id?: string | null; imageUrl?: string | null };
  cover: { imageUrl?: string | null };
};

type HydrateDb = Pick<PrismaClient, "song" | "chartEntry" | "entityPageSnapshot">;

function entryHasCover(entry: CoverCarrier): boolean {
  return Boolean(entry.song.imageUrl?.trim() || entry.cover.imageUrl?.trim());
}

function normalizeArtistKey(artist: string): string {
  return (artist.split(",")[0] ?? artist).split(" feat ")[0]?.trim().toLowerCase() ?? artist.trim().toLowerCase();
}

/** Snapshots de entidade (mesma fonte que /song/[id] quando o BD está desatualizado). */
export async function loadEntitySnapshotCoverUrls(
  db: Pick<PrismaClient, "entityPageSnapshot">,
  songIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(songIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const keyToSongId = new Map(unique.map((id) => [songEntityKey(id), id]));
  const rows = await db.entityPageSnapshot.findMany({
    where: { kind: "SONG", entityKey: { in: [...keyToSongId.keys()] } },
    select: { entityKey: true, snapshotDay: true, payload: true },
    orderBy: { snapshotDay: "desc" },
  });

  const out = new Map<string, string>();
  for (const row of rows) {
    const songId = keyToSongId.get(row.entityKey);
    if (!songId || out.has(songId)) continue;
    const url = (row.payload as SongPageSnapshotLike).coverImageUrl?.trim();
    if (url) out.set(songId, url);
  }
  return out;
}

/** Resolve capas faltantes consultando Song, ChartEntry, gêmeas, spotifyId e snapshots. */
export async function loadCoverUrlsForSongIds(
  db: HydrateDb,
  songIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(songIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const out = new Map<string, string>();

  const songs = await db.song.findMany({
    where: { id: { in: unique } },
    select: {
      id: true,
      title: true,
      artist: true,
      spotifyId: true,
      albumRef: { select: { coverUrl: true } },
    },
  });

  for (const s of songs) {
    const url = s.albumRef?.coverUrl?.trim();
    if (url) out.set(s.id, url);
  }

  let missing = unique.filter((id) => !out.has(id));
  if (missing.length > 0) {
    const entryRows = await db.chartEntry.findMany({
      where: { songId: { in: missing }, albumSpotifyId: { not: null } },
      select: { songId: true, albumBySpotify: { select: { coverUrl: true } } },
      orderBy: { createdAt: "desc" },
    });
    for (const row of entryRows) {
      if (out.has(row.songId)) continue;
      const url = row.albumBySpotify?.coverUrl?.trim();
      if (url) out.set(row.songId, url);
    }
  }

  missing = unique.filter((id) => !out.has(id));
  const missingSongs = songs.filter((s) => missing.includes(s.id));

  const spotifyIds = [
    ...new Set(
      missingSongs
        .map((s) => s.spotifyId?.trim())
        .filter((id): id is string => Boolean(id && isSpotifyTrackId(id))),
    ),
  ];
  if (spotifyIds.length > 0) {
    const bySpotify = await db.song.findMany({
      where: {
        spotifyId: { in: spotifyIds },
        albumRef: { coverUrl: { not: null } },
      },
      select: { spotifyId: true, albumRef: { select: { coverUrl: true } } },
    });
    const coverBySpotifyId = new Map<string, string>();
    for (const row of bySpotify) {
      const sid = row.spotifyId?.trim();
      const url = row.albumRef?.coverUrl?.trim();
      if (sid && url && !coverBySpotifyId.has(sid)) coverBySpotifyId.set(sid, url);
    }
    for (const s of missingSongs) {
      if (out.has(s.id)) continue;
      const sid = s.spotifyId?.trim();
      if (!sid) continue;
      const url = coverBySpotifyId.get(sid);
      if (url) out.set(s.id, url);
    }
  }

  missing = unique.filter((id) => !out.has(id));
  const twinCandidates = missingSongs.filter((s) => missing.includes(s.id));
  if (twinCandidates.length > 0) {
    const titles = [...new Set(twinCandidates.map((s) => s.title.trim()))];
    const twins = await db.song.findMany({
      where: {
        title: { in: titles, mode: "insensitive" },
        albumSpotifyId: { not: null },
        albumRef: { coverUrl: { not: null } },
      },
      select: {
        title: true,
        artist: true,
        albumRef: { select: { coverUrl: true } },
      },
    });
    const twinByKey = new Map<string, string>();
    for (const twin of twins) {
      const url = twin.albumRef?.coverUrl?.trim();
      if (!url) continue;
      const key = `${twin.title.trim().toLowerCase()}|||${normalizeArtistKey(twin.artist)}`;
      if (!twinByKey.has(key)) twinByKey.set(key, url);
    }
    for (const s of twinCandidates) {
      if (out.has(s.id)) continue;
      const key = `${s.title.trim().toLowerCase()}|||${normalizeArtistKey(s.artist)}`;
      const url = twinByKey.get(key);
      if (url) out.set(s.id, url);
    }
  }

  missing = unique.filter((id) => !out.has(id));
  if (missing.length > 0) {
    const snapshotCovers = await loadEntitySnapshotCoverUrls(db, missing);
    for (const [songId, url] of snapshotCovers) {
      if (!out.has(songId)) out.set(songId, url);
    }
  }

  return out;
}

export function withResolvedCoverUrl<T extends CoverCarrier>(entry: T, imageUrl: string | null): T {
  if (!imageUrl) return entry;
  return {
    ...entry,
    song: { ...entry.song, imageUrl },
    cover: { ...entry.cover, imageUrl },
  };
}

export async function hydrateChartEntryCoverUrls<T extends CoverCarrier>(
  db: HydrateDb,
  entries: T[],
): Promise<T[]> {
  if (entries.length === 0) return entries;

  const missingIds = [
    ...new Set(
      entries
        .filter((e) => e.song.id && !entryHasCover(e))
        .map((e) => e.song.id as string),
    ),
  ];

  const coverBySongId =
    missingIds.length > 0 ? await loadCoverUrlsForSongIds(db, missingIds) : new Map<string, string>();

  return entries.map((entry) => {
    if (entryHasCover(entry)) return entry;
    const id = entry.song.id;
    if (!id) return entry;
    return withResolvedCoverUrl(entry, coverBySongId.get(id) ?? null);
  });
}

export async function hydrateDropoutCoverUrls<T extends CoverCarrier>(
  db: HydrateDb,
  dropouts: T[],
): Promise<T[]> {
  return hydrateChartEntryCoverUrls(db, dropouts);
}

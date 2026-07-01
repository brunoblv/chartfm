import type { Prisma, PrismaClient } from "@prisma/client";
import type { Cover } from "@/lib/types";
import {
  resolveSongsForFastPublish,
  type PublishEntryInput,
} from "@/lib/resolve-publish-songs";

const PALETTES: [string, string][] = [
  ["#FF6B6B", "#FFE66D"],
  ["#4ECDC4", "#556270"],
  ["#C7F464", "#4ECDC4"],
  ["#FF8C94", "#FFAAA5"],
  ["#A8E6CF", "#3D5A80"],
  ["#E07856", "#F2D8A7"],
  ["#2E294E", "#EA698B"],
  ["#1B2021", "#FFD166"],
  ["#EF476F", "#06D6A0"],
  ["#073B4C", "#FFD166"],
  ["#8338EC", "#FB5607"],
];

function paletteFor(artist: string, title: string) {
  const key = artist + title;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return { palette: PALETTES[Math.abs(hash) % PALETTES.length], seed: Math.abs(hash) };
}

export type ChartSpotlightSong = {
  id: string;
  title: string;
  artist: string;
  spotifyId: string | null;
  spotifyUrl: string | null;
  cover: Cover;
};

type PrismaSpotlightSong = {
  id: string;
  title: string;
  exhibitionName?: string | null;
  artist: string;
  spotifyId?: string | null;
  spotifyUrl?: string | null;
  albumRef?: { coverUrl?: string | null } | null;
  artistRef?: { name: string } | null;
};

export function mapPrismaSpotlightSong(
  song: PrismaSpotlightSong,
  coverUrl?: string | null,
): ChartSpotlightSong {
  const img = coverUrl?.trim() || song.albumRef?.coverUrl?.trim() || null;
  const { palette, seed } = paletteFor(song.artist, song.title);
  return {
    id: song.id,
    title: song.exhibitionName?.trim() || song.title,
    artist: song.artistRef?.name?.trim() || song.artist,
    spotifyId: song.spotifyId ?? null,
    spotifyUrl: song.spotifyUrl ?? null,
    cover: { palette, seed, imageUrl: img },
  };
}

type Db = PrismaClient | Prisma.TransactionClient;

const SPOTLIGHT_SONG_INCLUDE = {
  albumRef: { select: { coverUrl: true } },
  artistRef: { select: { name: true } },
} as const;

export { SPOTLIGHT_SONG_INCLUDE };

/** Resolve só o ID da música no banco — sem enrich Spotify (evita timeout na publicação). */
export async function resolveOptionalSpotlightSongId(
  db: Db,
  entry: PublishEntryInput | null | undefined,
): Promise<string | null> {
  if (!entry?.title?.trim() || !entry?.artist?.trim()) return null;
  const resolved = await resolveSongsForFastPublish(db, [entry]);
  return resolved[0]?.id ?? null;
}

export function spotlightSongIdFromResolvedEntries(
  entry: PublishEntryInput | null | undefined,
  chartEntries: PublishEntryInput[],
  resolvedSongs: Array<{ id: string }>,
): string | null {
  if (!entry?.title?.trim() || !entry?.artist?.trim()) return null;
  const entrySongId = entry.songId?.trim();
  const entrySpotifyId = entry.spotifyId?.trim();
  const idx = chartEntries.findIndex((e) => {
    if (entrySongId && e.songId?.trim() === entrySongId) return true;
    if (entrySpotifyId && e.spotifyId?.trim() === entrySpotifyId) return true;
    return e.title.trim() === entry.title.trim() && e.artist.trim() === entry.artist.trim();
  });
  if (idx < 0) return null;
  return resolvedSongs[idx]?.id ?? null;
}

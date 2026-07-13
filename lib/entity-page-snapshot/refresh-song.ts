import { prisma } from "@/lib/prisma";
import {
  loadLatestGlobalWeeklySongPositions,
  loadSongGlobalStatsFromSnapshots,
} from "@/lib/global-snapshot";
import { buildAlbumPath, slugify } from "@/lib/music-routes";
import { computeAlbumPageSnapshot } from "./compute-album";
import { computeArtistPageSnapshot } from "./compute-artist";
import { computeSongPageSnapshot } from "./compute-song";
import { songEntityKey } from "./keys";
import { saveEntityPageSnapshot } from "./store";
import type { HistoricalStat } from "@/lib/global-snapshot";

async function refreshArtistSnapshot(
  artistId: number,
  stats: Map<string, HistoricalStat>,
  positions: Map<string, number>,
): Promise<void> {
  const a = await prisma.artist.findUnique({
    where: { id: artistId },
    select: { id: true, spotifyId: true, name: true },
  });
  if (!a) return;
  const payload = await computeArtistPageSnapshot(String(a.id), stats, positions);
  if (!payload) return;
  for (const key of [`db:${a.id}`, `spotify:${a.spotifyId}`, `name:${slugify(a.name)}`]) {
    await saveEntityPageSnapshot("ARTIST", key, payload);
  }
}

async function refreshAlbumSnapshot(albumId: number, stats: Map<string, HistoricalStat>): Promise<void> {
  const al = await prisma.album.findUnique({
    where: { id: albumId },
    select: { id: true, title: true, artist: { select: { id: true, name: true } } },
  });
  if (!al) return;
  const slug = buildAlbumPath(al.title, al.artist.name, {
    artistId: al.artist.id,
    albumId: al.id,
  }).replace(/^\/album\//, "");
  const payload = await computeAlbumPageSnapshot(slug, stats);
  if (!payload) return;
  await saveEntityPageSnapshot("ALBUM", `db:${al.artist.id}:${al.id}`, payload);
}

/**
 * Recalcula os snapshots afetados por uma edição de música (página da música,
 * do artista e dos álbuns novo/antigo), para a mudança aparecer na hora em vez
 * de esperar o cron diário. Nunca lança — falha vira log.
 */
export async function refreshSnapshotsForSong(
  songId: string,
  opts?: { previousAlbumId?: number | null; previousArtistId?: number | null },
): Promise<void> {
  try {
    const song = await prisma.song.findUnique({
      where: { id: songId },
      select: {
        id: true,
        spotifyId: true,
        title: true,
        artist: true,
        artistRef: { select: { id: true } },
        albumRef: { select: { id: true } },
      },
    });
    if (!song) return;

    const stats = await loadSongGlobalStatsFromSnapshots();
    const positions = await loadLatestGlobalWeeklySongPositions();

    let slug: string;
    if (song.spotifyId) {
      slug = `${song.spotifyId}_${slugify(song.title)}_${slugify(song.artist)}`;
    } else if (song.artistRef?.id) {
      slug = `${song.artistRef.id}_${song.id}`;
    } else {
      slug = song.id;
    }
    const payload = await computeSongPageSnapshot(slug, stats);
    if (payload) await saveEntityPageSnapshot("SONG", songEntityKey(song.id), payload);

    const artistIds = new Set<number>();
    if (song.artistRef?.id) artistIds.add(song.artistRef.id);
    if (opts?.previousArtistId) artistIds.add(opts.previousArtistId);
    for (const id of artistIds) await refreshArtistSnapshot(id, stats, positions);

    const albumIds = new Set<number>();
    if (song.albumRef?.id) albumIds.add(song.albumRef.id);
    if (opts?.previousAlbumId) albumIds.add(opts.previousAlbumId);
    for (const id of albumIds) await refreshAlbumSnapshot(id, stats);
  } catch (err) {
    console.error("[snapshot] refresh pós-edição da música", songId, err);
  }
}

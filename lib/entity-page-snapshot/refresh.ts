import { prisma } from "@/lib/prisma";
import {
  buildAndSaveDailyChartSongStats,
  getLatestDailyChartSongStats,
  type DailyChartSongStatsData,
} from "@/lib/daily-chart-song-stats";
import { loadSongGlobalStatsFromSnapshots } from "@/lib/global-snapshot";
import { buildAlbumPath, slugify } from "@/lib/music-routes";
import { computeAlbumPageSnapshot } from "./compute-album";
import { computeArtistPageSnapshot } from "./compute-artist";
import { computeSongPageSnapshot } from "./compute-song";
import { saveEntityPageSnapshot } from "./store";

export type EntitySnapshotRefreshResult = {
  dailyStatsBuilt: boolean;
  artists: number;
  albums: number;
  songs: number;
  errors: number;
};

export type EntitySnapshotRefreshOptions = {
  /** Não recalcula dailyChartSongStats (job das 8h reutiliza o da meia-noite). */
  skipDailyStatsBuild?: boolean;
  dailyStats?: DailyChartSongStatsData;
  now?: Date;
};

export async function refreshAllEntityPageSnapshots(
  options?: EntitySnapshotRefreshOptions,
): Promise<EntitySnapshotRefreshResult> {
  const now = options?.now ?? new Date();
  const dailyStats =
    options?.dailyStats ??
    (options?.skipDailyStatsBuild
      ? ((await getLatestDailyChartSongStats()) ?? (await buildAndSaveDailyChartSongStats(now)))
      : await buildAndSaveDailyChartSongStats(now));
  const songGlobalStats = await loadSongGlobalStatsFromSnapshots();
  const currentWeekPositions = await loadLatestGlobalWeeklySongPositions();
  let artists = 0;
  let albums = 0;
  let songs = 0;
  let errors = 0;

  const artistRows = await prisma.artist.findMany({
    select: { id: true, spotifyId: true, name: true },
  });

  for (const a of artistRows) {
    try {
      const payload = await computeArtistPageSnapshot(String(a.id), songGlobalStats, currentWeekPositions);
      if (!payload) continue;
      const keys = [`db:${a.id}`, `spotify:${a.spotifyId}`, `name:${slugify(a.name)}`];
      for (const key of keys) {
        await saveEntityPageSnapshot("ARTIST", key, payload);
      }
      artists += 1;
    } catch (err) {
      errors += 1;
      console.error("[snapshot] artist", a.id, err);
    }
  }

  const albumRows = await prisma.album.findMany({
    select: { id: true, artistSpotifyId: true, title: true, artist: { select: { id: true, name: true } } },
  });

  for (const al of albumRows) {
    try {
      const slug = buildAlbumPath(al.title, al.artist.name, {
        artistId: al.artist.id,
        albumId: al.id,
      }).replace(/^\/album\//, "");
      const payload = await computeAlbumPageSnapshot(slug, songGlobalStats);
      if (!payload) continue;
      await saveEntityPageSnapshot("ALBUM", `db:${al.artist.id}:${al.id}`, payload);
      albums += 1;
    } catch (err) {
      errors += 1;
      console.error("[snapshot] album", al.id, err);
    }
  }

  const songIds = await prisma.chartEntry.findMany({
    where: { chart: { isPublished: true } },
    distinct: ["songId"],
    select: { songId: true },
  });

  for (const { songId } of songIds) {
    try {
      const song = await prisma.song.findUnique({
        where: { id: songId },
        select: {
          id: true,
          spotifyId: true,
          title: true,
          artist: true,
          artistRef: { select: { id: true } },
        },
      });
      if (!song) continue;

      let slug: string;
      if (song.spotifyId) {
        slug = `${song.spotifyId}_${slugify(song.title)}_${slugify(song.artist)}`;
      } else if (song.artistRef?.id) {
        slug = `${song.artistRef.id}_${song.id}`;
      } else {
        slug = song.id;
      }

      const payload = await computeSongPageSnapshot(slug, songGlobalStats);
      if (!payload) continue;
      await saveEntityPageSnapshot("SONG", `id:${songId}`, payload);
      songs += 1;
    } catch (err) {
      errors += 1;
      console.error("[snapshot] song", songId, err);
    }
  }

  return {
    dailyStatsBuilt: true,
    artists,
    albums,
    songs,
    errors,
  };
}

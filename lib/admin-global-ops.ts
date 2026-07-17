/**
 * Operações manuais da Parada Global (admin) — espelham o que o cron faz
 * automaticamente, para recuperar falhas (playlist, posts, snapshot, etc.).
 */

import { prisma } from "@/lib/prisma";
import { SocialEventType } from "@prisma/client";
import {
  buildDateRangeFromDate,
  buildWeekLabelFromDate,
  getGlobalSnapshotDeadline,
  getRankingWeekReference,
  getWeeklySnapshotReferenceDate,
} from "@/lib/chart-week";
import { getGlobalPublishSlot } from "@/lib/global-publish-schedule";
import { GLOBAL_RANKING_FIRST_WEEK_INDEX } from "@/lib/global-ranking-config";
import { saveGlobalSnapshotForWeek, listGlobalRankingWeekIndexes } from "@/lib/global-snapshot";
import { saveGlobalLastfmSnapshotForWeek } from "@/lib/global-lastfm-snapshot";
import { saveCuratorsSnapshotForWeek } from "@/lib/curators-snapshot";
import { saveGlobalGenreSnapshotForWeek } from "@/lib/global-genre-snapshot";
import { GLOBAL_GENRE_CHARTS } from "@/lib/global-genre-charts";
import { publishAllCommunityLastfmSnapshots } from "@/lib/community-lastfm";
import { closeWeeklySpotlightPoll } from "@/lib/weekly-spotlight-poll";
import { syncGlobal100FixedSpotifyPlaylist } from "@/lib/global-100-playlist-sync";
import { syncGlobal100YouTubePlaylist, syncGlobalAirplayYouTubePlaylist } from "@/lib/youtube-user";
import { onChartPublished } from "@/lib/social/events";
import { sendGlobalWeeklyNotification } from "@/lib/global-weekly-notifications";
import { publishWeeklyEditorialPostForWeek } from "@/lib/weekly-editorial-post";

export type GlobalAdminAction =
  | "publish"
  | "recalculate"
  | "sync-spotify"
  | "sync-youtube"
  | "social-posts"
  | "editorial"
  | "notify"
  | "poll-close"
  | "communities"
  | "recalc-global100"
  | "recalc-airplay"
  | "recalc-albums"
  | "recalc-curators"
  | "recalc-genres";

export const GLOBAL_ADMIN_ACTIONS: GlobalAdminAction[] = [
  "publish",
  "recalculate",
  "sync-spotify",
  "sync-youtube",
  "social-posts",
  "editorial",
  "notify",
  "poll-close",
  "communities",
  "recalc-global100",
  "recalc-airplay",
  "recalc-albums",
  "recalc-curators",
  "recalc-genres",
];

function isValidWeekIndex(weekIndex: number): boolean {
  return Number.isFinite(weekIndex) && weekIndex >= GLOBAL_RANKING_FIRST_WEEK_INDEX;
}

async function weekMeta(weekIndex: number) {
  const slot = await getGlobalPublishSlot();
  const ref = getWeeklySnapshotReferenceDate(weekIndex, slot);
  const publishAt = new Date(getGlobalSnapshotDeadline(weekIndex, slot).getTime() + 60 * 60 * 1000);
  return {
    weekIndex,
    weekLabel: buildWeekLabelFromDate(ref),
    dateRange: buildDateRangeFromDate(ref),
    publishAt,
    slot,
  };
}

export async function getGlobalWeekStatus(weekIndex: number) {
  const meta = await weekMeta(weekIndex);
  const [global, airplay, albums, curators, genres, editorial, social] = await Promise.all([
    prisma.globalSnapshot.findUnique({
      where: { weekIndex },
      select: { weekLabel: true, frozenAt: true, youtubePlaylistId: true, createdAt: true },
    }),
    prisma.globalAirplaySnapshot.findUnique({
      where: { weekIndex },
      select: { weekLabel: true, frozenAt: true, youtubePlaylistId: true, contributorCount: true },
    }),
    prisma.globalAlbumsSnapshot.findUnique({
      where: { weekIndex },
      select: { weekLabel: true, frozenAt: true, contributorCount: true },
    }),
    prisma.curatorsSnapshot.findUnique({
      where: { weekIndex },
      select: { weekLabel: true, frozenAt: true },
    }),
    prisma.globalGenreSnapshot.count({ where: { weekIndex } }),
    prisma.editorialPost.findUnique({
      where: { slug: `panorama-global-100-semana-${weekIndex}` },
      select: { id: true, slug: true, publishedAt: true },
    }),
    prisma.socialPost.findMany({
      where: {
        entityId: String(weekIndex),
        eventType: {
          in: [
            SocialEventType.GLOBAL100_PUBLISHED,
            SocialEventType.AIRPLAY_PUBLISHED,
            SocialEventType.ALBUMS_CHART_PUBLISHED,
          ],
        },
      },
      select: { eventType: true, status: true, id: true },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  return {
    ...meta,
    snapshots: {
      global100: Boolean(global),
      airplay: Boolean(airplay),
      albums: Boolean(albums),
      curators: Boolean(curators),
      genreCount: genres,
    },
    playlists: {
      youtubeGlobal100: global?.youtubePlaylistId ?? null,
      youtubeAirplay: airplay?.youtubePlaylistId ?? null,
      spotifyFixed: true,
    },
    editorial: editorial ? { slug: editorial.slug, publishedAt: editorial.publishedAt.toISOString() } : null,
    socialPosts: social,
    labels: {
      global100: global?.weekLabel ?? meta.weekLabel,
      airplay: airplay?.weekLabel ?? null,
      albums: albums?.weekLabel ?? null,
    },
  };
}

export async function listAdminGlobalWeekOptions(limit = 24): Promise<
  Array<{ weekIndex: number; weekLabel: string; hasGlobal100: boolean }>
> {
  const slot = await getGlobalPublishSlot();
  const current = getRankingWeekReference(new Date(), slot);
  const rankingWeeks = await listGlobalRankingWeekIndexes();
  const snapshotWeeks = await prisma.globalSnapshot.findMany({
    select: { weekIndex: true, weekLabel: true },
    orderBy: { weekIndex: "desc" },
    take: limit,
  });
  const byIndex = new Map(snapshotWeeks.map((s) => [s.weekIndex, s.weekLabel]));
  if (!byIndex.has(current.weekIndex)) {
    byIndex.set(current.weekIndex, current.weekLabel);
  }
  const merged = [...new Set([current.weekIndex, ...rankingWeeks, ...snapshotWeeks.map((s) => s.weekIndex)])]
    .filter((w) => w >= GLOBAL_RANKING_FIRST_WEEK_INDEX)
    .sort((a, b) => b - a)
    .slice(0, limit);

  return merged.map((weekIndex) => ({
    weekIndex,
    weekLabel: byIndex.get(weekIndex) ?? `Semana ${weekIndex % 100} - ${Math.floor(weekIndex / 100)}`,
    hasGlobal100: snapshotWeeks.some((s) => s.weekIndex === weekIndex),
  }));
}

async function ensureSnapshots(weekIndex: number, force: boolean) {
  const existing = {
    global: await prisma.globalSnapshot.findUnique({ where: { weekIndex }, select: { weekIndex: true } }),
    airplay: await prisma.globalAirplaySnapshot.findUnique({ where: { weekIndex }, select: { weekIndex: true } }),
    albums: await prisma.globalAlbumsSnapshot.findUnique({ where: { weekIndex }, select: { weekIndex: true } }),
    curators: await prisma.curatorsSnapshot.findUnique({ where: { weekIndex }, select: { weekIndex: true } }),
  };

  const created = {
    global: false,
    airplay: false,
    albums: false,
    curators: false,
    genres: 0,
  };

  if (force || !existing.global) {
    await saveGlobalSnapshotForWeek(weekIndex, { skipDeadline: true });
    created.global = !existing.global;
  }
  if (force || !existing.airplay) {
    await saveGlobalLastfmSnapshotForWeek("airplay", weekIndex, { skipSpotifyFallback: true });
    created.airplay = !existing.airplay;
  }
  if (force || !existing.albums) {
    await saveGlobalLastfmSnapshotForWeek("albums", weekIndex, { skipSpotifyFallback: true });
    created.albums = !existing.albums;
  }
  if (force || !existing.curators) {
    await saveCuratorsSnapshotForWeek(weekIndex);
    created.curators = !existing.curators;
  }

  for (const chart of GLOBAL_GENRE_CHARTS) {
    const genreExisting = await prisma.globalGenreSnapshot.findUnique({
      where: { weekIndex_genreSlug: { weekIndex, genreSlug: chart.slug } },
      select: { weekIndex: true },
    });
    if (force || !genreExisting) {
      await saveGlobalGenreSnapshotForWeek(weekIndex, chart.slug);
      if (!genreExisting) created.genres += 1;
    }
  }

  return { created, force };
}

export async function runGlobalAdminAction(action: GlobalAdminAction, weekIndex: number) {
  if (!isValidWeekIndex(weekIndex)) {
    throw new Error(`weekIndex inválido (mínimo ${GLOBAL_RANKING_FIRST_WEEK_INDEX}).`);
  }

  const meta = await weekMeta(weekIndex);

  switch (action) {
    case "publish": {
      const snapshots = await ensureSnapshots(weekIndex, false);
      let weeklyPoll: Awaited<ReturnType<typeof closeWeeklySpotlightPoll>> | null = null;
      try {
        weeklyPoll = await closeWeeklySpotlightPoll(weekIndex);
      } catch (e) {
        console.error("[admin-global-ops] poll-close", e);
      }
      const communities = await publishAllCommunityLastfmSnapshots(meta.publishAt, { weekIndex }).catch((e) => ({
        communities: 0,
        created: 0,
        errors: [String(e)],
      }));
      const spotify = await syncGlobal100FixedSpotifyPlaylist(weekIndex);
      const youtube100 = await syncGlobal100YouTubePlaylist(weekIndex, meta.weekLabel);
      const youtubeAirplay = await syncGlobalAirplayYouTubePlaylist(weekIndex, meta.weekLabel);
      const social = {
        global100: snapshots.created.global ? await onChartPublished("GLOBAL100", weekIndex) : null,
        airplay: snapshots.created.airplay ? await onChartPublished("AIRPLAY", weekIndex) : null,
        albums: snapshots.created.albums ? await onChartPublished("ALBUMS", weekIndex) : null,
      };
      let notificationsSent = 0;
      if (snapshots.created.global) {
        notificationsSent += await sendGlobalWeeklyNotification(
          "global_chart",
          "/global/100",
          `A Parada Global (${meta.weekLabel}) foi publicada! Confira os resultados.`,
        );
      }
      if (snapshots.created.airplay) {
        notificationsSent += await sendGlobalWeeklyNotification(
          "global_airplay",
          "/global/airplay",
          `O Global 100 Air Play (${meta.weekLabel}) foi publicado! Veja o top de reproduções da semana.`,
        );
      }
      if (snapshots.created.albums) {
        notificationsSent += await sendGlobalWeeklyNotification(
          "global_albums",
          "/global/albums",
          `O Global 100 Álbuns (${meta.weekLabel}) foi publicado! Veja os discos mais ouvidos da semana.`,
        );
      }
      const editorial = await publishWeeklyEditorialPostForWeek(weekIndex).catch(() => null);
      return {
        action,
        weekIndex,
        weekLabel: meta.weekLabel,
        snapshots,
        weeklyPoll,
        communities,
        playlists: { spotify, youtube100, youtubeAirplay },
        social,
        notificationsSent,
        editorial,
      };
    }

    case "recalculate": {
      const snapshots = await ensureSnapshots(weekIndex, true);
      return { action, weekIndex, weekLabel: meta.weekLabel, snapshots };
    }

    case "sync-spotify": {
      const spotify = await syncGlobal100FixedSpotifyPlaylist(weekIndex);
      return { action, weekIndex, weekLabel: meta.weekLabel, spotify };
    }

    case "sync-youtube": {
      const youtube100 = await syncGlobal100YouTubePlaylist(weekIndex, meta.weekLabel);
      const youtubeAirplay = await syncGlobalAirplayYouTubePlaylist(weekIndex, meta.weekLabel);
      return { action, weekIndex, weekLabel: meta.weekLabel, youtube100, youtubeAirplay };
    }

    case "social-posts": {
      const social = {
        global100: await onChartPublished("GLOBAL100", weekIndex),
        airplay: await onChartPublished("AIRPLAY", weekIndex),
        albums: await onChartPublished("ALBUMS", weekIndex),
      };
      return { action, weekIndex, weekLabel: meta.weekLabel, social };
    }

    case "editorial": {
      const editorial = await publishWeeklyEditorialPostForWeek(weekIndex);
      return { action, weekIndex, weekLabel: meta.weekLabel, editorial };
    }

    case "notify": {
      const notificationsSent =
        (await sendGlobalWeeklyNotification(
          "global_chart",
          "/global/100",
          `A Parada Global (${meta.weekLabel}) foi publicada! Confira os resultados.`,
        )) +
        (await sendGlobalWeeklyNotification(
          "global_airplay",
          "/global/airplay",
          `O Global 100 Air Play (${meta.weekLabel}) foi publicado! Veja o top de reproduções da semana.`,
        )) +
        (await sendGlobalWeeklyNotification(
          "global_albums",
          "/global/albums",
          `O Global 100 Álbuns (${meta.weekLabel}) foi publicado! Veja os discos mais ouvidos da semana.`,
        ));
      return { action, weekIndex, weekLabel: meta.weekLabel, notificationsSent };
    }

    case "poll-close": {
      const weeklyPoll = await closeWeeklySpotlightPoll(weekIndex);
      return { action, weekIndex, weekLabel: meta.weekLabel, weeklyPoll };
    }

    case "communities": {
      const communities = await publishAllCommunityLastfmSnapshots(meta.publishAt, { weekIndex });
      return { action, weekIndex, weekLabel: meta.weekLabel, communities };
    }

    case "recalc-global100": {
      const saved = await saveGlobalSnapshotForWeek(weekIndex, { skipDeadline: true });
      return { action, weekIndex, weekLabel: saved.weekLabel };
    }

    case "recalc-airplay": {
      const saved = await saveGlobalLastfmSnapshotForWeek("airplay", weekIndex, {
        skipSpotifyFallback: true,
      });
      return {
        action,
        weekIndex,
        contributorCount: saved.payload.contributorCount,
        entries: saved.payload.entries.length,
      };
    }

    case "recalc-albums": {
      const saved = await saveGlobalLastfmSnapshotForWeek("albums", weekIndex, {
        skipSpotifyFallback: true,
      });
      return {
        action,
        weekIndex,
        contributorCount: saved.payload.contributorCount,
        entries: saved.payload.entries.length,
      };
    }

    case "recalc-curators": {
      const saved = await saveCuratorsSnapshotForWeek(weekIndex);
      return { action, weekIndex, weekLabel: saved.weekLabel, count: saved.entries.length };
    }

    case "recalc-genres": {
      const genres = [];
      for (const chart of GLOBAL_GENRE_CHARTS) {
        await saveGlobalGenreSnapshotForWeek(weekIndex, chart.slug);
        genres.push(chart.slug);
      }
      return { action, weekIndex, genres };
    }

    default:
      throw new Error(`Ação desconhecida: ${action}`);
  }
}

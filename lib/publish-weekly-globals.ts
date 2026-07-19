import { getOrCreateRankingWeekSnapshot } from "@/lib/global-snapshot";
import {
  getOrCreateGlobalLastfmSnapshot,
} from "@/lib/global-lastfm-snapshot";
import { getOrCreateCuratorsSnapshot } from "@/lib/curators-snapshot";
import { publishAllCommunityLastfmSnapshots } from "@/lib/community-lastfm";
import { publishAllCommunityOfficialWeeksFromMembers } from "@/lib/community-official-from-members";
import { publishGlobalGenreSnapshotsForRankingWeek } from "@/lib/global-genre-snapshot";
import { sendGlobalWeeklyNotification } from "@/lib/global-weekly-notifications";
import { syncGlobal100YouTubePlaylist, syncGlobalAirplayYouTubePlaylist } from "@/lib/youtube-user";
import { closeWeeklySpotlightPoll } from "@/lib/weekly-spotlight-poll";
import { syncGlobal100FixedSpotifyPlaylistSafely } from "@/lib/global-100-playlist-sync";
import { onChartPublished } from "@/lib/social/events";

/**
 * Publica rankings semanais congelados (Global 100, Airplay, Álbuns, Top Curadores) — só cria se ainda não existir.
 * Rodar apenas às terças; depois disso o ranking exibido em /global não muda até a próxima terça.
 */
export async function publishWeeklyGlobalRankings(now: Date = new Date()) {
  const global = await getOrCreateRankingWeekSnapshot(now);

  // Apura a enquete da semana (Melhor da Semana + Flashback) — vencedoras entram nos cards do Global 100
  let weeklyPoll: Awaited<ReturnType<typeof closeWeeklySpotlightPoll>> | null = null;
  try {
    weeklyPoll = await closeWeeklySpotlightPoll(global.weekIndex);
  } catch (e) {
    console.error("[publish-weekly-globals] closeWeeklySpotlightPoll", e);
  }

  const [airplay, albums, curators, genreSnapshots] = await Promise.all([
    getOrCreateGlobalLastfmSnapshot("airplay", now),
    getOrCreateGlobalLastfmSnapshot("albums", now),
    getOrCreateCuratorsSnapshot(now),
    publishGlobalGenreSnapshotsForRankingWeek(now),
  ]);

  // Airplay/Álbuns das comunidades: mesmo modelo do Global — congela na publicação
  // (create-only; se a semana já tem snapshot, não recalcula). Sequencial de propósito
  // pra não somar rajada de Spotify ao cálculo do Global que acabou de rodar.
  const communityLastfm = await publishAllCommunityLastfmSnapshots(now).catch((e) => {
    console.error("[publish-weekly-globals] publishAllCommunityLastfmSnapshots", e);
    return { communities: 0, created: 0, errors: [String(e)] };
  });

  // Parada oficial de músicas: snapshot create-only para TODAS as comunidades
  // (mesma regra do Global 100 — membro novo não reconta semanas já congeladas).
  const communityOfficial = await publishAllCommunityOfficialWeeksFromMembers(now).catch((e) => {
    console.error("[publish-weekly-globals] publishAllCommunityOfficialWeeksFromMembers", e);
    return {
      weekIndex: global.weekIndex,
      communities: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      empty: 0,
      results: [],
    };
  });

  syncGlobal100YouTubePlaylist(global.weekIndex, global.weekLabel).catch((e) =>
    console.error("[publish-weekly-globals] syncGlobal100YouTube", e),
  );
  syncGlobal100FixedSpotifyPlaylistSafely(global.weekIndex).catch((e) =>
    console.error("[publish-weekly-globals] syncGlobal100FixedSpotify", e),
  );
  syncGlobalAirplayYouTubePlaylist(airplay.weekIndex, airplay.weekLabel).catch((e) =>
    console.error("[publish-weekly-globals] syncGlobalAirplayYouTube", e),
  );

  let notificationsSent = 0;
  if (global.created) {
    notificationsSent += await sendGlobalWeeklyNotification(
      "global_chart",
      "/global/100",
      `A Parada Global (${global.weekLabel}) foi publicada! Confira os resultados.`,
    );
    onChartPublished("GLOBAL100", global.weekIndex).catch((e) => console.error("[publish-weekly-globals] onChartPublished GLOBAL100", e));
  }
  if (airplay.created) {
    notificationsSent += await sendGlobalWeeklyNotification(
      "global_airplay",
      "/global/airplay",
      `O Global 100 Air Play (${airplay.weekLabel}) foi publicado! Veja o top de reproduções da semana.`,
    );
    onChartPublished("AIRPLAY", airplay.weekIndex).catch((e) => console.error("[publish-weekly-globals] onChartPublished AIRPLAY", e));
  }
  if (albums.created) {
    notificationsSent += await sendGlobalWeeklyNotification(
      "global_albums",
      "/global/albums",
      `O Global 100 Álbuns (${albums.weekLabel}) foi publicado! Veja os discos mais ouvidos da semana.`,
    );
    onChartPublished("ALBUMS", albums.weekIndex).catch((e) => console.error("[publish-weekly-globals] onChartPublished ALBUMS", e));
  }

  return {
    global: {
      weekIndex: global.weekIndex,
      weekLabel: global.weekLabel,
      created: global.created,
    },
    airplay: {
      weekIndex: airplay.weekIndex,
      weekLabel: airplay.weekLabel,
      created: airplay.created,
    },
    albums: {
      weekIndex: albums.weekIndex,
      weekLabel: albums.weekLabel,
      created: albums.created,
    },
    curators: {
      weekIndex: curators.weekIndex,
      weekLabel: curators.weekLabel,
      created: curators.created,
      count: curators.entries.length,
    },
    genreSnapshots,
    communityLastfm,
    communityOfficial,
    weeklyPoll,
    notificationsSent,
  };
}

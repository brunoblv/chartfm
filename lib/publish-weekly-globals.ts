import { getOrCreateRankingWeekSnapshot } from "@/lib/global-snapshot";
import {
  getOrCreateGlobalLastfmSnapshot,
} from "@/lib/global-lastfm-snapshot";
import { sendGlobalWeeklyNotification } from "@/lib/global-weekly-notifications";
import { syncGlobal100YouTubePlaylist, syncGlobalAirplayYouTubePlaylist } from "@/lib/youtube-user";

/**
 * Publica rankings semanais congelados (Global 100, Airplay, Álbuns) — só cria se ainda não existir.
 * Rodar apenas às terças; depois disso o ranking exibido em /global não muda até a próxima terça.
 */
export async function publishWeeklyGlobalRankings(now: Date = new Date()) {
  const global = await getOrCreateRankingWeekSnapshot(now);
  const [airplay, albums] = await Promise.all([
    getOrCreateGlobalLastfmSnapshot("airplay", now),
    getOrCreateGlobalLastfmSnapshot("albums", now),
  ]);

  syncGlobal100YouTubePlaylist(global.weekIndex, global.weekLabel).catch((e) =>
    console.error("[publish-weekly-globals] syncGlobal100YouTube", e),
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
  }
  if (airplay.created) {
    notificationsSent += await sendGlobalWeeklyNotification(
      "global_airplay",
      "/global/airplay",
      `O Global 100 Air Play (${airplay.weekLabel}) foi publicado! Veja o top de reproduções da semana.`,
    );
  }
  if (albums.created) {
    notificationsSent += await sendGlobalWeeklyNotification(
      "global_albums",
      "/global/albums",
      `O Global 100 Álbuns (${albums.weekLabel}) foi publicado! Veja os discos mais ouvidos da semana.`,
    );
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
    notificationsSent,
  };
}

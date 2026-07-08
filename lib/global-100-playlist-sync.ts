/**
 * Atualiza a playlist FIXA do Global 100 no Spotify (@bruno) toda semana:
 * substitui as faixas e o título/descrição. Diferente das outras playlists
 * automáticas (Copa, YouTube), esta nunca é recriada — o ID é fixo
 * (`GLOBAL_100_FIXED_SPOTIFY_PLAYLIST_ID`).
 *
 * Usar apenas no servidor (Route Handlers / cron).
 */

import { GLOBAL_100_FIXED_SPOTIFY_PLAYLIST_ID } from "@/lib/mytrl-access";
import { resolveGlobalPlaylistTrackIds } from "@/lib/global-playlist-tracks";
import {
  getMyTrlOwnerUser,
  getSpotifyUserAccessToken,
  replaceTracksInSpotifyPlaylist,
  updateSpotifyPlaylistDetails,
} from "@/lib/spotify-user";

export type SyncGlobal100FixedPlaylistResult =
  | { ok: true; playlistId: string; trackCount: number }
  | { ok: false; message: string };

export async function syncGlobal100FixedSpotifyPlaylist(
  weekIndex: number,
): Promise<SyncGlobal100FixedPlaylistResult> {
  const owner = await getMyTrlOwnerUser();
  const token = owner?.id ? await getSpotifyUserAccessToken(owner.id) : null;
  if (!token) {
    return { ok: false, message: "Conta Spotify (@bruno) não conectada." };
  }

  let resolved: Awaited<ReturnType<typeof resolveGlobalPlaylistTrackIds>>;
  try {
    resolved = await resolveGlobalPlaylistTrackIds({ kind: "global100", weekIndex, period: "weekly" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parada global não encontrada.";
    return { ok: false, message };
  }

  const { trackIds, chartName, weekLabel, dateRange } = resolved;
  if (trackIds.length === 0) {
    return { ok: false, message: "Nenhuma música do Global 100 tem link com o Spotify." };
  }

  const playlistId = GLOBAL_100_FIXED_SPOTIFY_PLAYLIST_ID;
  const uris = trackIds.map((id) => `spotify:track:${id}`);

  const replaced = await replaceTracksInSpotifyPlaylist(token, playlistId, uris);
  if (!replaced.ok) {
    return { ok: false, message: replaced.message };
  }

  const name = `ChartFM · ${chartName} · ${weekLabel}`.slice(0, 100);
  const description = `Parada global do ChartFM · ${chartName} · ${dateRange}`.slice(0, 300);
  const renamed = await updateSpotifyPlaylistDetails(token, playlistId, name, description);
  if (!renamed.ok) {
    return { ok: false, message: renamed.message };
  }

  return { ok: true, playlistId, trackCount: trackIds.length };
}

// Wrapper que nunca lança: a atualização da playlist é "best effort" e não pode
// quebrar a publicação semanal do Global 100.
export async function syncGlobal100FixedSpotifyPlaylistSafely(weekIndex: number): Promise<void> {
  try {
    const result = await syncGlobal100FixedSpotifyPlaylist(weekIndex);
    if (!result.ok) {
      console.error("[global-100-playlist-sync]", result.message);
    }
  } catch (e) {
    console.error("[global-100-playlist-sync] falha ao atualizar playlist fixa", e);
  }
}

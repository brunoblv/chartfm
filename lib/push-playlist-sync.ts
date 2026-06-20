import { prisma } from "@/lib/prisma";
import { pushRoundTitle } from "@/lib/push-format";
import {
  addTracksToSpotifyPlaylist,
  createSpotifyPlaylist,
  getMyTrlOwnerUser,
  getSpotifyUserAccessToken,
  replaceTracksInSpotifyPlaylist,
} from "@/lib/spotify-user";
import { syncPushYouTubePlaylist, type PushTrackForYouTube } from "@/lib/youtube-user";

export type PlaylistSyncResult =
  | { ok: true; playlistId: string; playlistUrl: string }
  | { ok: false; message: string; needsReconnect?: boolean };

/** Cria ou atualiza a playlist Spotify do Push na conta @bruno. */
export async function syncPushSpotifyPlaylist(opts: {
  roundId: string;
  roundNumber: number;
  season: number;
  trackIds: string[];
}): Promise<PlaylistSyncResult> {
  if (opts.trackIds.length === 0) {
    return { ok: false, message: "Nenhuma música inscrita ainda." };
  }

  const ownerUser = await getMyTrlOwnerUser();
  const token = ownerUser?.id ? await getSpotifyUserAccessToken(ownerUser.id) : null;
  if (!token) {
    return {
      ok: false,
      needsReconnect: true,
      message: "Conta Spotify (@bruno) não conectada. Reconecte em Configurações.",
    };
  }

  const uris = opts.trackIds.map((id) => `spotify:track:${id}`);
  const round = await prisma.pushRound.findUnique({
    where: { id: opts.roundId },
    select: { spotifyPlaylistId: true },
  });

  const fixedId = process.env.PUSH_SPOTIFY_PLAYLIST_ID ?? null;
  const existingId = fixedId ?? round?.spotifyPlaylistId ?? null;

  if (existingId) {
    const result = await replaceTracksInSpotifyPlaylist(token, existingId, uris);
    if (!result.ok) {
      return { ok: false, message: result.message, needsReconnect: result.needsReconnect };
    }
    await prisma.pushRound.update({
      where: { id: opts.roundId },
      data: { spotifyPlaylistId: existingId },
    });
    return {
      ok: true,
      playlistId: existingId,
      playlistUrl: `https://open.spotify.com/playlist/${existingId}`,
    };
  }

  const playlistName = pushRoundTitle(opts.season, opts.roundNumber).slice(0, 100);
  const description = `Playlist do jogo Push no ChartFM · ${playlistName}`;

  const created = await createSpotifyPlaylist(token, playlistName, description, true);
  if (!created.ok) {
    return { ok: false, message: created.message, needsReconnect: created.needsReconnect };
  }

  const added = await addTracksToSpotifyPlaylist(token, created.id, uris);
  if (!added.ok) {
    return { ok: false, message: added.message, needsReconnect: added.needsReconnect };
  }

  await prisma.pushRound.update({
    where: { id: opts.roundId },
    data: { spotifyPlaylistId: created.id },
  });

  return { ok: true, playlistId: created.id, playlistUrl: created.url };
}

export type PhasePlaylistSyncReport = {
  spotify: PlaylistSyncResult | null;
  youtube: Awaited<ReturnType<typeof syncPushYouTubePlaylist>> | null;
};

/** Sincroniza Spotify e YouTube ao encerrar inscrições. */
export async function syncPushPlaylistsOnPhaseAdvance(opts: {
  roundId: string;
  roundNumber: number;
  season: number;
  trackIds: string[];
  tracks: PushTrackForYouTube[];
  existingYoutubePlaylistId: string | null;
}): Promise<PhasePlaylistSyncReport> {
  const report: PhasePlaylistSyncReport = { spotify: null, youtube: null };

  if (opts.trackIds.length === 0) return report;

  report.spotify = await syncPushSpotifyPlaylist({
    roundId: opts.roundId,
    roundNumber: opts.roundNumber,
    season: opts.season,
    trackIds: opts.trackIds,
  });

  if (!opts.existingYoutubePlaylistId) {
    report.youtube = await syncPushYouTubePlaylist({
      roundId: opts.roundId,
      roundNumber: opts.roundNumber,
      season: opts.season,
      tracks: opts.tracks,
    });
  }

  return report;
}

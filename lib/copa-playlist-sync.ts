/**
 * Geração automática das playlists "do dia" da Copa ChartFM (Spotify + YouTube).
 *
 * Cada dia de jogos (batchOrder 0..12) vira uma playlist com os singles em
 * disputa naquele dia. É chamada quando o lote do dia é aberto (cron de
 * agendamento ou botão Avançar Dia do admin). Idempotente: persiste o que
 * conseguir e completa o que faltar em execuções seguintes.
 *
 * Usar apenas no servidor (Route Handlers / cron).
 */

import { prisma } from "@/lib/prisma";
import { COPA_DAY_LABELS, fixtureBatchOrder } from "@/lib/copa";
import { COPA_FIXED_SPOTIFY_PLAYLIST_ID } from "@/lib/mytrl-access";
import {
  addTracksToSpotifyPlaylist,
  createBrunoAutoSpotifyPlaylist,
  getMyTrlOwnerUser,
  getSpotifyUserAccessToken,
  replaceTracksInSpotifyPlaylist,
  updateSpotifyPlaylistDetails,
} from "@/lib/spotify-user";
import { isSpotifyTrackId, searchSpotifyTracks } from "@/lib/spotify-server";
import {
  addVideosToYouTubePlaylist,
  createYouTubePlaylist,
  getPushYouTubeOwnerUser,
  getYouTubeAccessToken,
  resolveYouTubeVideoIds,
} from "@/lib/youtube-user";

type DayTrack = { songName: string; artistName: string; songId: string | null };

export type CopaDayPlaylistResult = {
  batchOrder: number;
  spotify: { ok: boolean; playlistId?: string; message?: string };
  youtube: { ok: boolean; playlistId?: string; message?: string };
};

// Reúne os singles em disputa nos jogos do dia (batchOrder), sem repetir.
async function collectDayTracks(copaId: string, batchOrder: number): Promise<DayTrack[]> {
  const fixtures = await prisma.copaFixture.findMany({
    where: { copaId },
    select: {
      phase: true,
      round: true,
      groupLetter: true,
      matchIndex: true,
      singleAIdx: true,
      singleBIdx: true,
      artistA: {
        select: { artistName: true, singles: { select: { slotIndex: true, songName: true, songId: true } } },
      },
      artistB: {
        select: { artistName: true, singles: { select: { slotIndex: true, songName: true, songId: true } } },
      },
    },
    orderBy: [{ phase: "asc" }, { groupLetter: "asc" }, { matchIndex: "asc" }],
  });

  const tracks: DayTrack[] = [];
  const seen = new Set<string>();
  const add = (artistName: string, single?: { songName: string; songId: string | null }) => {
    if (!single?.songName) return;
    const key = (single.songId ?? `${artistName}::${single.songName}`).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    tracks.push({ songName: single.songName, artistName, songId: single.songId });
  };

  for (const f of fixtures) {
    if (fixtureBatchOrder(f) !== batchOrder) continue;
    add(f.artistA.artistName, f.artistA.singles.find((s) => s.slotIndex === f.singleAIdx));
    add(f.artistB.artistName, f.artistB.singles.find((s) => s.slotIndex === f.singleBIdx));
  }
  return tracks;
}

// Resolve URIs do Spotify: usa o spotifyId da Song interna quando houver, senão
// busca por nome + artista. Deduplica por faixa.
async function resolveSpotifyUris(tracks: DayTrack[]): Promise<string[]> {
  const songIds = tracks.map((t) => t.songId).filter((v): v is string => Boolean(v));
  const songs = songIds.length
    ? await prisma.song.findMany({ where: { id: { in: songIds } }, select: { id: true, spotifyId: true } })
    : [];
  const spotifyBySong = new Map(songs.map((s) => [s.id, s.spotifyId]));

  const uris: string[] = [];
  const seen = new Set<string>();
  for (const t of tracks) {
    let spotifyId = t.songId ? spotifyBySong.get(t.songId) ?? null : null;
    if (!spotifyId || !isSpotifyTrackId(spotifyId)) {
      const hits = await searchSpotifyTracks(`${t.songName} ${t.artistName}`, 1);
      spotifyId = hits[0]?.spotifyId ?? null;
    }
    if (spotifyId && !seen.has(spotifyId)) {
      seen.add(spotifyId);
      uris.push(`spotify:track:${spotifyId}`);
    }
  }
  return uris;
}

export async function syncCopaDayPlaylists(
  copaId: string,
  batchOrder: number,
): Promise<CopaDayPlaylistResult | null> {
  if (batchOrder < 0 || batchOrder >= COPA_DAY_LABELS.length) return null;

  const dayLabel = COPA_DAY_LABELS[batchOrder];
  const existing = await prisma.copaDayPlaylist.findUnique({
    where: { copaId_batchOrder: { copaId, batchOrder } },
  });

  // Já temos as duas playlists: nada a fazer (caminho barato do cron horário).
  if (existing?.spotifyPlaylistId && existing?.youtubePlaylistId) {
    return {
      batchOrder,
      spotify: { ok: true, playlistId: existing.spotifyPlaylistId },
      youtube: { ok: true, playlistId: existing.youtubePlaylistId },
    };
  }

  const result: CopaDayPlaylistResult = {
    batchOrder,
    spotify: existing?.spotifyPlaylistId
      ? { ok: true, playlistId: existing.spotifyPlaylistId }
      : { ok: false },
    youtube: existing?.youtubePlaylistId
      ? { ok: true, playlistId: existing.youtubePlaylistId }
      : { ok: false },
  };

  const tracks = await collectDayTracks(copaId, batchOrder);
  if (tracks.length === 0) return result;

  const copa = await prisma.copaEdition.findUnique({ where: { id: copaId }, select: { name: true } });
  const title = `${copa?.name ?? "Copa ChartFM"} · ${dayLabel}`.slice(0, 100);

  let spotifyPlaylistId = existing?.spotifyPlaylistId ?? null;
  let youtubePlaylistId = existing?.youtubePlaylistId ?? null;
  let trackCount = existing?.trackCount ?? 0;

  // ── Spotify (conta @bruno) ────────────────────────────────────────────────
  if (!spotifyPlaylistId) {
    const owner = await getMyTrlOwnerUser();
    const token = owner?.id ? await getSpotifyUserAccessToken(owner.id) : null;
    if (!token) {
      result.spotify = { ok: false, message: "Conta Spotify (@bruno) não conectada." };
    } else {
      const uris = await resolveSpotifyUris(tracks);
      if (uris.length === 0) {
        result.spotify = { ok: false, message: "Nenhuma faixa encontrada no Spotify." };
      } else {
        const created = await createBrunoAutoSpotifyPlaylist(token, title, `Jogos do dia · ${dayLabel} · Copa ChartFM`);
        if (!created.ok) {
          result.spotify = { ok: false, message: created.message };
        } else {
          const added = await addTracksToSpotifyPlaylist(token, created.id, uris);
          if (!added.ok) {
            result.spotify = { ok: false, message: added.message };
          } else {
            spotifyPlaylistId = created.id;
            trackCount = Math.max(trackCount, uris.length);
            result.spotify = { ok: true, playlistId: created.id };
          }
        }
      }
    }
  }

  // ── YouTube (canal @chartFM) ──────────────────────────────────────────────
  if (!youtubePlaylistId) {
    const owner = await getPushYouTubeOwnerUser();
    const token = owner?.id ? await getYouTubeAccessToken(owner.id) : null;
    if (!token) {
      result.youtube = { ok: false, message: "Canal YouTube (@chartFM) não conectado." };
    } else {
      const { videoIds } = await resolveYouTubeVideoIds(
        tracks.map((t) => ({ title: t.songName, artist: t.artistName })),
      );
      if (videoIds.length === 0) {
        result.youtube = { ok: false, message: "Nenhum vídeo encontrado no YouTube." };
      } else {
        const created = await createYouTubePlaylist(token, title, `Jogos do dia · ${dayLabel} · youtube.com/@chartFM`);
        if (!created.ok) {
          result.youtube = { ok: false, message: created.message };
        } else {
          const added = await addVideosToYouTubePlaylist(token, created.data.id, videoIds);
          if (!added.ok) {
            result.youtube = { ok: false, message: added.message };
          } else {
            youtubePlaylistId = created.data.id;
            trackCount = Math.max(trackCount, videoIds.length);
            result.youtube = { ok: true, playlistId: created.data.id };
          }
        }
      }
    }
  }

  await prisma.copaDayPlaylist.upsert({
    where: { copaId_batchOrder: { copaId, batchOrder } },
    create: { copaId, batchOrder, dayLabel, spotifyPlaylistId, youtubePlaylistId, trackCount },
    update: { dayLabel, spotifyPlaylistId, youtubePlaylistId, trackCount },
  });

  return result;
}

// Wrapper que nunca lança: a geração de playlists é "best effort" e não pode
// quebrar o agendamento/avanço da Copa.
export async function generateCopaDayPlaylistsSafely(copaId: string, batchOrder: number): Promise<void> {
  try {
    await syncCopaDayPlaylists(copaId, batchOrder);
  } catch (e) {
    console.error("[copa] falha ao gerar playlists do dia", copaId, batchOrder, e);
  }
}

export type SyncCopaFixedPlaylistResult =
  | { ok: true; playlistId: string; trackCount: number }
  | { ok: false; message: string };

/**
 * Atualiza a playlist FIXA da Copa no Spotify (@bruno) a cada etapa/dia:
 * substitui as faixas e o título pelos singles em disputa no lote do dia
 * atual (batchOrder). Nunca recria a playlist — o ID é fixo
 * (`COPA_FIXED_SPOTIFY_PLAYLIST_ID`).
 */
export async function syncCopaFixedSpotifyPlaylist(
  copaId: string,
  batchOrder: number,
): Promise<SyncCopaFixedPlaylistResult> {
  if (batchOrder < 0 || batchOrder >= COPA_DAY_LABELS.length) {
    return { ok: false, message: "batchOrder inválido." };
  }

  const owner = await getMyTrlOwnerUser();
  const token = owner?.id ? await getSpotifyUserAccessToken(owner.id) : null;
  if (!token) {
    return { ok: false, message: "Conta Spotify (@bruno) não conectada." };
  }

  const tracks = await collectDayTracks(copaId, batchOrder);
  if (tracks.length === 0) {
    return { ok: false, message: "Nenhuma faixa em disputa neste lote." };
  }

  const uris = await resolveSpotifyUris(tracks);
  if (uris.length === 0) {
    return { ok: false, message: "Nenhuma faixa encontrada no Spotify." };
  }

  const playlistId = COPA_FIXED_SPOTIFY_PLAYLIST_ID;
  const replaced = await replaceTracksInSpotifyPlaylist(token, playlistId, uris);
  if (!replaced.ok) {
    return { ok: false, message: replaced.message };
  }

  const dayLabel = COPA_DAY_LABELS[batchOrder];
  const copa = await prisma.copaEdition.findUnique({ where: { id: copaId }, select: { name: true } });
  const name = `${copa?.name ?? "Copa ChartFM"} · ${dayLabel}`.slice(0, 100);
  const description = `Jogos do dia · ${dayLabel} · Copa ChartFM`.slice(0, 300);
  const renamed = await updateSpotifyPlaylistDetails(token, playlistId, name, description);
  if (!renamed.ok) {
    return { ok: false, message: renamed.message };
  }

  return { ok: true, playlistId, trackCount: uris.length };
}

// Wrapper que nunca lança: a atualização da playlist fixa é "best effort" e
// não pode quebrar o agendamento/avanço da Copa.
export async function syncCopaFixedSpotifyPlaylistSafely(copaId: string, batchOrder: number): Promise<void> {
  try {
    const result = await syncCopaFixedSpotifyPlaylist(copaId, batchOrder);
    if (!result.ok) {
      console.error("[copa-playlist-sync]", result.message);
    }
  } catch (e) {
    console.error("[copa-playlist-sync] falha ao atualizar playlist fixa", copaId, batchOrder, e);
  }
}

// Reúne os singles de TODOS os CopaArtist da edição (todas as rodadas, desde o
// início) — usado pela playlist "tudo desde o começo" da Copa Push.
async function collectAllCopaTracks(copaId: string): Promise<DayTrack[]> {
  const artists = await prisma.copaArtist.findMany({
    where: { copaId },
    select: { artistName: true, singles: { select: { slotIndex: true, songName: true, songId: true } } },
  });

  const tracks: DayTrack[] = [];
  const seen = new Set<string>();
  for (const artist of artists) {
    for (const single of artist.singles) {
      if (!single.songName) continue;
      const key = (single.songId ?? `${artist.artistName}::${single.songName}`).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tracks.push({ songName: single.songName, artistName: artist.artistName, songId: single.songId });
    }
  }
  return tracks;
}

export type SyncCopaPushFullPlaylistResult =
  | { ok: true; playlistId: string; trackCount: number }
  | { ok: false; message: string };

/**
 * Playlist fixa da Copa Push (@bruno), separada da playlist fixa da Copa normal:
 * em vez de trocar diariamente, contém TODAS as faixas de TODAS as rodadas desde
 * o início. Criada automaticamente na 1ª sincronização e o ID fica salvo em
 * `CopaEdition.pushSpotifyPlaylistId` (escopo por edição — não é reaproveitada
 * entre anos, diferente da playlist fixa global da Copa normal).
 */
export async function syncCopaPushFullSpotifyPlaylist(copaId: string): Promise<SyncCopaPushFullPlaylistResult> {
  const copa = await prisma.copaEdition.findUnique({
    where: { id: copaId },
    select: { name: true, pushSpotifyPlaylistId: true },
  });
  if (!copa) return { ok: false, message: "Copa não encontrada." };

  const owner = await getMyTrlOwnerUser();
  const token = owner?.id ? await getSpotifyUserAccessToken(owner.id) : null;
  if (!token) {
    return { ok: false, message: "Conta Spotify (@bruno) não conectada." };
  }

  const tracks = await collectAllCopaTracks(copaId);
  if (tracks.length === 0) {
    return { ok: false, message: "Nenhuma faixa cadastrada ainda." };
  }

  const uris = await resolveSpotifyUris(tracks);
  if (uris.length === 0) {
    return { ok: false, message: "Nenhuma faixa encontrada no Spotify." };
  }

  const title = `${copa.name} · Todas as músicas`.slice(0, 100);
  const description = `Todas as faixas em disputa na ${copa.name} (Copa Push) desde o início.`.slice(0, 300);

  let playlistId = copa.pushSpotifyPlaylistId;
  if (!playlistId) {
    const created = await createBrunoAutoSpotifyPlaylist(token, title, description);
    if (!created.ok) return { ok: false, message: created.message };
    playlistId = created.id;
    await prisma.copaEdition.update({ where: { id: copaId }, data: { pushSpotifyPlaylistId: playlistId } });
    const added = await addTracksToSpotifyPlaylist(token, playlistId, uris);
    if (!added.ok) return { ok: false, message: added.message };
    return { ok: true, playlistId, trackCount: uris.length };
  }

  const replaced = await replaceTracksInSpotifyPlaylist(token, playlistId, uris);
  if (!replaced.ok) return { ok: false, message: replaced.message };
  const renamed = await updateSpotifyPlaylistDetails(token, playlistId, title, description);
  if (!renamed.ok) return { ok: false, message: renamed.message };

  return { ok: true, playlistId, trackCount: uris.length };
}

// Wrapper que nunca lança: a atualização da playlist da Copa Push é "best
// effort" e não pode quebrar o agendamento/avanço da Copa.
export async function syncCopaPushFullSpotifyPlaylistSafely(copaId: string): Promise<void> {
  try {
    const result = await syncCopaPushFullSpotifyPlaylist(copaId);
    if (!result.ok) {
      console.error("[copa-playlist-sync]", result.message);
    }
  } catch (e) {
    console.error("[copa-playlist-sync] falha ao atualizar playlist da Copa Push", copaId, e);
  }
}

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
import {
  addTracksToSpotifyPlaylist,
  createSpotifyPlaylist,
  getMyTrlOwnerUser,
  getSpotifyUserAccessToken,
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
        const created = await createSpotifyPlaylist(token, title, `Jogos do dia · ${dayLabel} · Copa ChartFM`, true);
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

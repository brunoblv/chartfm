import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getWikipediaSongInfo, getWikipediaArtistBio } from "@/lib/wikipedia";
import {
  findRecordingMbidBySpotifyTrackId,
  getMusicBrainzReleaseDates,
  searchRecordingMbid,
  searchMusicBrainzArtistTags,
} from "@/lib/musicbrainz";
import { fetchAndSaveSongGenres, songEnrichmentPendingWhere, songGenresBackfillOrderBy } from "@/lib/resolve-song-genres";
import { getSpotifyArtistById, getSpotifyAlbumMetadataById, spotifyConfigured, probeSpotifyApi } from "@/lib/spotify-server";

/**
 * Backfill noturno único (cron 1h) que passa por músicas, álbuns e artistas
 * chamando as APIs externas já usadas nas ferramentas manuais do admin
 * (Wikipedia, MusicBrainz, Last.fm, Spotify), mas de forma automática e
 * contínua. Itens sem resultado em nenhuma fonte são marcados (*NotFoundAt)
 * para não voltarem a entrar na fila em dias seguintes — só saem de lá com
 * correção manual (editar o registro limpa a marcação, ver dados/lib.ts).
 *
 * Cada fonte já se autolimita (ver MIN_INTERVAL_MS em lib/wikipedia.ts e
 * lib/musicbrainz.ts); o loop aqui é sequencial (nunca paralelo) e Last.fm/
 * Spotify recebem uma pausa manual entre itens pela mesma razão.
 */

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Orçamento de tempo por etapa — evita que uma fonte lenta/instável consuma a
// janela inteira e impeça as demais de rodar na mesma noite.
const SONG_DATES_BUDGET_MS = 6 * 60_000;
const SONG_GENRES_BUDGET_MS = 6 * 60_000;
const ARTIST_BIOS_BUDGET_MS = 3 * 60_000;
const ARTIST_METADATA_BUDGET_MS = 3 * 60_000;
const ALBUM_METADATA_BUDGET_MS = 3 * 60_000;

const CHUNK_SIZE = 25;
const LASTFM_ITEM_DELAY_MS = 300;
const SPOTIFY_ITEM_DELAY_MS = 300;

export type NightlyBackfillStepResult = {
  step: string;
  processed: number;
  updated: number;
  notFound: number;
  skipped?: string;
};

export type NightlyBackfillReport = {
  startedAt: string;
  finishedAt: string;
  steps: NightlyBackfillStepResult[];
};

// ---------------------------------------------------------------------------
// 1) Músicas — datas de single/clipe (Wikipedia primeiro, MusicBrainz cai no que sobrar)
// Mesma lógica de app/api/admin/edicao-de-dados/backfill-dates/route.ts, para reuso no cron.
// ---------------------------------------------------------------------------

const semDatasBackfillWhere: Prisma.SongWhereInput = {
  AND: [{ OR: [{ singleReleaseDate: null }, { musicVideoReleaseDate: null }] }, { releaseDatesNotFoundAt: null }],
};

function sameDay(a: Date | null, b: Date): boolean {
  return a != null && a.getTime() === b.getTime();
}

async function backfillOneSongDates(song: {
  id: string;
  title: string;
  artist: string;
  spotifyId: string | null;
  recordingMbid: string | null;
  singleReleaseDate: Date | null;
  musicVideoReleaseDate: Date | null;
}): Promise<boolean> {
  const data: Record<string, unknown> = {};
  let single = song.singleReleaseDate;
  let mv = song.musicVideoReleaseDate;

  const wiki = await getWikipediaSongInfo(song.title, song.artist).catch(() => null);
  if (wiki?.singleReleaseDate && !sameDay(single, wiki.singleReleaseDate)) {
    data.singleReleaseDate = wiki.singleReleaseDate;
    single = wiki.singleReleaseDate;
  }
  if (wiki?.musicVideoReleaseDate && !sameDay(mv, wiki.musicVideoReleaseDate)) {
    data.musicVideoReleaseDate = wiki.musicVideoReleaseDate;
    mv = wiki.musicVideoReleaseDate;
  }

  if (!single || !mv) {
    let mbid = song.recordingMbid?.trim() || null;
    if (!mbid && song.spotifyId) mbid = await findRecordingMbidBySpotifyTrackId(song.spotifyId).catch(() => null);
    if (!mbid) mbid = await searchRecordingMbid(song.title, song.artist).catch(() => null);

    if (mbid) {
      if (!song.recordingMbid?.trim()) data.recordingMbid = mbid;
      const dates = await getMusicBrainzReleaseDates(mbid, { title: song.title, artist: song.artist }).catch(() => ({
        singleReleaseDate: null,
        musicVideoReleaseDate: null,
      }));
      if (!single && dates.singleReleaseDate) data.singleReleaseDate = dates.singleReleaseDate;
      if (!mv && dates.musicVideoReleaseDate) data.musicVideoReleaseDate = dates.musicVideoReleaseDate;
    }
  }

  if (Object.keys(data).length > 0) {
    await prisma.song.update({ where: { id: song.id }, data: { ...data, releaseDatesNotFoundAt: null } });
    return true;
  }
  await prisma.song.update({ where: { id: song.id }, data: { releaseDatesNotFoundAt: new Date() } });
  return false;
}

async function runSongDatesBackfill(): Promise<NightlyBackfillStepResult> {
  const deadline = Date.now() + SONG_DATES_BUDGET_MS;
  let processed = 0;
  let updated = 0;
  let notFound = 0;

  while (Date.now() < deadline) {
    const songs = await prisma.song.findMany({
      where: semDatasBackfillWhere,
      select: { id: true, title: true, artist: true, spotifyId: true, recordingMbid: true, singleReleaseDate: true, musicVideoReleaseDate: true },
      orderBy: [{ artist: "asc" }, { title: "asc" }],
      take: CHUNK_SIZE,
    });
    if (songs.length === 0) break;

    for (const song of songs) {
      if (Date.now() >= deadline) break;
      processed += 1;
      try {
        const ok = await backfillOneSongDates(song);
        if (ok) updated += 1;
        else notFound += 1;
      } catch {
        await prisma.song.update({ where: { id: song.id }, data: { releaseDatesNotFoundAt: new Date() } }).catch(() => null);
        notFound += 1;
      }
    }
  }

  return { step: "song_dates", processed, updated, notFound };
}

// ---------------------------------------------------------------------------
// 2) Músicas — gêneros (MusicBrainz → Last.fm → gêneros do artista)
// Reaproveita lib/resolve-song-genres.ts (mesma lógica do backfill manual em /admin/song-genres).
// ---------------------------------------------------------------------------

async function runSongGenresBackfill(): Promise<NightlyBackfillStepResult> {
  const deadline = Date.now() + SONG_GENRES_BUDGET_MS;
  let processed = 0;
  let updated = 0;

  while (Date.now() < deadline) {
    const songs = await prisma.song.findMany({
      where: songEnrichmentPendingWhere,
      select: { id: true },
      orderBy: songGenresBackfillOrderBy,
      take: CHUNK_SIZE,
    });
    if (songs.length === 0) break;

    for (const song of songs) {
      if (Date.now() >= deadline) break;
      processed += 1;
      try {
        const resolved = await fetchAndSaveSongGenres(prisma, song.id);
        if (resolved && resolved.genres.length > 0) updated += 1;
      } catch {
        // fetchAndSaveSongGenres já cai no fallback de gênero do artista internamente;
        // uma falha aqui é rede/timeout — o item permanece pendente e tenta de novo amanhã.
      }
      await sleep(LASTFM_ITEM_DELAY_MS);
    }
  }

  // Não há "notFound" aqui: genresFetchedAt sempre é gravado (mesmo com fallback vazio),
  // então o item já não reentra na fila — ver songEnrichmentPendingWhere.
  return { step: "song_genres", processed, updated, notFound: 0 };
}

// ---------------------------------------------------------------------------
// 3) Artistas — bio (Wikipedia)
// ---------------------------------------------------------------------------

const artistSemBioWhere: Prisma.ArtistWhereInput = {
  AND: [{ OR: [{ bio: null }, { bio: "" }] }, { bioNotFoundAt: null }],
};

async function runArtistBiosBackfill(): Promise<NightlyBackfillStepResult> {
  const deadline = Date.now() + ARTIST_BIOS_BUDGET_MS;
  let processed = 0;
  let updated = 0;
  let notFound = 0;

  while (Date.now() < deadline) {
    const artists = await prisma.artist.findMany({
      where: artistSemBioWhere,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: CHUNK_SIZE,
    });
    if (artists.length === 0) break;

    for (const artist of artists) {
      if (Date.now() >= deadline) break;
      processed += 1;
      try {
        const info = await getWikipediaArtistBio(artist.name);
        if (info) {
          await prisma.artist.update({ where: { id: artist.id }, data: { bio: info.bio, bioNotFoundAt: null } });
          updated += 1;
        } else {
          await prisma.artist.update({ where: { id: artist.id }, data: { bioNotFoundAt: new Date() } });
          notFound += 1;
        }
      } catch {
        await prisma.artist.update({ where: { id: artist.id }, data: { bioNotFoundAt: new Date() } }).catch(() => null);
        notFound += 1;
      }
    }
  }

  return { step: "artist_bios", processed, updated, notFound };
}

// ---------------------------------------------------------------------------
// 4) Artistas — metadados (imagem/link/gêneros via Spotify; MusicBrainz cobre gêneros que sobrarem)
// ---------------------------------------------------------------------------

const artistMetadataMissingWhere: Prisma.ArtistWhereInput = {
  AND: [{ OR: [{ imageUrl: null }, { spotifyUrl: null }, { genres: { isEmpty: true } }] }, { metadataNotFoundAt: null }],
};

async function backfillOneArtistMetadata(artist: { id: number; name: string; spotifyId: string; genres: string[] }): Promise<boolean> {
  const profile = await getSpotifyArtistById(artist.spotifyId);
  let foundAnything = false;
  const data: Record<string, unknown> = {};

  if (profile) {
    if (profile.imageUrl) {
      data.imageUrl = profile.imageUrl;
      foundAnything = true;
    }
    if (profile.spotifyUrl) {
      data.spotifyUrl = profile.spotifyUrl;
      foundAnything = true;
    }
    if (profile.genres.length > 0) {
      data.genres = profile.genres;
      foundAnything = true;
    }
  }

  if (!data.genres && artist.genres.length === 0) {
    const mb = await searchMusicBrainzArtistTags(artist.name).catch(() => null);
    if (mb?.tags.length) {
      data.genres = mb.tags;
      foundAnything = true;
    }
  }

  if (Object.keys(data).length > 0) {
    await prisma.artist.update({ where: { id: artist.id }, data: { ...data, metadataNotFoundAt: null } });
  }
  return foundAnything;
}

async function runArtistMetadataBackfill(): Promise<NightlyBackfillStepResult> {
  if (!spotifyConfigured()) return { step: "artist_metadata", processed: 0, updated: 0, notFound: 0, skipped: "Spotify não configurado" };
  const probe = await probeSpotifyApi();
  if (!probe.ok) return { step: "artist_metadata", processed: 0, updated: 0, notFound: 0, skipped: probe.error };

  const deadline = Date.now() + ARTIST_METADATA_BUDGET_MS;
  let processed = 0;
  let updated = 0;
  let notFound = 0;

  while (Date.now() < deadline) {
    const artists = await prisma.artist.findMany({
      where: artistMetadataMissingWhere,
      select: { id: true, name: true, spotifyId: true, genres: true },
      orderBy: { name: "asc" },
      take: CHUNK_SIZE,
    });
    if (artists.length === 0) break;

    for (const artist of artists) {
      if (Date.now() >= deadline) break;
      processed += 1;
      try {
        const ok = await backfillOneArtistMetadata(artist);
        if (ok) updated += 1;
        else {
          await prisma.artist.update({ where: { id: artist.id }, data: { metadataNotFoundAt: new Date() } });
          notFound += 1;
        }
      } catch {
        await prisma.artist.update({ where: { id: artist.id }, data: { metadataNotFoundAt: new Date() } }).catch(() => null);
        notFound += 1;
      }
      await sleep(SPOTIFY_ITEM_DELAY_MS);
    }
  }

  return { step: "artist_metadata", processed, updated, notFound };
}

// ---------------------------------------------------------------------------
// 5) Álbuns — metadados (capa/data/tipo/faixas via Spotify)
// ---------------------------------------------------------------------------

const albumMetadataMissingWhere: Prisma.AlbumWhereInput = {
  AND: [
    { OR: [{ coverUrl: null }, { coverUrl: "" }, { releaseDate: null }, { albumType: null }, { totalTracks: null }] },
    { metadataNotFoundAt: null },
  ],
};

async function backfillOneAlbumMetadata(album: { id: number; spotifyId: string }): Promise<boolean> {
  const meta = await getSpotifyAlbumMetadataById(album.spotifyId);
  if (!meta) return false;

  await prisma.album.update({
    where: { id: album.id },
    data: {
      title: meta.title ?? undefined,
      coverUrl: meta.coverUrl,
      albumType: meta.albumType ?? undefined,
      releaseDate: meta.releaseDate ?? undefined,
      spotifyUrl: meta.spotifyUrl,
      totalTracks: meta.totalTracks,
      metadataNotFoundAt: null,
    },
  });
  return true;
}

async function runAlbumMetadataBackfill(): Promise<NightlyBackfillStepResult> {
  if (!spotifyConfigured()) return { step: "album_metadata", processed: 0, updated: 0, notFound: 0, skipped: "Spotify não configurado" };
  const probe = await probeSpotifyApi();
  if (!probe.ok) return { step: "album_metadata", processed: 0, updated: 0, notFound: 0, skipped: probe.error };

  const deadline = Date.now() + ALBUM_METADATA_BUDGET_MS;
  let processed = 0;
  let updated = 0;
  let notFound = 0;

  while (Date.now() < deadline) {
    const albums = await prisma.album.findMany({
      where: albumMetadataMissingWhere,
      select: { id: true, spotifyId: true },
      orderBy: { title: "asc" },
      take: CHUNK_SIZE,
    });
    if (albums.length === 0) break;

    for (const album of albums) {
      if (Date.now() >= deadline) break;
      processed += 1;
      try {
        const ok = await backfillOneAlbumMetadata(album);
        if (ok) updated += 1;
        else {
          await prisma.album.update({ where: { id: album.id }, data: { metadataNotFoundAt: new Date() } });
          notFound += 1;
        }
      } catch {
        await prisma.album.update({ where: { id: album.id }, data: { metadataNotFoundAt: new Date() } }).catch(() => null);
        notFound += 1;
      }
      await sleep(SPOTIFY_ITEM_DELAY_MS);
    }
  }

  return { step: "album_metadata", processed, updated, notFound };
}

// ---------------------------------------------------------------------------

/** Roda as 5 etapas em sequência (nunca em paralelo, por causa do rate limit das fontes externas). */
export async function runNightlyCatalogBackfill(): Promise<NightlyBackfillReport> {
  const startedAt = new Date().toISOString();
  const steps: NightlyBackfillStepResult[] = [];

  steps.push(await runSongDatesBackfill());
  steps.push(await runSongGenresBackfill());
  steps.push(await runArtistBiosBackfill());
  steps.push(await runArtistMetadataBackfill());
  steps.push(await runAlbumMetadataBackfill());

  return { startedAt, finishedAt: new Date().toISOString(), steps };
}

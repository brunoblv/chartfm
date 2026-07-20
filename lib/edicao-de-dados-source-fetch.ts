import { prisma } from "@/lib/prisma";
import { songDataWithOptionalDatesNotFoundClear } from "@/app/admin/dados/lib";
import { applySpotifyMetadataToSong } from "@/lib/apply-spotify-metadata-to-song";
import {
  getSpotifyAlbumMetadataById,
  getSpotifyArtistById,
  getSpotifyTrackMetadataById,
  probeSpotifyApi,
  spotifyConfigured,
} from "@/lib/spotify-server";
import { findSpotifyTrackForSong } from "@/lib/spotify-track-match";
import {
  findRecordingMbidBySpotifyTrackId,
  getCoverArtArchiveUrl,
  getMusicBrainzAlbumForRecording,
  getMusicBrainzRecordingTags,
  getMusicBrainzReleaseDates,
  searchMusicBrainzAlbumReleaseDate,
  searchMusicBrainzArtistTags,
  searchRecordingMbid,
} from "@/lib/musicbrainz";
import {
  fetchLastfmAlbumTags,
  fetchLastfmArtistTags,
  fetchLastfmTrackTags,
} from "@/lib/lastfm-track-tags";
import {
  getWikipediaAlbumInfo,
  getWikipediaArtistBio,
  getWikipediaSongInfo,
} from "@/lib/wikipedia";
import { lookupBugsAlbum, lookupBugsRelease } from "@/lib/bugs-lookup";
import {
  deezerRecordTypeToAlbumType,
  getDeezerAlbumById,
  getDeezerTrackByIsrc,
  searchDeezerAlbum,
  searchDeezerArtist,
  searchDeezerTrack,
} from "@/lib/deezer";

/**
 * Fonte por registro: consulta UMA fonte (Last.fm, Spotify, MusicBrainz,
 * Wikipedia ou Bugs) e preenche só os campos vazios. Compartilhado entre os
 * botões individuais por linha (SourceFetchButtons) e o backfill em lote por
 * fonte (SourceBatchBackfillClient). Exceção: datas de single/clipe (músicas)
 * e data de lançamento (álbuns) da Wikipedia SOBRESCREVEM valores divergentes
 * — quando divergir, vale a da Wikipedia.
 *
 * Bugs (music.bugs.co.kr) é API não-oficial (mobile), boa cobertura de kpop:
 * cobre capa/data de single/data de álbum/data de clipe. Grupos de kpop às
 * vezes só são encontrados pelo nome nativo coreano no Bugs (ex.: BTS =
 * 방탄소년단) — quando o match de artista não é confirmado, o resultado só é
 * reportado (found), sem gravar no banco, para não sujar dados por colisão
 * de nome.
 *
 * Cada fonte que não aplica nada de novo (nada encontrado, ou encontrado mas
 * já presente no banco) fica marcada em `sourcesNotFound` — a próxima chamada
 * pula essa fonte sem bater na API, a menos que `opts.force` seja passado.
 * Só um resultado que efetivamente grava algo novo limpa a marcação.
 */

export type Source = "lastfm" | "spotify" | "musicbrainz" | "wikipedia" | "bugs" | "deezer";
/** "Todas as APIs" não inclui Bugs — cobertura só é boa para música asiática (kpop/jpop/cpop/tpop); rodar via fonte dedicada no filtro "Música asiática". */
export const ALL_SOURCES: Source[] = ["spotify", "musicbrainz", "lastfm", "wikipedia", "deezer"];

function fmtDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/** Entidade envolvida num conflito de ID/unicidade (para UI de merge). */
export type SourceConflictEntity = {
  id: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  spotifyId: string | null;
  entriesCount: number;
};

export type SourceConflict = {
  kind: "music" | "albums" | "artists";
  /** Ex.: spotify_id_conflict, title_artist_conflict */
  reason: string;
  label: string;
  current: SourceConflictEntity;
  other: SourceConflictEntity;
};

export type FetchResult = {
  found: string[];
  applied: string[];
  link?: string;
  /** true quando a fonte já estava marcada como sem resultado e foi pulada (sem bater na API). */
  skipped?: boolean;
  /** Quando a aplicação falhou por duplicata — UI pode oferecer merge. */
  conflict?: SourceConflict;
};

const nothing: FetchResult = { found: [], applied: [] };
const deezerBlockedBySpotify: FetchResult = {
  found: ["Spotify ainda não tentado (ou disponível) — rode Spotify antes do Deezer"],
  applied: [],
  // não persiste em sourcesNotFound: é um bloqueio temporário, não um "sem resultado" do Deezer.
  skipped: true,
};

/**
 * Deezer é fallback do Spotify, nunca corre por cima: só é consultado quando
 * o Spotify já foi tentado sem resultado (`sourcesNotFound` inclui
 * "spotify"), está indisponível (não configurado) ou está em rate limit
 * (429) no momento. Evita que o Deezer preencha um campo antes do Spotify
 * ter a chance — como nenhuma fonte sobrescreve campo já preenchido, quem
 * chega primeiro "trava" o valor.
 */
async function spotifyBlocksDeezer(sourcesNotFound: string[], force: boolean | undefined): Promise<boolean> {
  if (force) return false; // FORÇAR ignora a prioridade do Spotify também
  if (!spotifyConfigured()) return false;
  if (sourcesNotFound.includes("spotify")) return false;
  const probe = await probeSpotifyApi();
  if (!probe.ok) return false; // 429, credencial ou rede — trata como indisponível, não bloqueia
  return true;
}

async function loadSongConflictEntity(id: string): Promise<SourceConflictEntity | null> {
  const song = await prisma.song.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      artist: true,
      spotifyId: true,
      albumRef: { select: { coverUrl: true } },
      _count: { select: { entries: true } },
    },
  });
  if (!song) return null;
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    coverUrl: song.albumRef?.coverUrl ?? null,
    spotifyId: song.spotifyId,
    entriesCount: song._count.entries,
  };
}

async function loadAlbumConflictEntity(id: number): Promise<SourceConflictEntity | null> {
  const album = await prisma.album.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      spotifyId: true,
      coverUrl: true,
      artist: { select: { name: true } },
      _count: { select: { songs: true } },
    },
  });
  if (!album) return null;
  return {
    id: String(album.id),
    title: album.title,
    artist: album.artist.name,
    coverUrl: album.coverUrl,
    spotifyId: album.spotifyId,
    entriesCount: album._count.songs,
  };
}

async function loadArtistConflictEntity(id: number): Promise<SourceConflictEntity | null> {
  const artist = await prisma.artist.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      spotifyId: true,
      imageUrl: true,
      _count: { select: { songs: true } },
    },
  });
  if (!artist) return null;
  return {
    id: String(artist.id),
    title: artist.name,
    artist: artist.name,
    coverUrl: artist.imageUrl,
    spotifyId: artist.spotifyId,
    entriesCount: artist._count.songs,
  };
}

/** Monta payload de conflito song↔song a partir do reason `*_conflict:<id>`. */
export async function buildSongSourceConflict(
  currentId: string,
  reason: string,
): Promise<SourceConflict | null> {
  const match = reason.match(/^([a-z0-9_]+_conflict):(.+)$/i);
  if (!match) return null;
  const conflictReason = match[1];
  const otherId = match[2].trim();
  if (!otherId) return null;

  const [current, other] = await Promise.all([
    loadSongConflictEntity(currentId),
    loadSongConflictEntity(otherId),
  ]);
  if (!current || !other) return null;

  const labels: Record<string, string> = {
    spotify_id_conflict: "Spotify ID já vinculado a outra música",
    title_artist_conflict: "Já existe música com o mesmo título e artista",
  };

  return {
    kind: "music",
    reason: conflictReason,
    label: labels[conflictReason] ?? `Conflito: ${conflictReason.replaceAll("_", " ")}`,
    current,
    other,
  };
}

export async function buildAlbumSourceConflict(
  currentId: number,
  otherId: number,
  reason: string,
  label: string,
): Promise<SourceConflict | null> {
  const [current, other] = await Promise.all([
    loadAlbumConflictEntity(currentId),
    loadAlbumConflictEntity(otherId),
  ]);
  if (!current || !other) return null;
  return { kind: "albums", reason, label, current, other };
}

export async function buildArtistSourceConflict(
  currentId: number,
  otherId: number,
  reason: string,
  label: string,
): Promise<SourceConflict | null> {
  const [current, other] = await Promise.all([
    loadArtistConflictEntity(currentId),
    loadArtistConflictEntity(otherId),
  ]);
  if (!current || !other) return null;
  return { kind: "artists", reason, label, current, other };
}

/** Persiste a marcação de "sem resultado" por fonte, só quando o estado muda. */
async function persistSourceOutcome(
  update: (sourcesNotFound: string[]) => Promise<unknown>,
  currentList: string[],
  source: Source,
  appliedSomething: boolean,
) {
  const has = currentList.includes(source);
  if (appliedSomething && has) {
    await update(currentList.filter((s) => s !== source));
  } else if (!appliedSomething && !has) {
    await update([...currentList, source]);
  }
}

// ---------------------------------------------------------------------------
// Músicas
// ---------------------------------------------------------------------------

export async function fetchForSong(
  songId: string,
  source: Source,
  opts?: { force?: boolean },
): Promise<FetchResult | { error: string }> {
  const song = await prisma.song.findUnique({
    where: { id: songId },
    select: {
      id: true,
      title: true,
      artist: true,
      album: true,
      spotifyId: true,
      recordingMbid: true,
      isrc: true,
      genres: true,
      singleReleaseDate: true,
      musicVideoReleaseDate: true,
      sourcesNotFound: true,
    },
  });
  if (!song) return { error: "not_found" };

  if (!opts?.force && song.sourcesNotFound.includes(source)) {
    return { found: [], applied: [], skipped: true };
  }

  const outcome = await (async (): Promise<FetchResult | { error: string }> => {
    if (source === "spotify") {
      if (!spotifyConfigured()) return { error: "spotify_nao_configurado" };
      let spotifyId = song.spotifyId;
      if (!spotifyId) {
        // Só aceita faixa em álbum/single do próprio artista (nunca coletânea)
        // e valida título+artista; tenta variantes de query e mercados BR→US.
        const hit = await findSpotifyTrackForSong(song.title, song.artist, { maxAttempts: 1 });
        spotifyId = hit?.spotifyId ?? null;
      }
      if (!spotifyId) return nothing;
      const meta = await getSpotifyTrackMetadataById(spotifyId, "BR", { maxAttempts: 1 });
      if (!meta) return nothing;
      const result = await applySpotifyMetadataToSong(song.id, meta, false);
      if (result.ok) {
        return {
          found: [`faixa "${meta.title}" no Spotify`],
          applied: ["metadados do Spotify (álbum, capa, duração, links)"],
        };
      }
      const conflict = await buildSongSourceConflict(song.id, result.reason);
      return {
        found: [`faixa "${meta.title}" no Spotify`],
        applied: conflict ? [] : [`não aplicado: ${result.reason}`],
        conflict: conflict ?? undefined,
      };
    }

    if (source === "musicbrainz") {
      let mbid = song.recordingMbid?.trim() || null;
      if (!mbid && song.spotifyId) mbid = await findRecordingMbidBySpotifyTrackId(song.spotifyId);
      if (!mbid) mbid = await searchRecordingMbid(song.title, song.artist);
      if (!mbid) return nothing;

      const found: string[] = [];
      const applied: string[] = [];
      const data: Record<string, unknown> = {};

      if (!song.recordingMbid?.trim()) {
        data.recordingMbid = mbid;
        applied.push("MBID");
      }
      found.push(`MBID ${mbid.slice(0, 8)}…`);

      const dates = await getMusicBrainzReleaseDates(mbid, { title: song.title, artist: song.artist });
      if (dates.singleReleaseDate) {
        found.push(`single: ${fmtDate(dates.singleReleaseDate)}`);
        if (!song.singleReleaseDate) {
          data.singleReleaseDate = dates.singleReleaseDate;
          applied.push("data do single");
        }
      }
      if (dates.musicVideoReleaseDate) {
        found.push(`clipe: ${fmtDate(dates.musicVideoReleaseDate)}`);
        if (!song.musicVideoReleaseDate) {
          data.musicVideoReleaseDate = dates.musicVideoReleaseDate;
          applied.push("data do clipe");
        }
      }

      if (song.genres.length === 0) {
        const rec = await getMusicBrainzRecordingTags(mbid);
        if (rec?.tags.length) {
          found.push(`tags: ${rec.tags.slice(0, 5).join(", ")}`);
          data.genres = rec.tags;
          data.genreSource = "musicbrainz";
          applied.push("gêneros");
        }
      }

      if (!song.album?.trim()) {
        const albumHit = await getMusicBrainzAlbumForRecording(mbid, { title: song.title, artist: song.artist });
        if (albumHit) {
          found.push(`álbum: ${albumHit.title}`);
          data.album = albumHit.title;
          applied.push("álbum");
        }
      }

      if (Object.keys(data).length > 0) {
        await prisma.song.update({
          where: { id: song.id },
          data: songDataWithOptionalDatesNotFoundClear(data),
        });
      }
      return {
        found,
        applied,
        link: `https://musicbrainz.org/recording/${mbid}`,
      };
    }

    if (source === "lastfm") {
      const result = await fetchLastfmTrackTags(song.title, song.artist, song.recordingMbid);
      if (!result) return nothing;
      const found = [`tags: ${result.tags.slice(0, 6).join(", ")}`];
      const applied: string[] = [];
      if (song.genres.length === 0) {
        await prisma.song.update({
          where: { id: song.id },
          data: { genres: result.tags, genreSource: "lastfm" },
        });
        applied.push("gêneros");
      }
      return { found, applied };
    }

    if (source === "deezer") {
      if (await spotifyBlocksDeezer(song.sourcesNotFound, opts?.force)) return deezerBlockedBySpotify;

      // ISRC é o match mais confiável (sem ambiguidade de nome); título+artista é o fallback.
      const track = song.isrc
        ? await getDeezerTrackByIsrc(song.isrc)
        : await searchDeezerTrack(song.title, song.artist);
      if (!track) return nothing;

      const found: string[] = [`faixa "${track.title}" no Deezer`];
      const applied: string[] = [];
      const data: Record<string, unknown> = {};

      if (!song.album?.trim() && track.albumTitle) {
        found.push(`álbum: ${track.albumTitle}`);
        data.album = track.albumTitle;
        applied.push("álbum");
      }
      if (track.releaseDate) {
        found.push(`lançamento: ${fmtDate(track.releaseDate)}`);
        if (!song.singleReleaseDate) {
          data.singleReleaseDate = track.releaseDate;
          applied.push("data do single");
        }
      }
      if (song.genres.length === 0 && track.albumId) {
        const albumDetail = await getDeezerAlbumById(track.albumId);
        if (albumDetail?.genres.length) {
          found.push(`gêneros: ${albumDetail.genres.slice(0, 5).join(", ")}`);
          data.genres = albumDetail.genres;
          data.genreSource = "deezer";
          applied.push("gêneros");
        }
      }

      if (Object.keys(data).length > 0) {
        await prisma.song.update({
          where: { id: song.id },
          data: songDataWithOptionalDatesNotFoundClear(data),
        });
      }
      return { found, applied, link: track.link ?? undefined };
    }

    if (source === "bugs") {
      const result = await lookupBugsRelease(song.title, song.artist);
      if (!result.matches.length) return nothing;

      const found: string[] = [`${result.matches.length} lançamento(s) no Bugs`];
      const applied: string[] = [];
      const data: Record<string, unknown> = {};

      if (result.singleReleaseDate) {
        found.push(`single: ${result.singleReleaseDate}`);
        if (!song.singleReleaseDate) {
          data.singleReleaseDate = new Date(result.singleReleaseDate);
          applied.push("data do single");
        }
      }
      if (result.clipReleaseDate) {
        found.push(`clipe: ${result.clipReleaseDate}`);
        if (!song.musicVideoReleaseDate) {
          data.musicVideoReleaseDate = new Date(result.clipReleaseDate);
          applied.push("data do clipe");
        }
      }
      if (!result.artistConfirmed) {
        // Busca já inclui o artista na query — grupos de kpop costumam estar
        // indexados só pelo nome nativo no Bugs, então o match de artista
        // falha mesmo quando o título bateu certo; título é sinal suficiente.
        found.push("⚠ artista não confirmado no Bugs (nome nativo?) — conferir manualmente se houver dúvida");
      }
      if (Object.keys(data).length > 0) {
        await prisma.song.update({
          where: { id: song.id },
          data: songDataWithOptionalDatesNotFoundClear(data),
        });
      }
      const linkAlbumId = result.matches[0]?.albumId;
      return { found, applied, link: linkAlbumId ? `https://music.bugs.co.kr/album/${linkAlbumId}` : undefined };
    }

    // wikipedia — fonte de confiança para datas: quando a data no banco vier de
    // upload tardio (ex.: clipe postado no YouTube anos depois), a da Wikipedia
    // é a correta. Diferente das outras fontes, aqui a data divergente SOBRESCREVE.
    const info = await getWikipediaSongInfo(song.title, song.artist);
    if (!info) return nothing;
    const found: string[] = [];
    const applied: string[] = [];
    const data: Record<string, unknown> = {};

    const sameDay = (a: Date | null, b: Date) => a != null && a.getTime() === b.getTime();

    if (info.releasedDates.length) {
      found.push(`lançamentos: ${info.releasedDates.map(fmtDate).join(", ")}`);
    }
    if (info.singleReleaseDate) {
      found.push(`single (mais antiga): ${fmtDate(info.singleReleaseDate)}`);
      if (!sameDay(song.singleReleaseDate, info.singleReleaseDate)) {
        data.singleReleaseDate = info.singleReleaseDate;
        applied.push(
          song.singleReleaseDate
            ? `data do single corrigida (${fmtDate(song.singleReleaseDate)} → ${fmtDate(info.singleReleaseDate)})`
            : "data do single",
        );
      }
    }
    if (info.musicVideoReleaseDate) {
      found.push(`clipe: ${fmtDate(info.musicVideoReleaseDate)}`);
      if (!sameDay(song.musicVideoReleaseDate, info.musicVideoReleaseDate)) {
        data.musicVideoReleaseDate = info.musicVideoReleaseDate;
        applied.push(
          song.musicVideoReleaseDate
            ? `data do clipe corrigida (${fmtDate(song.musicVideoReleaseDate)} → ${fmtDate(info.musicVideoReleaseDate)})`
            : "data do clipe",
        );
      }
    }
    if (Object.keys(data).length > 0) {
      await prisma.song.update({
        where: { id: song.id },
        data: songDataWithOptionalDatesNotFoundClear(data),
      });
    }
    return { found, applied, link: info.pageUrl };
  })();

  if (!("error" in outcome) && !outcome.skipped) {
    // Conflito não gravou nada — não limpa sourcesNotFound; "não aplicado:" também não conta.
    const appliedSomething =
      !outcome.conflict &&
      outcome.applied.some((a) => !a.startsWith("não aplicado"));
    await persistSourceOutcome(
      (sourcesNotFound) => prisma.song.update({ where: { id: song.id }, data: { sourcesNotFound } }),
      song.sourcesNotFound,
      source,
      appliedSomething,
    );
  }
  return outcome;
}

// ---------------------------------------------------------------------------
// Álbuns
// ---------------------------------------------------------------------------

export async function fetchForAlbum(
  albumId: number,
  source: Source,
  opts?: { force?: boolean },
): Promise<FetchResult | { error: string }> {
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: {
      id: true,
      title: true,
      spotifyId: true,
      coverUrl: true,
      releaseDate: true,
      albumType: true,
      totalTracks: true,
      spotifyUrl: true,
      label: true,
      sourcesNotFound: true,
      artist: { select: { name: true } },
    },
  });
  if (!album) return { error: "not_found" };

  if (!opts?.force && album.sourcesNotFound.includes(source)) {
    return { found: [], applied: [], skipped: true };
  }

  const outcome = await (async (): Promise<FetchResult | { error: string }> => {
    if (source === "spotify") {
      if (!spotifyConfigured()) return { error: "spotify_nao_configurado" };
      const meta = await getSpotifyAlbumMetadataById(album.spotifyId, "MX", { maxAttempts: 1 });
      if (!meta) return nothing;
      const found: string[] = [`álbum no Spotify`];
      const applied: string[] = [];
      const data: Record<string, unknown> = {};
      if (!album.coverUrl?.trim() && meta.coverUrl) {
        data.coverUrl = meta.coverUrl;
        applied.push("capa");
      }
      if (!album.releaseDate && meta.releaseDate) {
        data.releaseDate = meta.releaseDate;
        applied.push(`data (${fmtDate(meta.releaseDate)})`);
      }
      if (!album.albumType && meta.albumType) {
        data.albumType = meta.albumType;
        applied.push("tipo");
      }
      if (album.totalTracks == null && meta.totalTracks != null) {
        data.totalTracks = meta.totalTracks;
        applied.push("faixas");
      }
      if (!album.spotifyUrl && meta.spotifyUrl) {
        data.spotifyUrl = meta.spotifyUrl;
        applied.push("link");
      }
      if (meta.releaseDate) found.push(`data: ${fmtDate(meta.releaseDate)}`);
      if (Object.keys(data).length > 0) await prisma.album.update({ where: { id: album.id }, data });
      return { found, applied };
    }

    if (source === "musicbrainz") {
      const result = await searchMusicBrainzAlbumReleaseDate(album.title, album.artist.name);
      if (!result) return nothing;
      const found: string[] = [`release-group ${result.mbid.slice(0, 8)}…`];
      const applied: string[] = [];
      const data: Record<string, unknown> = {};
      if (result.releaseDate) {
        found.push(`data: ${fmtDate(result.releaseDate)}`);
        if (!album.releaseDate) {
          data.releaseDate = result.releaseDate;
          applied.push("data de lançamento");
        }
      }
      if (!album.coverUrl?.trim()) {
        const coverUrl = await getCoverArtArchiveUrl(result.mbid);
        if (coverUrl) {
          found.push("capa");
          data.coverUrl = coverUrl;
          applied.push("capa");
        }
      }
      if (Object.keys(data).length > 0) await prisma.album.update({ where: { id: album.id }, data });
      return { found, applied, link: `https://musicbrainz.org/release-group/${result.mbid}` };
    }

    if (source === "lastfm") {
      const tags = await fetchLastfmAlbumTags(album.title, album.artist.name);
      if (!tags) return nothing;
      // álbum não tem campo de gêneros no schema — informação só para conferência
      return { found: [`tags: ${tags.slice(0, 6).join(", ")}`], applied: [] };
    }

    if (source === "deezer") {
      if (await spotifyBlocksDeezer(album.sourcesNotFound, opts?.force)) return deezerBlockedBySpotify;

      const result = await searchDeezerAlbum(album.title, album.artist.name);
      if (!result) return nothing;
      const found: string[] = [`álbum "${result.title}" no Deezer`];
      const applied: string[] = [];
      const data: Record<string, unknown> = {};

      if (!album.coverUrl?.trim() && result.coverUrl) {
        data.coverUrl = result.coverUrl;
        applied.push("capa");
      }
      if (!album.releaseDate && result.releaseDate) {
        data.releaseDate = result.releaseDate;
        applied.push(`data (${fmtDate(result.releaseDate)})`);
      }
      if (!album.albumType) {
        const mapped = deezerRecordTypeToAlbumType(result.recordType);
        if (mapped) {
          data.albumType = mapped;
          applied.push("tipo");
        }
      }
      if (album.totalTracks == null && result.totalTracks != null) {
        data.totalTracks = result.totalTracks;
        applied.push("faixas");
      }
      if (!album.label?.trim() && result.label) {
        data.label = result.label;
        applied.push("selo");
      }
      if (result.releaseDate) found.push(`data: ${fmtDate(result.releaseDate)}`);
      if (Object.keys(data).length > 0) await prisma.album.update({ where: { id: album.id }, data });
      return { found, applied, link: result.link ?? undefined };
    }

    if (source === "bugs") {
      const result = await lookupBugsAlbum(album.title, album.artist.name);
      if (!result.match) return nothing;

      const found: string[] = [`álbum "${result.match.albumTitle}" no Bugs`];
      const applied: string[] = [];
      const data: Record<string, unknown> = {};

      if (result.releaseDate) {
        found.push(`data: ${result.releaseDate}`);
        if (!album.releaseDate) {
          data.releaseDate = new Date(result.releaseDate);
          applied.push(`data (${result.releaseDate})`);
        }
      }
      if (result.cover) {
        found.push("capa");
        if (!album.coverUrl?.trim()) {
          data.coverUrl = result.cover;
          applied.push("capa");
        }
      }
      if (!result.artistConfirmed) {
        found.push("⚠ artista não confirmado no Bugs (nome nativo?) — conferir manualmente se houver dúvida");
      }
      if (Object.keys(data).length > 0) await prisma.album.update({ where: { id: album.id }, data });
      return { found, applied, link: `https://music.bugs.co.kr/album/${result.match.albumId}` };
    }

    // wikipedia — mesma regra das músicas: data divergente SOBRESCREVE.
    // Antes só preenchia se releaseDate estivesse null; álbuns com data errada
    // do Spotify/MB nunca eram corrigidos e ainda entravam em sourcesNotFound.
    const info = await getWikipediaAlbumInfo(album.title, album.artist.name);
    if (!info) return nothing;
    const found: string[] = [];
    const applied: string[] = [];
    const sameDay = (a: Date | null, b: Date) => a != null && a.getTime() === b.getTime();
    if (info.releaseDate) {
      found.push(`data: ${fmtDate(info.releaseDate)}`);
      if (!sameDay(album.releaseDate, info.releaseDate)) {
        await prisma.album.update({ where: { id: album.id }, data: { releaseDate: info.releaseDate } });
        applied.push(
          album.releaseDate
            ? `data corrigida (${fmtDate(album.releaseDate)} → ${fmtDate(info.releaseDate)})`
            : "data de lançamento",
        );
      }
    }
    return { found, applied, link: info.pageUrl };
  })();

  if (!("error" in outcome) && !outcome.skipped) {
    await persistSourceOutcome(
      (sourcesNotFound) => prisma.album.update({ where: { id: album.id }, data: { sourcesNotFound } }),
      album.sourcesNotFound,
      source,
      outcome.applied.length > 0,
    );
  }
  return outcome;
}

// ---------------------------------------------------------------------------
// Artistas
// ---------------------------------------------------------------------------

export async function fetchForArtist(
  artistId: number,
  source: Source,
  opts?: { force?: boolean },
): Promise<FetchResult | { error: string }> {
  const artist = await prisma.artist.findUnique({
    where: { id: artistId },
    select: {
      id: true,
      name: true,
      spotifyId: true,
      imageUrl: true,
      spotifyUrl: true,
      genres: true,
      bio: true,
      sourcesNotFound: true,
    },
  });
  if (!artist) return { error: "not_found" };

  if (!opts?.force && artist.sourcesNotFound.includes(source)) {
    return { found: [], applied: [], skipped: true };
  }

  const outcome = await (async (): Promise<FetchResult | { error: string }> => {
    if (source === "spotify") {
      if (!spotifyConfigured()) return { error: "spotify_nao_configurado" };
      const profile = await getSpotifyArtistById(artist.spotifyId, { maxAttempts: 1 });
      if (!profile) return nothing;
      const found: string[] = [`perfil "${profile.name}" no Spotify`];
      const applied: string[] = [];
      const data: Record<string, unknown> = {};
      if (!artist.imageUrl?.trim() && profile.imageUrl) {
        data.imageUrl = profile.imageUrl;
        applied.push("imagem");
      }
      if (artist.genres.length === 0 && profile.genres.length > 0) {
        data.genres = profile.genres;
        applied.push("gêneros");
      }
      if (!artist.spotifyUrl && profile.spotifyUrl) {
        data.spotifyUrl = profile.spotifyUrl;
        applied.push("link");
      }
      if (profile.genres.length) found.push(`gêneros: ${profile.genres.slice(0, 5).join(", ")}`);
      if (Object.keys(data).length > 0) await prisma.artist.update({ where: { id: artist.id }, data });
      return { found, applied };
    }

    if (source === "lastfm") {
      const tags = await fetchLastfmArtistTags(artist.name);
      if (!tags) return nothing;
      const found = [`tags: ${tags.slice(0, 6).join(", ")}`];
      const applied: string[] = [];
      if (artist.genres.length === 0) {
        await prisma.artist.update({ where: { id: artist.id }, data: { genres: tags } });
        applied.push("gêneros");
      }
      return { found, applied };
    }

    if (source === "musicbrainz") {
      const result = await searchMusicBrainzArtistTags(artist.name);
      if (!result) return nothing;
      const found = [`artista "${result.name}"`];
      const applied: string[] = [];
      if (result.tags.length) {
        found.push(`tags: ${result.tags.slice(0, 6).join(", ")}`);
        if (artist.genres.length === 0) {
          await prisma.artist.update({ where: { id: artist.id }, data: { genres: result.tags } });
          applied.push("gêneros");
        }
      }
      return { found, applied, link: `https://musicbrainz.org/artist/${result.mbid}` };
    }

    if (source === "deezer") {
      if (await spotifyBlocksDeezer(artist.sourcesNotFound, opts?.force)) return deezerBlockedBySpotify;

      const result = await searchDeezerArtist(artist.name);
      if (!result) return nothing;
      const found = [`perfil "${result.name}" no Deezer`];
      const applied: string[] = [];
      const data: Record<string, unknown> = {};
      if (!artist.imageUrl?.trim() && result.imageUrl) {
        data.imageUrl = result.imageUrl;
        applied.push("imagem");
      }
      if (Object.keys(data).length > 0) await prisma.artist.update({ where: { id: artist.id }, data });
      return { found, applied, link: result.link ?? undefined };
    }

    if (source === "bugs") {
      // Bugs não tem bio/gêneros de artista úteis aqui — só capa/datas de
      // faixa e álbum (ver fetchForSong/fetchForAlbum).
      return nothing;
    }

    // wikipedia
    const info = await getWikipediaArtistBio(artist.name);
    if (!info) return nothing;
    const found = [`bio (${info.lang}): "${info.bio.slice(0, 120)}…"`];
    const applied: string[] = [];
    if (!artist.bio?.trim()) {
      await prisma.artist.update({ where: { id: artist.id }, data: { bio: info.bio } });
      applied.push("bio");
    }
    return { found, applied, link: info.pageUrl };
  })();

  if (!("error" in outcome) && !outcome.skipped) {
    await persistSourceOutcome(
      (sourcesNotFound) => prisma.artist.update({ where: { id: artist.id }, data: { sourcesNotFound } }),
      artist.sourcesNotFound,
      source,
      outcome.applied.length > 0,
    );
  }
  return outcome;
}

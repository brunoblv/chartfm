import { prisma } from "@/lib/prisma";
import { songDataWithOptionalDatesNotFoundClear } from "@/app/admin/dados/lib";
import { applySpotifyMetadataToSong } from "@/lib/apply-spotify-metadata-to-song";
import {
  getSpotifyAlbumMetadataById,
  getSpotifyArtistById,
  getSpotifyTrackMetadataById,
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

/**
 * Fonte por registro: consulta UMA fonte (Last.fm, Spotify, MusicBrainz,
 * Wikipedia ou Bugs) e preenche só os campos vazios. Compartilhado entre os
 * botões individuais por linha (SourceFetchButtons) e o backfill em lote por
 * fonte (SourceBatchBackfillClient). Exceção: datas de single/clipe da
 * Wikipedia SOBRESCREVEM valores divergentes (datas de YouTube podem ser de
 * repostagens anos depois — quando divergir, vale a da Wikipedia).
 *
 * Bugs (music.bugs.co.kr) é API não-oficial (mobile), boa cobertura de kpop:
 * cobre capa/data de single/data de álbum/data de clipe. Grupos de kpop às
 * vezes só são encontrados pelo nome nativo coreano no Bugs (ex.: BTS =
 * 방탄소년단) — quando o match de artista não é confirmado, o resultado só é
 * reportado (found), sem gravar no banco, para não sujar dados por colisão
 * de nome.
 *
 * Cada fonte sem resultado fica marcada em `sourcesNotFound` — a próxima
 * chamada pula essa fonte sem bater na API, a menos que `opts.force` seja
 * passado. Um resultado (mesmo sem nada a aplicar) limpa a marcação.
 */

export type Source = "lastfm" | "spotify" | "musicbrainz" | "wikipedia" | "bugs";
export const ALL_SOURCES: Source[] = ["spotify", "musicbrainz", "lastfm", "wikipedia", "bugs"];

function fmtDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export type FetchResult = {
  found: string[];
  applied: string[];
  link?: string;
  /** true quando a fonte já estava marcada como sem resultado e foi pulada (sem bater na API). */
  skipped?: boolean;
};

const nothing: FetchResult = { found: [], applied: [] };

/** Persiste a marcação de "sem resultado" por fonte, só quando o estado muda. */
async function persistSourceOutcome(
  update: (sourcesNotFound: string[]) => Promise<unknown>,
  currentList: string[],
  source: Source,
  found: boolean,
) {
  const has = currentList.includes(source);
  if (found && has) {
    await update(currentList.filter((s) => s !== source));
  } else if (!found && !has) {
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
      return {
        found: [`faixa "${meta.title}" no Spotify`],
        applied: result.ok ? ["metadados do Spotify (álbum, capa, duração, links)"] : [`não aplicado: ${result.reason}`],
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

    if (source === "bugs") {
      const result = await lookupBugsRelease(song.title, song.artist);
      if (!result.matches.length) return nothing;

      const found: string[] = [`${result.matches.length} lançamento(s) no Bugs`];
      const applied: string[] = [];
      const data: Record<string, unknown> = {};

      if (result.singleReleaseDate) {
        found.push(`single: ${result.singleReleaseDate}`);
        if (result.artistConfirmed && !song.singleReleaseDate) {
          data.singleReleaseDate = new Date(result.singleReleaseDate);
          applied.push("data do single");
        }
      }
      if (result.clipReleaseDate) {
        found.push(`clipe: ${result.clipReleaseDate}`);
        if (result.artistConfirmed && !song.musicVideoReleaseDate) {
          data.musicVideoReleaseDate = new Date(result.clipReleaseDate);
          applied.push("data do clipe");
        }
      }
      if (!result.artistConfirmed) {
        found.push("⚠ artista não confirmado (nome nativo?) — não gravado, conferir manualmente");
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

  if (!("error" in outcome)) {
    await persistSourceOutcome(
      (sourcesNotFound) => prisma.song.update({ where: { id: song.id }, data: { sourcesNotFound } }),
      song.sourcesNotFound,
      source,
      outcome.found.length > 0,
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

    if (source === "bugs") {
      const result = await lookupBugsAlbum(album.title, album.artist.name);
      if (!result.match) return nothing;

      const found: string[] = [`álbum "${result.match.albumTitle}" no Bugs`];
      const applied: string[] = [];
      const data: Record<string, unknown> = {};

      if (result.releaseDate) {
        found.push(`data: ${result.releaseDate}`);
        if (result.artistConfirmed && !album.releaseDate) {
          data.releaseDate = new Date(result.releaseDate);
          applied.push(`data (${result.releaseDate})`);
        }
      }
      if (result.cover) {
        found.push("capa");
        if (result.artistConfirmed && !album.coverUrl?.trim()) {
          data.coverUrl = result.cover;
          applied.push("capa");
        }
      }
      if (!result.artistConfirmed) {
        found.push("⚠ artista não confirmado (nome nativo?) — não gravado, conferir manualmente");
      }
      if (Object.keys(data).length > 0) await prisma.album.update({ where: { id: album.id }, data });
      return { found, applied, link: `https://music.bugs.co.kr/album/${result.match.albumId}` };
    }

    // wikipedia
    const info = await getWikipediaAlbumInfo(album.title, album.artist.name);
    if (!info) return nothing;
    const found: string[] = [];
    const applied: string[] = [];
    if (info.releaseDate) {
      found.push(`data: ${fmtDate(info.releaseDate)}`);
      if (!album.releaseDate) {
        await prisma.album.update({ where: { id: album.id }, data: { releaseDate: info.releaseDate } });
        applied.push("data de lançamento");
      }
    }
    return { found, applied, link: info.pageUrl };
  })();

  if (!("error" in outcome)) {
    await persistSourceOutcome(
      (sourcesNotFound) => prisma.album.update({ where: { id: album.id }, data: { sourcesNotFound } }),
      album.sourcesNotFound,
      source,
      outcome.found.length > 0,
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

  if (!("error" in outcome)) {
    await persistSourceOutcome(
      (sourcesNotFound) => prisma.artist.update({ where: { id: artist.id }, data: { sourcesNotFound } }),
      artist.sourcesNotFound,
      source,
      outcome.found.length > 0,
    );
  }
  return outcome;
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { songDataWithOptionalDatesNotFoundClear } from "@/app/admin/dados/lib";
import { applySpotifyMetadataToSong } from "@/lib/apply-spotify-metadata-to-song";
import {
  getSpotifyAlbumMetadataById,
  getSpotifyArtistById,
  getSpotifyTrackMetadataById,
  searchSpotifyTracks,
  spotifyConfigured,
} from "@/lib/spotify-server";
import {
  findRecordingMbidBySpotifyTrackId,
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

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Botões por fonte da tela /admin/dados: consulta UMA fonte para UM registro
 * e preenche os campos que estão vazios. Exceção: datas de single/clipe da
 * Wikipedia SOBRESCREVEM valores divergentes (datas de YouTube podem ser de
 * repostagens anos depois — quando divergir, vale a da Wikipedia).
 * Devolve o que foi encontrado e o que foi aplicado, para o admin conferir.
 */

type Source = "lastfm" | "spotify" | "musicbrainz" | "wikipedia";

function fmtDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

type FetchResult = {
  found: string[];
  applied: string[];
  link?: string;
};

const nothing: FetchResult = { found: [], applied: [] };

// ---------------------------------------------------------------------------
// Músicas
// ---------------------------------------------------------------------------

async function fetchForSong(songId: string, source: Source): Promise<FetchResult | { error: string }> {
  const song = await prisma.song.findUnique({
    where: { id: songId },
    select: {
      id: true,
      title: true,
      artist: true,
      spotifyId: true,
      recordingMbid: true,
      genres: true,
      singleReleaseDate: true,
      musicVideoReleaseDate: true,
    },
  });
  if (!song) return { error: "not_found" };

  if (source === "spotify") {
    if (!spotifyConfigured()) return { error: "spotify_nao_configurado" };
    let spotifyId = song.spotifyId;
    if (!spotifyId) {
      const tracks = await searchSpotifyTracks(`${song.title} ${song.artist}`, 5);
      spotifyId = tracks[0]?.spotifyId ?? null;
    }
    if (!spotifyId) return nothing;
    const meta = await getSpotifyTrackMetadataById(spotifyId);
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
}

// ---------------------------------------------------------------------------
// Álbuns
// ---------------------------------------------------------------------------

async function fetchForAlbum(albumId: number, source: Source): Promise<FetchResult | { error: string }> {
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
      artist: { select: { name: true } },
    },
  });
  if (!album) return { error: "not_found" };

  if (source === "spotify") {
    if (!spotifyConfigured()) return { error: "spotify_nao_configurado" };
    const meta = await getSpotifyAlbumMetadataById(album.spotifyId);
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
    if (result.releaseDate) {
      found.push(`data: ${fmtDate(result.releaseDate)}`);
      if (!album.releaseDate) {
        await prisma.album.update({ where: { id: album.id }, data: { releaseDate: result.releaseDate } });
        applied.push("data de lançamento");
      }
    }
    return { found, applied, link: `https://musicbrainz.org/release-group/${result.mbid}` };
  }

  if (source === "lastfm") {
    const tags = await fetchLastfmAlbumTags(album.title, album.artist.name);
    if (!tags) return nothing;
    // álbum não tem campo de gêneros no schema — informação só para conferência
    return { found: [`tags: ${tags.slice(0, 6).join(", ")}`], applied: [] };
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
}

// ---------------------------------------------------------------------------
// Artistas
// ---------------------------------------------------------------------------

async function fetchForArtist(artistId: number, source: Source): Promise<FetchResult | { error: string }> {
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
    },
  });
  if (!artist) return { error: "not_found" };

  if (source === "spotify") {
    if (!spotifyConfigured()) return { error: "spotify_nao_configurado" };
    const profile = await getSpotifyArtistById(artist.spotifyId);
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
}

// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    kind?: unknown;
    id?: unknown;
    source?: unknown;
  };
  const source = body.source;
  if (source !== "lastfm" && source !== "spotify" && source !== "musicbrainz" && source !== "wikipedia") {
    return NextResponse.json({ error: "invalid_source" }, { status: 400 });
  }

  try {
    let result: FetchResult | { error: string };
    if (body.kind === "music" && typeof body.id === "string" && body.id.trim()) {
      result = await fetchForSong(body.id.trim(), source);
    } else if (body.kind === "albums" && Number.isInteger(Number(body.id))) {
      result = await fetchForAlbum(Number(body.id), source);
    } else if (body.kind === "artists" && Number.isInteger(Number(body.id))) {
      result = await fetchForArtist(Number(body.id), source);
    } else {
      return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
    }

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 400 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch_failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

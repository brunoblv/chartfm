import { isInstrumentalTitle } from "@/lib/is-instrumental-title";
import { prisma } from "@/lib/prisma";
import { enrichSongMetadataAfterSave } from "@/lib/resolve-song-genres";
import { getSpotifyArtistById, type SpotifyTrackMetadata } from "@/lib/spotify-server";

export type UpsertedSongSummary = {
  id: string;
  title: string;
  artist: string;
  spotifyId: string | null;
  trackNumber: number | null;
};

export type UpsertSongFromMetadataResult =
  | { ok: true; song: UpsertedSongSummary }
  | { ok: false; error: string; status: number };

/**
 * Cria ou atualiza uma `Song` (e artistas/álbum relacionados) a partir dos metadados oficiais do Spotify.
 */
export async function upsertSongFromSpotifyMetadata(
  metadata: SpotifyTrackMetadata,
  opts?: { albumTitleFallback?: string },
): Promise<UpsertSongFromMetadataResult> {
  const tid = metadata.spotifyId.trim();
  if (!tid) return { ok: false, error: "missing_track_spotify_id", status: 400 };
  if (isInstrumentalTitle(metadata.title)) {
    return { ok: false, error: "Faixas instrumentais não podem ser importadas do Spotify.", status: 400 };
  }

  const albumFallback = opts?.albumTitleFallback?.trim() || "Álbum";
  const primaryArtist = metadata.primaryArtist;
  const albumSpotifyId = metadata.album.spotifyId ?? null;
  const resolvedTitle = metadata.title;
  const mainArtistName = primaryArtist?.name?.trim() || metadata.artists?.[0]?.name?.trim() || metadata.artistDisplay;

  // Catálogo Confiável: artista já completo (foto + gêneros) e atualizado há menos
  // de 30 dias não gera chamada ao Spotify nem reescrita da linha.
  const ARTIST_FRESH_MS = 30 * 24 * 60 * 60 * 1000;
  async function artistIsFreshInCatalog(spotifyId: string): Promise<boolean> {
    const existing = await prisma.artist.findUnique({
      where: { spotifyId },
      select: { imageUrl: true, genres: true, updatedAt: true },
    });
    return Boolean(
      existing?.imageUrl &&
        existing.genres.length > 0 &&
        Date.now() - existing.updatedAt.getTime() < ARTIST_FRESH_MS,
    );
  }

  async function spotifyArtistProfile(spotifyId: string) {
    return getSpotifyArtistById(spotifyId);
  }

  async function upsertArtistFromSpotify(artist: { spotifyId: string; name: string; spotifyUrl?: string | null }) {
    if (await artistIsFreshInCatalog(artist.spotifyId)) return;
    const profile = await spotifyArtistProfile(artist.spotifyId);
    await prisma.artist.upsert({
      where: { spotifyId: artist.spotifyId },
      update: {
        name: profile?.name ?? artist.name,
        genres: profile?.genres ?? [],
        spotifyUrl: (profile?.spotifyUrl ?? artist.spotifyUrl) ?? undefined,
        ...(profile?.imageUrl ? { imageUrl: profile.imageUrl } : {}),
      },
      create: {
        spotifyId: artist.spotifyId,
        name: profile?.name ?? artist.name,
        genres: profile?.genres ?? [],
        spotifyUrl: (profile?.spotifyUrl ?? artist.spotifyUrl) ?? null,
        imageUrl: profile?.imageUrl ?? null,
      },
    });
  }

  if (primaryArtist) {
    await upsertArtistFromSpotify(primaryArtist);
  }

  if (primaryArtist && albumSpotifyId) {
    await prisma.album.upsert({
      where: { spotifyId: albumSpotifyId },
      update: {
        title: metadata.album.title ?? albumFallback,
        artistSpotifyId: primaryArtist.spotifyId,
        albumType: metadata.album.albumType ?? undefined,
        releaseDate: metadata.album.releaseDate ?? undefined,
        coverUrl: metadata.album.coverUrl ?? undefined,
        spotifyUrl: metadata.album.spotifyUrl ?? undefined,
        totalTracks: metadata.album.totalTracks ?? undefined,
      },
      create: {
        spotifyId: albumSpotifyId,
        title: metadata.album.title ?? albumFallback,
        artistSpotifyId: primaryArtist.spotifyId,
        albumType: metadata.album.albumType ?? undefined,
        releaseDate: metadata.album.releaseDate ?? undefined,
        coverUrl: metadata.album.coverUrl ?? null,
        spotifyUrl: metadata.album.spotifyUrl ?? null,
        totalTracks: metadata.album.totalTracks ?? null,
      },
    });
  }

  const existingByName = await prisma.song.findFirst({
    where: { title: resolvedTitle, artist: mainArtistName },
    select: { id: true, spotifyId: true, albumSpotifyId: true },
  });

  const albumLabel = metadata.album.title ?? albumFallback;

  let song: UpsertedSongSummary;

  if (existingByName) {
    const updated = await prisma.song.update({
      where: { id: existingByName.id },
      data: {
        ...(existingByName.spotifyId == null ? { spotifyId: tid } : {}),
        album: albumLabel,
        artistSpotifyId: primaryArtist?.spotifyId ?? undefined,
        albumSpotifyId: albumSpotifyId ?? undefined,
        durationMs: metadata.durationMs ?? undefined,
        previewUrl: metadata.previewUrl ?? undefined,
        spotifyUrl: metadata.spotifyUrl ?? undefined,
        trackNumber: metadata.trackNumber ?? undefined,
        isrc: metadata.isrc ?? undefined,
      },
      select: { id: true, title: true, artist: true, spotifyId: true, trackNumber: true },
    });
    song = updated;
  } else {
    const upserted = await prisma.song.upsert({
      where: { spotifyId: tid },
      update: {
        title: resolvedTitle,
        artist: mainArtistName,
        album: albumLabel,
        artistSpotifyId: primaryArtist?.spotifyId ?? undefined,
        albumSpotifyId: albumSpotifyId ?? undefined,
        durationMs: metadata.durationMs ?? undefined,
        previewUrl: metadata.previewUrl ?? undefined,
        spotifyUrl: metadata.spotifyUrl ?? undefined,
        trackNumber: metadata.trackNumber ?? undefined,
        isrc: metadata.isrc ?? undefined,
      },
      create: {
        title: resolvedTitle,
        artist: mainArtistName,
        album: albumLabel,
        spotifyId: tid,
        artistSpotifyId: primaryArtist?.spotifyId ?? null,
        albumSpotifyId,
        durationMs: metadata.durationMs ?? null,
        previewUrl: metadata.previewUrl ?? null,
        spotifyUrl: metadata.spotifyUrl ?? null,
        trackNumber: metadata.trackNumber ?? null,
        isrc: metadata.isrc ?? null,
      },
      select: { id: true, title: true, artist: true, spotifyId: true, trackNumber: true },
    });
    song = upserted;
  }

  const sid = song.spotifyId?.trim();
  if (sid) {
    const featured = metadata.featuredArtists ?? [];
    const featIds = new Set<string>();
    for (const feat of featured) {
      featIds.add(feat.spotifyId);
      await upsertArtistFromSpotify(feat);
      await prisma.songFeat.upsert({
        where: {
          songSpotifyId_artistSpotifyId: {
            songSpotifyId: sid,
            artistSpotifyId: feat.spotifyId,
          },
        },
        update: {},
        create: {
          songSpotifyId: sid,
          artistSpotifyId: feat.spotifyId,
        },
      });
    }
    await prisma.songFeat.deleteMany({
      where: {
        songSpotifyId: sid,
        ...(featIds.size ? { artistSpotifyId: { notIn: [...featIds] } } : {}),
      },
    });
  }

  enrichSongMetadataAfterSave(song.id);

  return { ok: true, song };
}

import { prisma } from "./prisma";
import { enrichSongMetadataAfterSave } from "@/lib/resolve-song-genres";
import { getSpotifyArtistById, type SpotifyTrackMetadata } from "./spotify-server";
import { cleanVersionTag } from "@/lib/clean-version-tag";

/** Remove sufixos como "(Deluxe Edition)"/"- Anniversary Edition" do nome do álbum vindo do Spotify. */
function cleanAlbumTitle(title: string): string {
  const cleaned = cleanVersionTag(title, "edition");
  return cleaned || title;
}

export type ApplySpotifyMetadataResult =
  | { ok: true; reason: "updated" | "dry_run" }
  | { ok: false; reason: string };

/**
 * Atualiza uma `Song` local e `ChartEntry` com metadados oficiais do Spotify (artist/album/feats).
 * Se `spotifyId` mudar, remove `SongFeat` ligados ao id antigo (evita violação de FK).
 */
export async function applySpotifyMetadataToSong(
  localSongId: string,
  meta: SpotifyTrackMetadata,
  dryRun: boolean,
): Promise<ApplySpotifyMetadataResult> {
  const primaryArtist = meta.primaryArtist;
  const albumSpotifyId = meta.album.spotifyId;

  const owner = await prisma.song.findUnique({
    where: { id: localSongId },
    select: {
      id: true,
      title: true,
      artist: true,
      album: true,
      spotifyId: true,
    },
  });
  if (!owner) return { ok: false, reason: "song_missing" };

  const taken = await prisma.song.findFirst({
    where: { spotifyId: meta.spotifyId, NOT: { id: localSongId } },
    select: { id: true },
  });
  if (taken) return { ok: false, reason: `spotify_id_conflict:${taken.id}` };

  if (dryRun) return { ok: true, reason: "dry_run" };

  const prevSpotifyId = owner.spotifyId?.trim() || null;
  if (prevSpotifyId && prevSpotifyId !== meta.spotifyId) {
    await prisma.songFeat.deleteMany({ where: { songSpotifyId: prevSpotifyId } });
  }

  async function upsertArtist(spotifyId: string, fallbackName: string) {
    const profile = await getSpotifyArtistById(spotifyId);
    await prisma.artist.upsert({
      where: { spotifyId },
      update: {
        name: profile?.name ?? fallbackName,
        genres: profile?.genres ?? [],
        spotifyUrl: profile?.spotifyUrl ?? undefined,
        ...(profile?.imageUrl ? { imageUrl: profile.imageUrl } : {}),
      },
      create: {
        spotifyId,
        name: profile?.name ?? fallbackName,
        genres: profile?.genres ?? [],
        spotifyUrl: profile?.spotifyUrl ?? null,
        imageUrl: profile?.imageUrl ?? null,
      },
    });
  }

  if (primaryArtist) await upsertArtist(primaryArtist.spotifyId, primaryArtist.name);

  const albumTitle = meta.album.title ? cleanAlbumTitle(meta.album.title) : meta.album.title;

  if (primaryArtist && albumSpotifyId) {
    await prisma.album.upsert({
      where: { spotifyId: albumSpotifyId },
      update: {
        title: albumTitle ?? undefined,
        artistSpotifyId: primaryArtist.spotifyId,
        albumType: meta.album.albumType ?? undefined,
        releaseDate: meta.album.releaseDate ?? undefined,
        coverUrl: meta.album.coverUrl ?? undefined,
        spotifyUrl: meta.album.spotifyUrl ?? undefined,
        totalTracks: meta.album.totalTracks ?? undefined,
      },
      create: {
        spotifyId: albumSpotifyId,
        title: albumTitle ?? "Álbum",
        artistSpotifyId: primaryArtist.spotifyId,
        albumType: meta.album.albumType ?? undefined,
        releaseDate: meta.album.releaseDate ?? null,
        coverUrl: meta.album.coverUrl ?? null,
        spotifyUrl: meta.album.spotifyUrl ?? null,
        totalTracks: meta.album.totalTracks ?? null,
      },
    });
  }

  const albumName = owner.album?.trim() ? owner.album : (albumTitle ?? null);

  await prisma.song.update({
    where: { id: localSongId },
    data: {
      spotifyId: meta.spotifyId,
      artistSpotifyId: primaryArtist?.spotifyId ?? null,
      albumSpotifyId: albumSpotifyId ?? null,
      album: albumName,
      durationMs: meta.durationMs ?? undefined,
      previewUrl: meta.previewUrl ?? undefined,
      spotifyUrl: meta.spotifyUrl ?? undefined,
      trackNumber: meta.trackNumber ?? undefined,
      isrc: meta.isrc ?? undefined,
    },
  });

  await prisma.chartEntry.updateMany({
    where: { songId: localSongId },
    data: {
      songSpotifyId: meta.spotifyId,
      albumSpotifyId: albumSpotifyId ?? null,
    },
  });

  if (meta.spotifyId) {
    const featured = meta.featuredArtists ?? [];
    const featIds = new Set<string>();
    for (const feat of featured) {
      featIds.add(feat.spotifyId);
      await upsertArtist(feat.spotifyId, feat.name);
      await prisma.songFeat.upsert({
        where: {
          songSpotifyId_artistSpotifyId: {
            songSpotifyId: meta.spotifyId,
            artistSpotifyId: feat.spotifyId,
          },
        },
        update: {},
        create: {
          songSpotifyId: meta.spotifyId,
          artistSpotifyId: feat.spotifyId,
        },
      });
    }
    await prisma.songFeat.deleteMany({
      where: {
        songSpotifyId: meta.spotifyId,
        ...(featIds.size ? { artistSpotifyId: { notIn: [...featIds] } } : {}),
      },
    });
  }

  enrichSongMetadataAfterSave(localSongId);

  return { ok: true, reason: "updated" };
}

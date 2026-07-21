import type { SpotifyArtistProfile } from "./spotify-server";

/**
 * Núcleo compartilhado de "aplica metadados de artista do Spotify preenchendo
 * só o que está vazio" — usado por app/api/admin/missing-info/backfill,
 * lib/edicao-de-dados-source-fetch.ts e lib/catalog-nightly-backfill.ts, que
 * antes tinham 3 cópias levemente diferentes desta mesma regra (duas já
 * preenchiam só o vazio; missing-info sobrescrevia tudo incondicionalmente —
 * corrigido aqui para nunca substituir um campo já preenchido, mesmo que
 * curado manualmente).
 */

export type ArtistMetadataCurrent = {
  imageUrl: string | null;
  spotifyUrl: string | null;
  genres: string[];
};

export type ArtistMetadataDiff = {
  data: { imageUrl?: string; spotifyUrl?: string; genres?: string[] };
  changed: string[];
};

export function diffArtistMetadataFromSpotify(
  current: ArtistMetadataCurrent,
  profile: SpotifyArtistProfile,
): ArtistMetadataDiff {
  const data: ArtistMetadataDiff["data"] = {};
  const changed: string[] = [];

  if (!current.imageUrl?.trim() && profile.imageUrl) {
    data.imageUrl = profile.imageUrl;
    changed.push("imagem");
  }
  if (current.genres.length === 0 && profile.genres.length > 0) {
    data.genres = profile.genres;
    changed.push("gêneros");
  }
  if (!current.spotifyUrl && profile.spotifyUrl) {
    data.spotifyUrl = profile.spotifyUrl;
    changed.push("link");
  }

  return { data, changed };
}

import type { SpotifyTrackMetadata } from "./spotify-server";

/**
 * Núcleo compartilhado de "aplica metadados de álbum do Spotify preenchendo só
 * o que está vazio" — usado por app/api/admin/missing-info/backfill,
 * lib/edicao-de-dados-source-fetch.ts e lib/catalog-nightly-backfill.ts, que
 * antes tinham 3 cópias levemente diferentes desta mesma regra (a de
 * edicao-de-dados já preenchia só o vazio; missing-info e o cron noturno
 * sobrescreviam capa/data/tipo/faixas incondicionalmente a cada rodada —
 * corrigido aqui para nunca substituir um campo já preenchido).
 */

export type AlbumMetadataCurrent = {
  coverUrl: string | null;
  releaseDate: Date | null;
  albumType: string | null;
  totalTracks: number | null;
  spotifyUrl: string | null;
};

export type SpotifyAlbumMeta = SpotifyTrackMetadata["album"];

export type AlbumMetadataDiff = {
  data: {
    coverUrl?: string;
    releaseDate?: Date;
    albumType?: NonNullable<SpotifyAlbumMeta["albumType"]>;
    totalTracks?: number;
    spotifyUrl?: string;
  };
  changed: string[];
};

export function diffAlbumMetadataFromSpotify(current: AlbumMetadataCurrent, meta: SpotifyAlbumMeta): AlbumMetadataDiff {
  const data: AlbumMetadataDiff["data"] = {};
  const changed: string[] = [];

  if (!current.coverUrl?.trim() && meta.coverUrl) {
    data.coverUrl = meta.coverUrl;
    changed.push("capa");
  }
  if (!current.releaseDate && meta.releaseDate) {
    data.releaseDate = meta.releaseDate;
    changed.push("data de lançamento");
  }
  if (!current.albumType && meta.albumType) {
    data.albumType = meta.albumType;
    changed.push("tipo");
  }
  if (current.totalTracks == null && meta.totalTracks != null) {
    data.totalTracks = meta.totalTracks;
    changed.push("faixas");
  }
  if (!current.spotifyUrl && meta.spotifyUrl) {
    data.spotifyUrl = meta.spotifyUrl;
    changed.push("link");
  }

  return { data, changed };
}

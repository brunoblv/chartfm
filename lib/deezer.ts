/**
 * Cliente Deezer (api.deezer.com) — sem autenticação, cobertura global de
 * catálogo. Usado como fonte de backfill (capa, data de lançamento, tipo de
 * álbum, faixas, selo, imagem de artista) via lib/edicao-de-dados-source-fetch.ts.
 *
 * Limite público: 50 req/5s por IP — throttle aqui é bem mais folgado que
 * isso (ver regra de espaçamento de APIs externas).
 */

import "@/lib/force-ipv4-fetch";

const API_BASE = "https://api.deezer.com";
const MIN_INTERVAL_MS = 150;

let lastFetchAt = 0;

async function throttle() {
  const wait = lastFetchAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastFetchAt = Date.now();
}

async function deezerFetch<T>(path: string): Promise<T | null> {
  await throttle();
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Deezer HTTP ${res.status}`);
  const data = (await res.json()) as T & { error?: { message?: string; code?: number } };
  if (data && typeof data === "object" && "error" in data && data.error) {
    // code 800 = "no data" (ex.: ISRC sem faixa correspondente) — tratado como não encontrado.
    if (data.error.code === 800) return null;
    throw new Error(`Deezer API: ${data.error.message ?? "erro desconhecido"}`);
  }
  return data;
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Compara nomes de artista tolerando acentos, feats e variações leves. */
function artistMatches(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

type DeezerArtistBrief = { id: number; name: string; picture_xl?: string; link?: string };
type DeezerAlbumBrief = { id: number; title: string; cover_xl?: string; release_date?: string };

type DeezerTrack = {
  id: number;
  title: string;
  link?: string;
  isrc?: string;
  release_date?: string;
  artist?: DeezerArtistBrief;
  album?: DeezerAlbumBrief;
};

type DeezerSearchResult<T> = { data?: T[] };

export type DeezerTrackHit = {
  trackId: number;
  title: string;
  artistName: string | null;
  artistId: number | null;
  albumId: number | null;
  albumTitle: string | null;
  releaseDate: Date | null;
  link: string | null;
};

function parseDeezerDate(raw: string | undefined | null): Date | null {
  const s = raw?.trim();
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T00:00:00.000Z`);
}

function trackToHit(t: DeezerTrack): DeezerTrackHit {
  return {
    trackId: t.id,
    title: t.title,
    artistName: t.artist?.name ?? null,
    artistId: t.artist?.id ?? null,
    albumId: t.album?.id ?? null,
    albumTitle: t.album?.title ?? null,
    releaseDate: parseDeezerDate(t.release_date ?? t.album?.release_date),
    link: t.link ?? null,
  };
}

/** Busca exata por ISRC — a forma mais confiável de casar uma faixa (sem ambiguidade de nome). */
export async function getDeezerTrackByIsrc(isrc: string): Promise<DeezerTrackHit | null> {
  const code = isrc.trim().toUpperCase();
  if (!code) return null;
  const data = await deezerFetch<DeezerTrack>(`/track/isrc:${encodeURIComponent(code)}`);
  if (!data?.id) return null;
  return trackToHit(data);
}

/** Busca por título+artista; só aceita o primeiro resultado cujo artista bate com o informado. */
export async function searchDeezerTrack(title: string, artist: string): Promise<DeezerTrackHit | null> {
  const t = title.trim();
  const a = artist.trim();
  if (!t || !a) return null;
  const q = `track:"${t}" artist:"${a}"`;
  const data = await deezerFetch<DeezerSearchResult<DeezerTrack>>(
    `/search/track?q=${encodeURIComponent(q)}&limit=5`,
  );
  const hit = (data?.data ?? []).find((track) => track.artist?.name && artistMatches(track.artist.name, a));
  return hit ? trackToHit(hit) : null;
}

export type DeezerAlbumDetail = {
  id: number;
  title: string;
  coverUrl: string | null;
  releaseDate: Date | null;
  /** "album" | "single" | "ep" | "compile" */
  recordType: string | null;
  totalTracks: number | null;
  label: string | null;
  genres: string[];
  link: string | null;
};

type DeezerAlbumFull = {
  id: number;
  title: string;
  cover_xl?: string;
  release_date?: string;
  record_type?: string;
  nb_tracks?: number;
  label?: string;
  link?: string;
  genres?: { data?: Array<{ name?: string }> };
};

function albumToDetail(a: DeezerAlbumFull): DeezerAlbumDetail {
  return {
    id: a.id,
    title: a.title,
    coverUrl: a.cover_xl ?? null,
    releaseDate: parseDeezerDate(a.release_date),
    recordType: a.record_type ?? null,
    totalTracks: a.nb_tracks ?? null,
    label: a.label?.trim() || null,
    genres: (a.genres?.data ?? []).map((g) => g.name?.trim()).filter((n): n is string => !!n),
    link: a.link ?? null,
  };
}

export async function getDeezerAlbumById(id: number): Promise<DeezerAlbumDetail | null> {
  const data = await deezerFetch<DeezerAlbumFull>(`/album/${id}`);
  if (!data?.id) return null;
  return albumToDetail(data);
}

/** Busca por título+artista; só aceita o primeiro resultado cujo artista bate. */
export async function searchDeezerAlbum(title: string, artist: string): Promise<DeezerAlbumDetail | null> {
  const t = title.trim();
  const a = artist.trim();
  if (!t || !a) return null;
  const q = `album:"${t}" artist:"${a}"`;
  const data = await deezerFetch<DeezerSearchResult<DeezerAlbumBrief & { artist?: DeezerArtistBrief }>>(
    `/search/album?q=${encodeURIComponent(q)}&limit=5`,
  );
  const hit = (data?.data ?? []).find((album) => album.artist?.name && artistMatches(album.artist.name, a));
  if (!hit) return null;
  return getDeezerAlbumById(hit.id);
}

export type DeezerArtistDetail = {
  id: number;
  name: string;
  imageUrl: string | null;
  link: string | null;
};

/** Mapeia record_type do Deezer para o enum AlbumType do schema. */
export function deezerRecordTypeToAlbumType(recordType: string | null): "SINGLE" | "EP" | "ALBUM" | "COMPILATION" | null {
  switch (recordType) {
    case "single":
      return "SINGLE";
    case "ep":
      return "EP";
    case "album":
      return "ALBUM";
    case "compile":
      return "COMPILATION";
    default:
      return null;
  }
}

/** Busca artista por nome; só aceita resultado cujo nome bate com o informado. */
export async function searchDeezerArtist(name: string): Promise<DeezerArtistDetail | null> {
  const n = name.trim();
  if (!n) return null;
  const data = await deezerFetch<DeezerSearchResult<DeezerArtistBrief>>(
    `/search/artist?q=${encodeURIComponent(n)}&limit=5`,
  );
  const hit = (data?.data ?? []).find((a) => artistMatches(a.name, n));
  if (!hit) return null;
  return { id: hit.id, name: hit.name, imageUrl: hit.picture_xl ?? null, link: hit.link ?? null };
}

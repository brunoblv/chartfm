/**
 * Busca capa, data de single, data de álbum e data de clipe (MV) no Bugs
 * (music.bugs.co.kr), via a API JSON de busca mobile — sem scraping de HTML.
 *
 * Cobertura forte em kpop por ser plataforma coreana. É uma API não-oficial
 * (mobile) do Bugs: tratar como fonte best-effort, nunca crítica, e chamar
 * com moderação (ver memória "api-rate-limit-policy").
 */

const SEARCH_URL = "https://m.bugs.co.kr/api/getSearchList";
const IMAGE_BASE = "https://image.bugsm.co.kr/album/images";
const USER_AGENT = "Mozilla/5.0";

export type BugsImageSize = "200" | "500" | "1000" | "original";

interface BugsImage {
  path: string;
}

interface BugsAlbumRef {
  album_id: number;
  title: string;
  release_ymd?: string;
  image?: BugsImage;
}

interface BugsArtist {
  artist_id: number;
  artist_nm: string;
}

interface BugsMv {
  mv_id: number;
  mv_title: string;
  release_ymd?: string;
}

interface BugsTrackHit {
  track_id: number;
  track_title: string;
  album: BugsAlbumRef;
  artists: BugsArtist[];
  mvs?: BugsMv[];
}

interface BugsAlbumHit {
  album_id: number;
  title: string;
  release_ymd?: string;
  image?: BugsImage;
  album_tp_nm?: string; // ex.: "싱글" (single), "EP(미니)", "정규" (álbum), "리패키지" (repackage)
  artists?: BugsArtist[];
}

export interface BugsReleaseMatch {
  trackId: number;
  trackTitle: string;
  albumId: number;
  albumTitle: string;
  albumType: string | null;
  releaseDate: string | null; // YYYY-MM-DD
  coverUrl: string | null;
}

export interface BugsClipMatch {
  mvId: number;
  mvTitle: string;
  releaseDate: string | null;
}

export interface BugsLookupResult {
  query: { title: string; artist: string };
  /** false quando nenhum resultado bateu o nome do artista informado (comum
   * em grupos de kpop indexados pelo nome nativo no Bugs, ex.: BTS =
   * 방탄소년단) — os resultados vieram só do match de título, conferir manualmente. */
  artistConfirmed: boolean;
  matches: BugsReleaseMatch[];
  clips: BugsClipMatch[];
  cover: string | null;
  singleReleaseDate: string | null;
  albumReleaseDate: string | null;
  clipReleaseDate: string | null;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function titleMatches(candidate: string, wanted: string): boolean {
  const c = normalize(candidate);
  const w = normalize(wanted);
  if (!c || !w) return false;
  return c === w || c.startsWith(w) || w.startsWith(c) || c.includes(w);
}

function artistMatches(names: string[], wanted: string): boolean {
  const w = normalize(wanted);
  if (!w) return false;
  return names.some((n) => {
    const c = normalize(n);
    return c === w || c.includes(w) || w.includes(c);
  });
}

function ymdToIso(ymd: string | null | undefined): string | null {
  if (!ymd || !/^\d{8}$/.test(ymd)) return null;
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

const TEASER_LIKE_RE = /teaser|trailer|preview|발매\s*인사|하이라이트|highlight/i;

function coverUrlFromPath(path: string | null | undefined, size: BugsImageSize = "1000"): string | null {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
}

async function bugsSearch<T>(type: "track" | "album", query: string, size = 20): Promise<T[]> {
  const url = `${SEARCH_URL}?type=${type}&query=${encodeURIComponent(query)}&page=1&size=${size}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const data = (await res.json().catch(() => null)) as { list?: T[] } | null;
  return data?.list ?? [];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Busca no Bugs por título + artista e retorna capa, data de lançamento do
 * single, data de lançamento do álbum/EP e data do clipe oficial, quando
 * disponíveis. Faz no máximo 2 chamadas HTTP (busca de faixa + busca de
 * álbum, essa última só para classificar single x álbum).
 */
export async function lookupBugsRelease(title: string, artist: string): Promise<BugsLookupResult> {
  const trackHits = await bugsSearch<BugsTrackHit>("track", `${title} ${artist}`, 20);

  const titleOnlyMatches = trackHits.filter((hit) => titleMatches(hit.track_title, title));
  const strictMatches = titleOnlyMatches.filter((hit) =>
    artistMatches(hit.artists?.map((a) => a.artist_nm) ?? [], artist),
  );
  // Grupos de kpop costumam estar indexados pelo nome nativo no Bugs
  // (ex.: BTS = 방탄소년단), então o match de artista pode falhar mesmo
  // sendo o resultado certo — nesse caso caímos para o match só de título.
  const artistConfirmed = strictMatches.length > 0;
  const matchedTracks = artistConfirmed ? strictMatches : titleOnlyMatches;

  const matches: BugsReleaseMatch[] = [];
  const seenAlbumIds = new Set<number>();
  for (const hit of matchedTracks) {
    if (!hit.album || seenAlbumIds.has(hit.album.album_id)) continue;
    seenAlbumIds.add(hit.album.album_id);
    matches.push({
      trackId: hit.track_id,
      trackTitle: hit.track_title,
      albumId: hit.album.album_id,
      albumTitle: hit.album.title,
      albumType: null,
      releaseDate: ymdToIso(hit.album.release_ymd),
      coverUrl: coverUrlFromPath(hit.album.image?.path),
    });
  }

  const clips: BugsClipMatch[] = [];
  for (const hit of matchedTracks) {
    for (const mv of hit.mvs ?? []) {
      if (!titleMatches(mv.mv_title, title)) continue;
      if (clips.some((c) => c.mvId === mv.mv_id)) continue;
      clips.push({ mvId: mv.mv_id, mvTitle: mv.mv_title, releaseDate: ymdToIso(mv.release_ymd) });
    }
  }

  if (matches.length) {
    // Usa o nome de artista como o próprio Bugs o retornou (pode ser o nome
    // nativo, ex.: 방탄소년단), garantindo que a busca de álbum bata certo.
    const nativeArtistName = matchedTracks[0]?.artists?.[0]?.artist_nm ?? artist;
    await sleep(300); // espaçar chamadas ao Bugs
    const albumHits = await bugsSearch<BugsAlbumHit>("album", nativeArtistName, 30);
    const albumTypeById = new Map(albumHits.map((a) => [a.album_id, a.album_tp_nm ?? null]));
    for (const m of matches) {
      m.albumType = albumTypeById.get(m.albumId) ?? null;
    }
  }

  const byDateAsc = (a: BugsReleaseMatch, b: BugsReleaseMatch) =>
    (a.releaseDate ?? "9999").localeCompare(b.releaseDate ?? "9999");

  const singleMatches = matches.filter((m) => m.albumType?.includes("싱글")).sort(byDateAsc);
  const albumMatches = matches
    .filter((m) => m.albumType && !m.albumType.includes("싱글"))
    .sort(byDateAsc);

  const single = singleMatches[0] ?? null;
  const album = albumMatches[0] ?? null;
  const bestGuess = [...matches].sort(byDateAsc)[0] ?? null;

  const clipsSorted = [...clips].sort(
    (a, b) => (a.releaseDate ?? "9999").localeCompare(b.releaseDate ?? "9999"),
  );
  // Prefere o clipe oficial (não teaser/trailer) mais antigo; só cai para
  // teaser se não houver nenhum clipe "principal" encontrado.
  const officialClip = clipsSorted.find((c) => !TEASER_LIKE_RE.test(c.mvTitle)) ?? clipsSorted[0] ?? null;

  return {
    query: { title, artist },
    artistConfirmed,
    matches,
    clips: clipsSorted,
    cover: single?.coverUrl ?? album?.coverUrl ?? bestGuess?.coverUrl ?? null,
    singleReleaseDate: single?.releaseDate ?? null,
    albumReleaseDate: album?.releaseDate ?? null,
    clipReleaseDate: officialClip?.releaseDate ?? null,
  };
}

export interface BugsAlbumLookupResult {
  query: { title: string; artist: string };
  artistConfirmed: boolean;
  match: BugsReleaseMatch | null;
  cover: string | null;
  releaseDate: string | null;
}

/**
 * Busca no Bugs por título de álbum + artista (busca direta em type=album,
 * sem passar por faixa) e retorna capa e data de lançamento. Usada no
 * backfill de Album, onde não há um título de faixa para buscar.
 */
export async function lookupBugsAlbum(title: string, artist: string): Promise<BugsAlbumLookupResult> {
  const hits = await bugsSearch<BugsAlbumHit>("album", `${title} ${artist}`, 20);

  const titleOnlyMatches = hits.filter((hit) => titleMatches(hit.title, title));
  const strictMatches = titleOnlyMatches.filter((hit) =>
    artistMatches(hit.artists?.map((a) => a.artist_nm) ?? [], artist),
  );
  const artistConfirmed = strictMatches.length > 0;
  const candidates = artistConfirmed ? strictMatches : titleOnlyMatches;

  const chosen = [...candidates].sort((a, b) => (a.release_ymd ?? "9999").localeCompare(b.release_ymd ?? "9999"))[0] ?? null;

  const match: BugsReleaseMatch | null = chosen
    ? {
        trackId: 0,
        trackTitle: "",
        albumId: chosen.album_id,
        albumTitle: chosen.title,
        albumType: chosen.album_tp_nm ?? null,
        releaseDate: ymdToIso(chosen.release_ymd),
        coverUrl: coverUrlFromPath(chosen.image?.path),
      }
    : null;

  return {
    query: { title, artist },
    artistConfirmed,
    match,
    cover: match?.coverUrl ?? null,
    releaseDate: match?.releaseDate ?? null,
  };
}

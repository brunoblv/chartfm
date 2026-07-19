/**
 * Cliente MusicBrainz WS/2 — tags e gêneros por recording (faixa).
 * https://musicbrainz.org/doc/MusicBrainz_API
 */

import dns from "node:dns";

// instrumentation.ts já faz isso para requests via Next (app/api/**), mas
// scripts/*.ts rodam com tsx direto e nunca passam pelo register() do Next —
// sem isso o fetch para musicbrainz.org tenta IPv6 primeiro e quebra em redes
// com IPv6 mal configurado (fetch failed).
dns.setDefaultResultOrder("ipv4first");

const API_BASE = "https://musicbrainz.org/ws/2";
const MIN_INTERVAL_MS = 1100;

let lastFetchAt = 0;

function userAgent(): string {
  return (
    process.env.MUSICBRAINZ_USER_AGENT?.trim() ||
    "ChartFM/1.0 (https://chartfm.com.br; contact@chartfm.com.br)"
  );
}

async function throttle() {
  const wait = lastFetchAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastFetchAt = Date.now();
}

async function mbFetch(path: string): Promise<unknown | null> {
  await throttle();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": userAgent(),
    },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`MusicBrainz HTTP ${res.status}`);
  }
  return res.json();
}

function escapeLucene(value: string): string {
  return value.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, "\\$&").trim();
}

function pickTagsFromRecording(rec: {
  tags?: Array<{ name?: string; count?: number }>;
  genres?: Array<{ name?: string; count?: number }>;
}): string[] {
  const scored = new Map<string, number>();
  const add = (name: string | undefined, count = 1) => {
    const n = name?.trim().toLowerCase();
    if (!n) return;
    scored.set(n, (scored.get(n) ?? 0) + count);
  };
  for (const t of rec.tags ?? []) add(t.name, t.count ?? 1);
  for (const g of rec.genres ?? []) add(g.name, (g.count ?? 1) * 2);
  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .slice(0, 12);
}

type MbRecording = {
  id?: string;
  title?: string;
  tags?: Array<{ name?: string; count?: number }>;
  genres?: Array<{ name?: string; count?: number }>;
};

export async function getMusicBrainzRecordingTags(mbid: string): Promise<{
  mbid: string;
  tags: string[];
} | null> {
  const id = mbid.trim();
  if (!id) return null;
  const data = (await mbFetch(
    `/recording/${encodeURIComponent(id)}?inc=tags+genres&fmt=json`,
  )) as MbRecording | null;
  if (!data?.id) return null;
  const tags = pickTagsFromRecording(data);
  return { mbid: data.id, tags };
}

function recordingMbidsFromUrlLookup(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const relations = (data as { relations?: unknown }).relations;
  if (!Array.isArray(relations)) return [];
  const out: string[] = [];
  for (const rel of relations) {
    if (!rel || typeof rel !== "object") continue;
    const r = rel as { type?: string; recording?: { id?: string } };
    if (r.type === "recording" && r.recording?.id) out.push(r.recording.id);
  }
  return out;
}

export async function findRecordingMbidBySpotifyTrackId(spotifyTrackId: string): Promise<string | null> {
  const id = spotifyTrackId.trim();
  if (!id) return null;
  const url = `https://open.spotify.com/track/${id}`;
  const data = await mbFetch(`/url?resource=${encodeURIComponent(url)}&inc=recording-rels&fmt=json`);
  const mbids = recordingMbidsFromUrlLookup(data);
  return mbids[0] ?? null;
}

export async function findRecordingMbidByIsrc(isrc: string): Promise<string | null> {
  const code = isrc.trim().toUpperCase();
  if (!code) return null;
  const data = (await mbFetch(`/isrc/${encodeURIComponent(code)}?fmt=json`)) as {
    recordings?: Array<{ id?: string }>;
  } | null;
  return data?.recordings?.[0]?.id ?? null;
}

/** Converte datas MusicBrainz (YYYY, YYYY-MM ou YYYY-MM-DD) para Date UTC. */
export function parseMusicBrainzDate(raw: string | undefined | null): Date | null {
  const s = raw?.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00.000Z`);
  if (/^\d{4}-\d{2}$/.test(s)) return new Date(`${s}-01T00:00:00.000Z`);
  if (/^\d{4}$/.test(s)) return new Date(`${s}-01-01T00:00:00.000Z`);
  return null;
}

function earliestDate(dates: Date[]): Date | null {
  if (!dates.length) return null;
  return dates.reduce((min, d) => (d.getTime() < min.getTime() ? d : min));
}

type MbRecordingRef = {
  title?: string;
  video?: boolean | null;
  disambiguation?: string;
};

type MbTrack = {
  title?: string;
  recording?: MbRecordingRef;
};

type MbReleaseWithDate = {
  date?: string;
  disambiguation?: string;
  "release-events"?: Array<{ date?: string }>;
  media?: Array<{ tracks?: MbTrack[] }>;
};

function datesFromRelease(rel: MbReleaseWithDate): Date[] {
  const out: Date[] = [];
  for (const ev of rel["release-events"] ?? []) {
    const d = parseMusicBrainzDate(ev.date);
    if (d) out.push(d);
  }
  if (!out.length) {
    const d = parseMusicBrainzDate(rel.date);
    if (d) out.push(d);
  }
  return out;
}

type ReleaseDisambiguationKind = "audio-single" | "music-video" | "ignore";

function isLyricVideoText(...parts: Array<string | undefined | null>): boolean {
  const text = parts.filter(Boolean).join(" ").toLowerCase();
  return text.includes("lyric video") || text.includes("lyric-video");
}

function isMusicVideoRecording(rec?: MbRecordingRef | null, trackTitle?: string): boolean {
  if (isLyricVideoText(rec?.title, rec?.disambiguation, trackTitle)) return false;
  if (rec?.video === true) return true;
  const text = [rec?.title, rec?.disambiguation, trackTitle].filter(Boolean).join(" ").toLowerCase();
  return text.includes("music video") || text.includes("music-video");
}

function releaseHasMusicVideoTrack(rel: MbReleaseWithDate): boolean {
  for (const medium of rel.media ?? []) {
    for (const track of medium.tracks ?? []) {
      if (isMusicVideoRecording(track.recording, track.title)) return true;
    }
  }
  return false;
}

function releaseKind(rel: MbReleaseWithDate): ReleaseDisambiguationKind {
  const d = rel.disambiguation?.trim().toLowerCase() ?? "";
  if (isLyricVideoText(d)) return "ignore";
  if (d.includes("music video") || d.includes("music-video")) return "music-video";
  if (releaseHasMusicVideoTrack(rel)) return "music-video";
  return "audio-single";
}

function resolveReleaseDates(releases: MbReleaseWithDate[]): {
  singleReleaseDate: Date | null;
  musicVideoReleaseDate: Date | null;
} {
  const single: Date[] = [];
  const musicVideo: Date[] = [];

  for (const rel of releases) {
    const dates = datesFromRelease(rel);
    if (!dates.length) continue;
    const kind = releaseKind(rel);
    if (kind === "ignore") continue;
    if (kind === "music-video") musicVideo.push(...dates);
    else single.push(...dates);
  }

  return {
    singleReleaseDate: earliestDate(single),
    musicVideoReleaseDate: earliestDate(musicVideo),
  };
}

export type MusicBrainzReleaseDates = {
  singleReleaseDate: Date | null;
  musicVideoReleaseDate: Date | null;
};

/** @deprecated */
export type MusicBrainzReleaseDate = {
  date: Date | null;
  source: "music-video" | "single" | null;
};

async function searchSingleReleaseGroupIds(title: string, artist: string): Promise<string[]> {
  const t = escapeLucene(title);
  const a = escapeLucene(artist);
  if (!t || !a) return [];
  const query = `releasegroup:"${t}" AND artist:"${a}" AND primarytype:single`;
  const data = (await mbFetch(
    `/release-group?query=${encodeURIComponent(query)}&limit=5&fmt=json`,
  )) as { "release-groups"?: Array<{ id?: string; score?: number; "primary-type"?: string }> } | null;
  const groups = (data?.["release-groups"] ?? []).filter((rg) => rg["primary-type"] === "Single" && rg.id);
  groups.sort((x, y) => (y.score ?? 0) - (x.score ?? 0));
  return groups.map((rg) => rg.id!);
}

async function fetchReleasesForReleaseGroup(rgId: string): Promise<MbReleaseWithDate[]> {
  const relData = (await mbFetch(
    `/release?release-group=${encodeURIComponent(rgId)}&inc=media+recordings&fmt=json`,
  )) as { releases?: MbReleaseWithDate[] } | null;
  return relData?.releases ?? [];
}

async function fetchReleaseWithTracks(releaseId: string): Promise<MbReleaseWithDate | null> {
  const data = (await mbFetch(
    `/release/${encodeURIComponent(releaseId)}?inc=media+recordings&fmt=json`,
  )) as MbReleaseWithDate | null;
  return data?.date || data?.["release-events"]?.length || data?.media?.length ? data : null;
}

export type ReleaseDateHint = { title?: string; artist?: string };

/** Datas de single e videoclipe no MusicBrainz (lyric video ignorado). */
export async function getMusicBrainzReleaseDates(
  mbid: string,
  hint?: ReleaseDateHint,
): Promise<MusicBrainzReleaseDates> {
  const id = mbid.trim();
  const empty: MusicBrainzReleaseDates = {
    singleReleaseDate: null,
    musicVideoReleaseDate: null,
  };
  if (!id) return empty;

  const rgIds = new Set<string>();

  const rgData = (await mbFetch(
    `/recording/${encodeURIComponent(id)}?inc=release-groups&fmt=json`,
  )) as { "release-groups"?: Array<{ id?: string; "primary-type"?: string }> } | null;
  for (const rg of rgData?.["release-groups"] ?? []) {
    if (rg.id && rg["primary-type"] === "Single") rgIds.add(rg.id);
  }

  const title = hint?.title?.trim();
  const artist = hint?.artist?.trim();
  if (title && artist) {
    for (const rgId of await searchSingleReleaseGroupIds(title, artist)) rgIds.add(rgId);
  }

  const allReleases: MbReleaseWithDate[] = [];
  for (const rgId of rgIds) {
    allReleases.push(...(await fetchReleasesForReleaseGroup(rgId)));
  }

  if (allReleases.length) return resolveReleaseDates(allReleases);

  const recReleases = (await mbFetch(
    `/recording/${encodeURIComponent(id)}?inc=releases&type=single&fmt=json`,
  )) as { releases?: Array<MbReleaseWithDate & { id?: string }> } | null;

  for (const rel of recReleases?.releases ?? []) {
    if (rel.id) {
      const full = await fetchReleaseWithTracks(rel.id);
      if (full) allReleases.push(full);
    } else {
      allReleases.push(rel);
    }
  }

  return resolveReleaseDates(allReleases);
}

/** Prioriza videoclipe MB, senão single (legado). */
export async function getMusicBrainzReleaseDate(
  mbid: string,
  hint?: ReleaseDateHint,
): Promise<MusicBrainzReleaseDate> {
  const dates = await getMusicBrainzReleaseDates(mbid, hint);
  if (dates.musicVideoReleaseDate) {
    return { date: dates.musicVideoReleaseDate, source: "music-video" };
  }
  if (dates.singleReleaseDate) {
    return { date: dates.singleReleaseDate, source: "single" };
  }
  return { date: null, source: null };
}

/** @deprecated use getMusicBrainzReleaseDate */
export async function getMusicBrainzSingleReleaseDate(mbid: string): Promise<Date | null> {
  const { date } = await getMusicBrainzReleaseDate(mbid);
  return date;
}

export async function searchRecordingMbid(title: string, artist: string): Promise<string | null> {
  const t = escapeLucene(title);
  const a = escapeLucene(artist);
  if (!t || !a) return null;
  const query = `recording:"${t}" AND artist:"${a}"`;
  const data = (await mbFetch(
    `/recording?query=${encodeURIComponent(query)}&limit=5&fmt=json`,
  )) as { recordings?: Array<{ id?: string; score?: number }> } | null;
  const recs = data?.recordings ?? [];
  if (!recs.length) return null;
  recs.sort((x, y) => (y.score ?? 0) - (x.score ?? 0));
  return recs[0]?.id ?? null;
}

/** Data de lançamento de um álbum via busca de release-group (first-release-date). */
export async function searchMusicBrainzAlbumReleaseDate(
  title: string,
  artist: string,
): Promise<{ mbid: string; releaseDate: Date | null } | null> {
  const t = escapeLucene(title);
  const a = escapeLucene(artist);
  if (!t || !a) return null;
  const query = `releasegroup:"${t}" AND artist:"${a}"`;
  const data = (await mbFetch(
    `/release-group?query=${encodeURIComponent(query)}&limit=5&fmt=json`,
  )) as {
    "release-groups"?: Array<{ id?: string; score?: number; "first-release-date"?: string }>;
  } | null;
  const groups = (data?.["release-groups"] ?? []).filter((rg) => rg.id);
  if (!groups.length) return null;
  groups.sort((x, y) => (y.score ?? 0) - (x.score ?? 0));
  const best = groups[0];
  return { mbid: best.id!, releaseDate: parseMusicBrainzDate(best["first-release-date"]) };
}

type MbReleaseGroupBrief = {
  id?: string;
  title?: string;
  "primary-type"?: string;
  "secondary-types"?: string[];
  "first-release-date"?: string;
};

type MbReleaseWithGroup = {
  "release-group"?: MbReleaseGroupBrief;
};

export type MusicBrainzAlbumForRecording = { title: string; mbid: string };
export type MusicBrainzAlbumHint = { title?: string; artist?: string };

/**
 * Escolhe o release-group tipo "Album" mais antigo (sem secondary-types, o
 * que descarta coletâneas/ao vivo/trilha sonora) entre as releases de uma
 * recording. `release-groups` sozinho como inc NÃO retorna nada na API do
 * MusicBrainz — o release-group só vem aninhado quando `releases` também é
 * incluído.
 */
function pickBestAlbumGroup(releases: MbReleaseWithGroup[]): MusicBrainzAlbumForRecording | null {
  const candidates = releases
    .map((r) => r["release-group"])
    .filter(
      (rg): rg is MbReleaseGroupBrief =>
        !!rg?.id && !!rg.title && rg["primary-type"] === "Album" && !rg["secondary-types"]?.length,
    );
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    const da = parseMusicBrainzDate(a["first-release-date"])?.getTime() ?? Infinity;
    const db = parseMusicBrainzDate(b["first-release-date"])?.getTime() ?? Infinity;
    return da - db;
  });
  const best = candidates[0];
  return { title: best.title!, mbid: best.id! };
}

/**
 * Álbum de estúdio em que a faixa aparece. A recording resolvida para a
 * música (ex.: radio edit) pode não estar diretamente ligada ao álbum — nesse
 * caso busca outras recordings do mesmo título/artista (remix, versão do
 * álbum etc.) até achar uma ligada a um release-group tipo Album.
 */
export async function getMusicBrainzAlbumForRecording(
  mbid: string,
  hint?: MusicBrainzAlbumHint,
): Promise<MusicBrainzAlbumForRecording | null> {
  const id = mbid.trim();
  if (!id) return null;

  const data = (await mbFetch(
    `/recording/${encodeURIComponent(id)}?inc=releases+release-groups&fmt=json`,
  )) as { releases?: MbReleaseWithGroup[] } | null;
  const direct = pickBestAlbumGroup(data?.releases ?? []);
  if (direct) return direct;

  const title = hint?.title?.trim();
  const artist = hint?.artist?.trim();
  const t = escapeLucene(title ?? "");
  const a = escapeLucene(artist ?? "");
  if (!t || !a) return null;

  const searchData = (await mbFetch(
    `/recording?query=${encodeURIComponent(`recording:"${t}" AND artist:"${a}"`)}&limit=10&fmt=json`,
  )) as { recordings?: Array<{ id?: string; score?: number }> } | null;
  const candidates = (searchData?.recordings ?? [])
    .filter((r) => r.id && r.id !== id)
    .sort((x, y) => (y.score ?? 0) - (x.score ?? 0))
    .slice(0, 6);

  for (const cand of candidates) {
    const relData = (await mbFetch(
      `/recording/${encodeURIComponent(cand.id!)}?inc=releases+release-groups&fmt=json`,
    )) as { releases?: MbReleaseWithGroup[] } | null;
    const hit = pickBestAlbumGroup(relData?.releases ?? []);
    if (hit) return hit;
  }
  return null;
}

type CoverArtImage = {
  front?: boolean;
  image?: string;
  thumbnails?: Record<string, string>;
};

/** Capa via Cover Art Archive (coverartarchive.org), indexado por MBID do release-group. */
export async function getCoverArtArchiveUrl(
  mbid: string,
  entity: "release-group" | "release" = "release-group",
): Promise<string | null> {
  const id = mbid.trim();
  if (!id) return null;
  await throttle();
  const res = await fetch(`https://coverartarchive.org/${entity}/${encodeURIComponent(id)}`, {
    headers: { Accept: "application/json", "User-Agent": userAgent() },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const data = (await res.json()) as { images?: CoverArtImage[] } | null;
  const images = data?.images ?? [];
  const front = images.find((img) => img.front) ?? images[0];
  if (!front) return null;
  return front.thumbnails?.["500"] ?? front.image ?? null;
}

/** Tags/gêneros de um artista via busca por nome. */
export async function searchMusicBrainzArtistTags(name: string): Promise<{
  mbid: string;
  name: string;
  tags: string[];
} | null> {
  const n = escapeLucene(name);
  if (!n) return null;
  const data = (await mbFetch(
    `/artist?query=${encodeURIComponent(`artist:"${n}"`)}&limit=3&fmt=json`,
  )) as { artists?: Array<{ id?: string; name?: string; score?: number }> } | null;
  const artists = (data?.artists ?? []).filter((a) => a.id);
  if (!artists.length) return null;
  artists.sort((x, y) => (y.score ?? 0) - (x.score ?? 0));
  const best = artists[0];
  const detail = (await mbFetch(
    `/artist/${encodeURIComponent(best.id!)}?inc=tags+genres&fmt=json`,
  )) as MbRecording | null;
  if (!detail?.id) return null;
  return { mbid: detail.id, name: best.name ?? name, tags: pickTagsFromRecording(detail) };
}

export type MusicBrainzSongGenreResult = {
  mbid: string;
  tags: string[];
};

/** Resolve MBID + tags: MBID cache → Spotify URL → ISRC → busca texto. */
export async function resolveMusicBrainzSongGenres(input: {
  title: string;
  artist: string;
  spotifyId?: string | null;
  isrc?: string | null;
  recordingMbid?: string | null;
}): Promise<MusicBrainzSongGenreResult | null> {
  let mbid = input.recordingMbid?.trim() || null;

  if (!mbid && input.spotifyId) {
    mbid = await findRecordingMbidBySpotifyTrackId(input.spotifyId);
  }
  if (!mbid && input.isrc) {
    mbid = await findRecordingMbidByIsrc(input.isrc);
  }
  if (!mbid) {
    mbid = await searchRecordingMbid(input.title, input.artist);
  }
  if (!mbid) return null;

  const rec = await getMusicBrainzRecordingTags(mbid);
  if (!rec) return null;
  return { mbid: rec.mbid, tags: rec.tags };
}

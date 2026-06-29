/**
 * Cliente MusicBrainz WS/2 — tags e gêneros por recording (faixa).
 * https://musicbrainz.org/doc/MusicBrainz_API
 */

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

type MbReleaseWithDate = {
  date?: string;
  disambiguation?: string;
  "release-events"?: Array<{ date?: string }>;
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

function releaseDisambiguationKind(disambiguation: string | undefined): ReleaseDisambiguationKind {
  const d = disambiguation?.trim().toLowerCase() ?? "";
  if (d.includes("lyric video") || d.includes("lyric-video")) return "ignore";
  if (d.includes("music video") || d.includes("music-video")) return "music-video";
  return "audio-single";
}

function resolveEffectiveReleaseDate(releases: MbReleaseWithDate[]): {
  date: Date | null;
  source: "music-video" | "single" | null;
} {
  const single: Date[] = [];
  const musicVideo: Date[] = [];

  for (const rel of releases) {
    const dates = datesFromRelease(rel);
    if (!dates.length) continue;
    const kind = releaseDisambiguationKind(rel.disambiguation);
    if (kind === "ignore") continue;
    if (kind === "music-video") musicVideo.push(...dates);
    else single.push(...dates);
  }

  const mv = earliestDate(musicVideo);
  if (mv) return { date: mv, source: "music-video" };
  const sg = earliestDate(single);
  if (sg) return { date: sg, source: "single" };
  return { date: null, source: null };
}

export type MusicBrainzReleaseDate = {
  date: Date | null;
  source: "music-video" | "single" | null;
};

/** Data de lançamento: videoclipe se existir, senão single (ignora lyric video). */
export async function getMusicBrainzReleaseDate(mbid: string): Promise<MusicBrainzReleaseDate> {
  const id = mbid.trim();
  const empty: MusicBrainzReleaseDate = { date: null, source: null };
  if (!id) return empty;

  const rgData = (await mbFetch(
    `/recording/${encodeURIComponent(id)}?inc=release-groups&type=single&fmt=json`,
  )) as { "release-groups"?: Array<{ id?: string }> } | null;

  const rgIds = (rgData?.["release-groups"] ?? []).map((rg) => rg.id).filter(Boolean) as string[];

  if (rgIds.length) {
    const allReleases: MbReleaseWithDate[] = [];
    for (const rgId of rgIds) {
      const relData = (await mbFetch(
        `/release?release-group=${encodeURIComponent(rgId)}&fmt=json`,
      )) as { releases?: MbReleaseWithDate[] } | null;
      if (relData?.releases?.length) allReleases.push(...relData.releases);
    }
    if (allReleases.length) return resolveEffectiveReleaseDate(allReleases);
  }

  const data = (await mbFetch(
    `/recording/${encodeURIComponent(id)}?inc=releases&type=single&fmt=json`,
  )) as { releases?: MbReleaseWithDate[] } | null;

  return resolveEffectiveReleaseDate(data?.releases ?? []);
}

/** @deprecated use getMusicBrainzReleaseDate */
export async function getMusicBrainzReleaseDates(mbid: string): Promise<{ singleReleaseDate: Date | null }> {
  const { date } = await getMusicBrainzReleaseDate(mbid);
  return { singleReleaseDate: date };
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

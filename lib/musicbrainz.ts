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
  const data = (await mbFetch(`/isrc/${encodeURIComponent(code)}?inc=recordings&fmt=json`)) as {
    recordings?: Array<{ id?: string }>;
  } | null;
  return data?.recordings?.[0]?.id ?? null;
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

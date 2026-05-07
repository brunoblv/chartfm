const BASE_URL = "https://ws.audioscrobbler.com/2.0/";

export interface DayPlays {
  date: string; // YYYY-MM-DD UTC
  plays: number;
}

export interface TrackPlays {
  track: string;
  artist: string;
  album: string;
  dayPlays: DayPlays[];
}

interface RawTrack {
  name: string;
  artist: { "#text": string };
  album: { "#text": string };
  date?: { uts: string };
  "@attr"?: { nowplaying?: string };
}

const VERSION_HINT_RE = /\bremix(?:es)?\b/i;

function normalizeKeyPart(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripVersionBrackets(track: string): string {
  let out = track;
  let changed = true;
  while (changed) {
    changed = false;
    out = out.replace(/\s*[\[(]([^\])]+)[\])]\s*$/g, (full, inner) => {
      if (VERSION_HINT_RE.test(String(inner))) {
        changed = true;
        return "";
      }
      return full;
    });
  }
  return out.trim();
}

function stripVersionDashSuffix(track: string): string {
  let out = track.trim();
  const m = out.match(/\s[-–]\s(.+)$/);
  if (m && VERSION_HINT_RE.test(m[1] ?? "")) {
    out = out.slice(0, m.index).trim();
  }
  return out;
}

function canonicalizeTrackName(track: string): string {
  let out = track.trim();
  out = stripVersionBrackets(out);
  out = stripVersionDashSuffix(out);
  out = out.replace(/\s+/g, " ").trim();
  return out || track.trim();
}

function canonicalizeArtistName(artist: string): string {
  return artist
    .replace(/\s+(feat\.?|ft\.?|featuring|with)\s+.+$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPage(
  username: string,
  apiKey: string,
  from: number,
  to: number,
  page: number,
): Promise<{ tracks: RawTrack[]; totalPages: number }> {
  const params = new URLSearchParams({
    method: "user.getRecentTracks",
    user: username,
    api_key: apiKey,
    format: "json",
    limit: "200",
    from: String(from),
    to: String(to),
    page: String(page),
  });

  const res = await fetch(`${BASE_URL}?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 404) throw new Error("Usuário Last.fm não encontrado. Verifique o nome de usuário nas configurações.");
    throw new Error(`Last.fm HTTP ${res.status}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(`Last.fm error ${data.error}: ${data.message}`);

  const raw = data.recenttracks?.track ?? [];
  const tracks: RawTrack[] = Array.isArray(raw) ? raw : [raw];
  const totalPages = Number(data.recenttracks?.["@attr"]?.totalPages ?? 1);

  return { tracks, totalPages };
}

/** Scrobbles com `from <= uts < to` (parâmetros do Last.fm: after `from`, before `to`). */
export async function fetchTracksBetweenUnix(from: number, toExclusive: number, usernameOverride?: string): Promise<TrackPlays[]> {
  const username = usernameOverride || process.env.LASTFM_USERNAME;
  const apiKey = process.env.API_KEY;

  if (!username || !apiKey) throw new Error("LASTFM_USERNAME and API_KEY must be set in env");
  if (from >= toExclusive) return [];

  let page = 1;
  let totalPages = 1;
  const grouped = new Map<string, TrackPlays>();

  do {
    const result = await fetchPage(username, apiKey, from, toExclusive, page);

    for (const track of result.tracks) {
      if (track["@attr"]?.nowplaying || !track.date?.uts) continue;

      const rawTrackName = track.name.trim();
      const rawArtistName = track.artist["#text"].trim();
      const trackName = canonicalizeTrackName(rawTrackName);
      const artistName = canonicalizeArtistName(rawArtistName) || rawArtistName;
      const key = `${normalizeKeyPart(trackName)}|||${normalizeKeyPart(artistName)}`;
      const dateStr = new Date(Number(track.date.uts) * 1000).toISOString().slice(0, 10);

      if (!grouped.has(key)) {
        grouped.set(key, { track: trackName, artist: artistName, album: track.album["#text"].trim(), dayPlays: [] });
      }

      const entry = grouped.get(key)!;
      const day = entry.dayPlays.find((d) => d.date === dateStr);
      if (day) {
        day.plays++;
      } else {
        entry.dayPlays.push({ date: dateStr, plays: 1 });
      }
    }

    totalPages = result.totalPages;
    page++;
    if (page > 50) break; // safety cap: ~10 000 scrobbles
  } while (page <= totalPages);

  return Array.from(grouped.values());
}

export async function fetchRecentTracks(days = 28, usernameOverride?: string): Promise<TrackPlays[]> {
  const now = Math.floor(Date.now() / 1000);
  return fetchTracksBetweenUnix(now - days * 86400, now + 1, usernameOverride);
}

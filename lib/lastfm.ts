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

  const res = await fetch(`${BASE_URL}?${params.toString()}`, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Last.fm HTTP ${res.status}`);

  const data = await res.json();
  if (data.error) throw new Error(`Last.fm error ${data.error}: ${data.message}`);

  const raw = data.recenttracks?.track ?? [];
  const tracks: RawTrack[] = Array.isArray(raw) ? raw : [raw];
  const totalPages = Number(data.recenttracks?.["@attr"]?.totalPages ?? 1);

  return { tracks, totalPages };
}

/** Scrobbles com `from <= uts < to` (parâmetros do Last.fm: after `from`, before `to`). */
export async function fetchTracksBetweenUnix(from: number, toExclusive: number): Promise<TrackPlays[]> {
  const username = process.env.LASTFM_USERNAME;
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

      const trackName = track.name.trim();
      const artistName = track.artist["#text"].trim();
      const key = `${trackName.toLowerCase()}|||${artistName.toLowerCase()}`;
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

export async function fetchRecentTracks(days = 28): Promise<TrackPlays[]> {
  const now = Math.floor(Date.now() / 1000);
  return fetchTracksBetweenUnix(now - days * 86400, now + 1);
}

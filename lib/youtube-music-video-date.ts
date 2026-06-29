/**
 * Data de publicação do videoclipe oficial no YouTube (YOUTUBE_API_KEY).
 * Ignora lyric videos e preferências não-clipe; entre candidatos válidos, a mais antiga.
 */

const API_BASE = "https://www.googleapis.com/youtube/v3";

const LYRIC_VIDEO_RE =
  /lyric(?:s)?\s*video|lyrics?\s*video|lyric[\s-]?version|with\s+lyrics|legendado|legenda|letras?|karaoke/i;

const NOT_MUSIC_VIDEO_RE =
  /official\s+audio|audio\s+only|visualizer|visualiser|hour\s+loop|1\s*hour|full\s+album|playlist|live\s+at|live\s+from|concert|interview|reaction|cover\s+by/i;

type SearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    publishedAt?: string;
  };
};

export type YouTubeMusicVideoDate = {
  date: Date | null;
  videoId: string | null;
  title: string | null;
};

function parseYoutubePublishedAt(raw: string | undefined): Date | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleMatchesSong(videoTitle: string, songTitle: string): boolean {
  const v = normalizeForMatch(videoTitle);
  const s = normalizeForMatch(songTitle);
  if (!s || !v) return false;
  if (v.includes(s)) return true;
  const words = s.split(" ").filter((w) => w.length > 2);
  if (!words.length) return v.includes(s);
  return words.every((w) => v.includes(w));
}

const FAN_UPLOAD_RE = /\bhq\b|\[hd\]|\bnew album\b|\bfan\b|fan[\s-]?made|bootleg/i;

function normalizeArtistKey(artist: string): string {
  return normalizeForMatch(artist).replace(/\s+/g, "");
}

function isTrustedChannel(channelTitle: string, artist: string): boolean {
  const c = channelTitle.toLowerCase();
  if (/\bvevo\b/i.test(c)) return true;
  const key = normalizeArtistKey(artist);
  if (!key) return false;
  const channelKey = normalizeForMatch(channelTitle).replace(/\s+/g, "");
  return channelKey.includes(key);
}

function isTrustedCandidate(
  videoTitle: string,
  channelTitle: string,
  artist: string,
): boolean {
  if (FAN_UPLOAD_RE.test(videoTitle)) return false;
  if (/official/i.test(videoTitle)) return true;
  return isTrustedChannel(channelTitle, artist);
}

function scoreMusicVideoCandidate(
  title: string,
  description: string,
  channelTitle: string,
  artist: string,
  songTitle: string,
): number {
  const text = `${title} ${description}`.toLowerCase();
  if (LYRIC_VIDEO_RE.test(text)) return -100;
  if (NOT_MUSIC_VIDEO_RE.test(text)) return -50;
  if (FAN_UPLOAD_RE.test(title)) return -100;
  if (!titleMatchesSong(title, songTitle)) return -100;

  let score = 0;
  const t = title.toLowerCase();
  const a = artist.toLowerCase();

  if (isTrustedChannel(channelTitle, artist)) score += 8;
  if (t.includes("official music video")) score += 6;
  else if (t.includes("music video")) score += 5;
  else if (t.includes("official video")) score += 4;
  else if (/\bvideo\b/.test(t)) score += 2;

  if (a && t.includes(a)) score += 2;

  if (/\(lyric/i.test(t)) return -100;
  if (!isTrustedCandidate(title, channelTitle, artist) && score < 4) return -100;
  return score;
}

async function searchCandidates(
  apiKey: string,
  query: string,
  maxResults = 8,
): Promise<SearchItem[]> {
  const url = new URL(`${API_BASE}/search`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("videoCategoryId", "10");
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("q", query);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const json = (await res.json()) as { items?: SearchItem[] };
  return json.items ?? [];
}

/** Videoclipe oficial mais antigo no YouTube (exclui lyric video e reuploads posteriores). */
export async function getYouTubeMusicVideoReleaseDate(
  title: string,
  artist: string,
): Promise<YouTubeMusicVideoDate> {
  const empty: YouTubeMusicVideoDate = { date: null, videoId: null, title: null };
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  const songTitle = title.trim();
  const artistName = artist.trim();
  if (!apiKey || !songTitle || !artistName) return empty;

  const queries = [
    `${artistName} ${songTitle} official music video`,
    `${artistName} - ${songTitle} music video`,
    `${artistName} ${songTitle} official video`,
    `${artistName} ${songTitle} video`,
  ];

  type Pick = {
    videoId: string;
    title: string;
    publishedAt: Date;
    score: number;
    trusted: boolean;
  };
  const byId = new Map<string, Pick>();

  for (const q of queries) {
    const items = await searchCandidates(apiKey, q);
    for (const item of items) {
      const videoId = item.id?.videoId;
      const snippet = item.snippet;
      if (!videoId || !snippet?.publishedAt) continue;

      const vTitle = snippet.title?.trim() ?? "";
      const channelTitle = snippet.channelTitle?.trim() ?? "";
      const score = scoreMusicVideoCandidate(
        vTitle,
        snippet.description ?? "",
        channelTitle,
        artistName,
        songTitle,
      );
      if (score < 1) continue;

      const publishedAt = parseYoutubePublishedAt(snippet.publishedAt);
      if (!publishedAt) continue;

      const trusted = isTrustedCandidate(vTitle, channelTitle, artistName);
      const existing = byId.get(videoId);
      if (!existing || score > existing.score) {
        byId.set(videoId, { videoId, title: vTitle, publishedAt, score, trusted });
      }
    }
  }

  const candidates = [...byId.values()];
  if (!candidates.length) return empty;

  const trusted = candidates.filter((c) => c.trusted);
  const pool = trusted.length ? trusted : candidates;
  const maxScore = Math.max(...pool.map((c) => c.score));
  const tier = pool.filter((c) => c.score >= maxScore - 1);
  tier.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());

  const best = tier[0]!;
  return {
    date: best.publishedAt,
    videoId: best.videoId,
    title: best.title,
  };
}

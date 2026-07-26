/**
 * Data de publicação do videoclipe oficial no YouTube (YOUTUBE_API_KEY).
 * Busca candidatos via search.list; a data de postagem vem de videos.list
 * (snippet.publishedAt), que é a fonte confiável — search.list não garante
 * a data real de upload.
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

type VideoListItem = {
  id?: string;
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

export function parseYoutubePublishedAt(raw: string | undefined): Date | null {
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

/** Data de postagem oficial via videos.list (até 50 ids por chamada). */
async function fetchVideosPublishedAt(
  apiKey: string,
  videoIds: string[],
): Promise<Map<string, { publishedAt: Date; title: string; channelTitle: string; description: string }>> {
  const out = new Map<
    string,
    { publishedAt: Date; title: string; channelTitle: string; description: string }
  >();
  const unique = [...new Set(videoIds.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const url = new URL(`${API_BASE}/videos`);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("id", chunk.join(","));
    url.searchParams.set("key", apiKey);

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) continue;
    const json = (await res.json()) as { items?: VideoListItem[] };
    for (const item of json.items ?? []) {
      const id = item.id?.trim();
      const publishedAt = parseYoutubePublishedAt(item.snippet?.publishedAt);
      if (!id || !publishedAt) continue;
      out.set(id, {
        publishedAt,
        title: item.snippet?.title?.trim() ?? "",
        channelTitle: item.snippet?.channelTitle?.trim() ?? "",
        description: item.snippet?.description ?? "",
      });
    }
  }
  return out;
}

/** Data de postagem de um vídeo conhecido (videos.list). */
export async function getYouTubeVideoPublishedAt(
  videoId: string,
): Promise<{ date: Date | null; title: string | null }> {
  const empty = { date: null, title: null };
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  const id = videoId.trim();
  if (!apiKey || !id) return empty;

  const map = await fetchVideosPublishedAt(apiKey, [id]);
  const hit = map.get(id);
  if (!hit) return empty;
  return { date: hit.publishedAt, title: hit.title || null };
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

  type Scored = {
    videoId: string;
    title: string;
    channelTitle: string;
    description: string;
    score: number;
    trusted: boolean;
  };
  const byId = new Map<string, Scored>();

  for (const q of queries) {
    const items = await searchCandidates(apiKey, q);
    for (const item of items) {
      const videoId = item.id?.videoId;
      const snippet = item.snippet;
      if (!videoId || !snippet) continue;

      const vTitle = snippet.title?.trim() ?? "";
      const channelTitle = snippet.channelTitle?.trim() ?? "";
      const description = snippet.description ?? "";
      const score = scoreMusicVideoCandidate(
        vTitle,
        description,
        channelTitle,
        artistName,
        songTitle,
      );
      if (score < 1) continue;

      const trusted = isTrustedCandidate(vTitle, channelTitle, artistName);
      const existing = byId.get(videoId);
      if (!existing || score > existing.score) {
        byId.set(videoId, {
          videoId,
          title: vTitle,
          channelTitle,
          description,
          score,
          trusted,
        });
      }
    }
  }

  if (!byId.size) return empty;

  // Data real de postagem: videos.list (não confiar em search.list).
  const details = await fetchVideosPublishedAt(apiKey, [...byId.keys()]);

  type Pick = {
    videoId: string;
    title: string;
    publishedAt: Date;
    score: number;
    trusted: boolean;
  };
  const candidates: Pick[] = [];
  for (const scored of byId.values()) {
    const detail = details.get(scored.videoId);
    if (!detail) continue;
    // Preferir título/canal do videos.list (mais atualizado).
    const vTitle = detail.title || scored.title;
    const channelTitle = detail.channelTitle || scored.channelTitle;
    const score = scoreMusicVideoCandidate(
      vTitle,
      detail.description || scored.description,
      channelTitle,
      artistName,
      songTitle,
    );
    if (score < 1) continue;
    candidates.push({
      videoId: scored.videoId,
      title: vTitle,
      publishedAt: detail.publishedAt,
      score,
      trusted: isTrustedCandidate(vTitle, channelTitle, artistName),
    });
  }

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

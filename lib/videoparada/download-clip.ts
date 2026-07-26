import { createHash } from "node:crypto";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const PARADE_VIDEOS_DIR = path.join(process.cwd(), "uploads", "parade-videos");
export const PARADE_RAW_DIR = path.join(PARADE_VIDEOS_DIR, "raw");
export const PARADE_VERTICAL_DIR = path.join(PARADE_VIDEOS_DIR, "vertical");

/** Sempre rejeitar (mesmo no Global flexível). */
const REJECT_ALWAYS_RE =
  /\b(official\s*audio|audio\s*only|topic|auto[- ]?generated|fan\s*made|cover\s*audio|reaction|reacts?\b|review|nightcore|sped\s*up|slowed)\b/i;

/** Só rejeitar no modo oficial (Disk MTV / community). */
const REJECT_OFFICIAL_ONLY_RE = /\b(lyrics?|lyric\s*video|visuali[sz]er)\b/i;

export type YoutubeSearchMode = "official" | "flexible";

export type DownloadClipResult = {
  youtubeId: string;
  filePath: string;
  cached: boolean;
  title: string | null;
};

export type YoutubeSearchHit = {
  youtubeId: string;
  title: string;
  channel: string | null;
  score: number;
};

function ytDlpBin() {
  return process.env.YT_DLP_PATH?.trim() || "yt-dlp";
}

export function youtubeUrlFromId(youtubeId: string): string {
  return `https://www.youtube.com/watch?v=${youtubeId}`;
}

export function extractYoutubeId(urlOrId: string): string | null {
  const raw = urlOrId.trim();
  if (/^[\w-]{11}$/.test(raw)) return raw;
  try {
    const u = new URL(raw);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace(/^\//, "").slice(0, 11);
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    const v = u.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return v;
    const m = u.pathname.match(/\/(?:embed|shorts)\/([\w-]{11})/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

export function rawClipPath(youtubeId: string): string {
  return path.join(PARADE_RAW_DIR, `${youtubeId}.mp4`);
}

export function verticalClipPath(
  youtubeId: string,
  startSec: number,
  endSec: number,
): string {
  const key = `${youtubeId}_${startSec.toFixed(1)}-${endSec.toFixed(1)}`;
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 10);
  return path.join(PARADE_VERTICAL_DIR, `${youtubeId}_${hash}.mp4`);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Tokens do artista/título para matching frouxo. */
export function textTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[&,+]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((t) => t.length >= 3 && !["the", "and", "feat", "featuring", "with", "from"].includes(t));
}

function artistTokens(artist: string): string[] {
  return textTokens(artist);
}

/**
 * Pontua resultado de busca YouTube.
 * Retorna null se o título for rejeitado.
 */
export function scoreSearchTitle(
  title: string,
  opts: {
    artist?: string;
    channel?: string | null;
    songTitle?: string;
    mode?: YoutubeSearchMode;
  } = {},
): number | null {
  const mode = opts.mode ?? "official";
  if (REJECT_ALWAYS_RE.test(title)) return null;
  if (mode === "official" && REJECT_OFFICIAL_ONLY_RE.test(title)) return null;

  let score = 1;
  if (/official\s*music\s*video/i.test(title)) score += 50;
  else if (/official\s*video/i.test(title)) score += 45;
  else if (/\bvevo\b/i.test(title) || /\bvevo\b/i.test(opts.channel ?? "")) score += 40;
  else if (/official\s*performance/i.test(title)) score += 25;
  else if (/music\s*video/i.test(title)) score += 20;
  else if (/official\s*live/i.test(title)) score += 15;
  else if (mode === "flexible" && /visuali[sz]er/i.test(title)) score += 18;
  else if (mode === "flexible" && /\b(lyrics?|lyric\s*video)\b/i.test(title)) score += 14;

  const songTokens = opts.songTitle ? textTokens(opts.songTitle) : [];
  const artistToks = opts.artist ? artistTokens(opts.artist) : [];
  const hay = `${title} ${opts.channel ?? ""}`.toLowerCase();

  if (songTokens.length) {
    const matched = songTokens.filter((t) => hay.includes(t)).length;
    score += matched * 12;
    // Sem overlap com o título da música → quase certamente vídeo errado
    if (matched === 0) return null;
  }

  if (artistToks.length) {
    const matched = artistToks.filter((t) => hay.includes(t)).length;
    score += matched * 8;
    if (matched === 0) score -= 20;
  }

  if (opts.channel && artistToks.length) {
    const ch = opts.channel.toLowerCase();
    if (artistToks.some((t) => ch.includes(t))) score += 25;
    if (/\bvevo\b/i.test(opts.channel)) score += 20;
  }

  return score;
}

/**
 * Busca clipe no YouTube via yt-dlp.
 * - official: só MV oficial (Disk MTV)
 * - flexible: Global — aceita lyric / visualizer / music video
 */
export async function searchOfficialYoutubeId(
  title: string,
  artist: string,
  opts: {
    ytDlpPath?: string;
    maxResults?: number;
    mode?: YoutubeSearchMode;
    excludeIds?: ReadonlySet<string>;
  } = {},
): Promise<YoutubeSearchHit | null> {
  const bin = opts.ytDlpPath ?? ytDlpBin();
  const maxResults = opts.maxResults ?? 10;
  const mode = opts.mode ?? "official";
  const query =
    mode === "flexible"
      ? `ytsearch${maxResults}:${artist} ${title}`
      : `ytsearch${maxResults}:${artist} ${title} official music video`;

  const { stdout } = await execFileAsync(
    bin,
    [
      query,
      "--flat-playlist",
      "--print",
      "%(id)s\t%(title)s\t%(channel)s",
      "--no-warnings",
      "--skip-download",
    ],
    { maxBuffer: 5 * 1024 * 1024, windowsHide: true },
  );

  const hits: YoutubeSearchHit[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const [id, tRaw, channelRaw] = line.split("\t");
    const t = (tRaw ?? "").trim();
    const channel = (channelRaw ?? "").trim() || null;
    if (!id || !/^[\w-]{11}$/.test(id) || !t) continue;
    if (opts.excludeIds?.has(id)) continue;
    const score = scoreSearchTitle(t, { artist, channel, songTitle: title, mode });
    if (score == null) continue;
    hits.push({ youtubeId: id, title: t, channel, score });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits[0] ?? null;
}

/**
 * Baixa o clipe com yt-dlp (cache em uploads/parade-videos/raw).
 */
export async function downloadYoutubeClip(
  youtubeIdOrUrl: string,
  opts: { force?: boolean; ytDlpPath?: string } = {},
): Promise<DownloadClipResult> {
  const youtubeId = extractYoutubeId(youtubeIdOrUrl);
  if (!youtubeId) throw new Error(`YouTube ID inválido: ${youtubeIdOrUrl}`);

  await mkdir(PARADE_RAW_DIR, { recursive: true });
  const filePath = rawClipPath(youtubeId);

  if (!opts.force && (await exists(filePath))) {
    return { youtubeId, filePath, cached: true, title: null };
  }

  const bin = opts.ytDlpPath ?? ytDlpBin();
  const url = youtubeUrlFromId(youtubeId);
  const outTemplate = path.join(PARADE_RAW_DIR, `${youtubeId}.%(ext)s`);

  try {
    const { stdout } = await execFileAsync(
      bin,
      [
        "--no-playlist",
        "--no-warnings",
        "-f",
        "bv*[ext=mp4][height<=1080]+ba[ext=m4a]/b[ext=mp4][height<=1080]/b",
        "--merge-output-format",
        "mp4",
        "-o",
        outTemplate,
        "--print",
        "%(title)s",
        "--no-simulate",
        url,
      ],
      { maxBuffer: 20 * 1024 * 1024, windowsHide: true },
    );

    if (!(await exists(filePath))) {
      throw new Error(`yt-dlp terminou sem gerar ${filePath}`);
    }

    const title = stdout.trim().split(/\r?\n/).filter(Boolean).pop() ?? null;
    if (title && REJECT_ALWAYS_RE.test(title)) {
      console.warn(`[videoparada] aviso: título suspeito para clipe: ${title}`);
    }

    return { youtubeId, filePath, cached: false, title };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Falha ao baixar ${youtubeId}: ${msg}`);
  }
}

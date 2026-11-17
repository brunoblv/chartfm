import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Mídia da central de notícias (foto, vídeo enviado, artes e vídeo final).
 * Fica em disco e é servida por /api/news-media/... em runtime — em produção
 * o Next não serve arquivos criados em public/ depois do build (mesmo motivo
 * de lib/social/image-path.ts). A rota é pública porque o Instagram baixa
 * a mídia por URL na hora de publicar.
 */
export const NEWS_MEDIA_ROOT = path.join(process.cwd(), "public", "generated", "news");

// Nomes fixos: também é a sanitização contra path traversal.
const FILE_RE = /^(photo\.(?:jpg|png|webp)|source\.(?:mp4|mov)|slide-\d{1,2}\.png|final\.mp4)$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export const NEWS_PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const NEWS_VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov" };
export const NEWS_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const NEWS_VIDEO_MAX_BYTES = 200 * 1024 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

export function newsMediaDiskPath(postId: string, file: string): string | null {
  if (!ID_RE.test(postId) || !FILE_RE.test(file)) return null;
  return path.join(NEWS_MEDIA_ROOT, postId, file);
}

export function newsMediaContentType(file: string): string {
  return CONTENT_TYPES[file.split(".").pop() ?? ""] ?? "application/octet-stream";
}

/** URL servida em runtime; `v` evita cache quando o arquivo é substituído com o mesmo nome. */
export function newsMediaUrl(postId: string, file: string): string {
  return `/api/news-media/${postId}/${file}?v=${Date.now()}`;
}

/** Caminho em disco a partir de uma URL gerada por newsMediaUrl (ignora a query). */
export function newsMediaPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = /^\/api\/news-media\/([^/?]+)\/([^/?]+)(?:\?.*)?$/.exec(url);
  return m ? newsMediaDiskPath(m[1], m[2]) : null;
}

export async function saveNewsMedia(postId: string, file: string, data: Buffer): Promise<string> {
  const disk = newsMediaDiskPath(postId, file);
  if (!disk) throw new Error(`Arquivo de mídia inválido: ${file}`);
  await fs.mkdir(path.dirname(disk), { recursive: true });
  await fs.writeFile(disk, data);
  return newsMediaUrl(postId, file);
}

/** Remove arquivos do post cujo nome casa com o prefixo (ex.: "slide-" ou "photo."). */
export async function removeNewsMedia(postId: string, prefix: string): Promise<void> {
  if (!ID_RE.test(postId)) return;
  const dir = path.join(NEWS_MEDIA_ROOT, postId);
  const files = await fs.readdir(dir).catch(() => [] as string[]);
  await Promise.all(files.filter((f) => f.startsWith(prefix)).map((f) => fs.unlink(path.join(dir, f)).catch(() => null)));
}

export async function removeAllNewsMedia(postId: string): Promise<void> {
  if (!ID_RE.test(postId)) return;
  await fs.rm(path.join(NEWS_MEDIA_ROOT, postId), { recursive: true, force: true });
}

/** Área do vídeo no post com vídeo: abaixo da faixa de texto (600 px) e da divisa (6 px). */
export const NEWS_VIDEO_AREA = { top: 606, width: 1080, height: 834 } as const;

/**
 * Monta o vídeo final 1080x1440: a arte (com a área do vídeo vazia) por cima de
 * tudo e o vídeo enviado recortado para 1080x834 embaixo. Mantém o áudio original.
 */
export async function composeNewsVideo(postId: string, cardPng: string, sourceVideo: string): Promise<string> {
  const out = newsMediaDiskPath(postId, "final.mp4");
  if (!out) throw new Error("postId inválido");
  const { top, width, height } = NEWS_VIDEO_AREA;
  const filter =
    `[1:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1[vid];` +
    `[0:v][vid]overlay=0:${top}:shortest=1,format=yuv420p[out]`;
  await execFileAsync(
    process.env.FFMPEG_PATH || "ffmpeg",
    [
      "-y",
      "-loop", "1",
      "-i", cardPng,
      "-i", sourceVideo,
      "-filter_complex", filter,
      "-map", "[out]",
      "-map", "1:a?",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "20",
      "-r", "30",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      out,
    ],
    { timeout: 5 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 },
  );
  return newsMediaUrl(postId, "final.mp4");
}

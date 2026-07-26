/**
 * Upload de vídeo ao canal ChartFM via YouTube Data API (resumable).
 * Requer OAuth do @bruno (mesmo fluxo de playlists Push).
 */
import { createReadStream, statSync } from "node:fs";
import {
  getPushYouTubeOwnerUser,
  getYouTubeAccessToken,
  youtubeOAuthConfigured,
} from "@/lib/youtube-user";

const UPLOAD_API = "https://www.googleapis.com/upload/youtube/v3/videos";
const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB

export type YouTubeUploadPrivacy = "public" | "unlisted" | "private";

export type YouTubeUploadInput = {
  filePath: string;
  title: string;
  description?: string;
  tags?: string[];
  categoryId?: string; // 10 = Music
  privacyStatus?: YouTubeUploadPrivacy;
  /** ISO 8601 — agenda publicação (requer privacy private no insert). */
  publishAt?: string | null;
};

export type YouTubeUploadResult = {
  videoId: string;
  url: string;
  title: string;
};

async function initiateResumableSession(
  accessToken: string,
  meta: {
    title: string;
    description: string;
    tags: string[];
    categoryId: string;
    privacyStatus: YouTubeUploadPrivacy;
    publishAt?: string | null;
  },
  fileSize: number,
): Promise<string> {
  const status: Record<string, unknown> = {
    privacyStatus: meta.publishAt ? "private" : meta.privacyStatus,
    selfDeclaredMadeForKids: false,
  };
  if (meta.publishAt) status.publishAt = meta.publishAt;

  const res = await fetch(`${UPLOAD_API}?uploadType=resumable&part=snippet,status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(fileSize),
      "X-Upload-Content-Type": "video/mp4",
    },
    body: JSON.stringify({
      snippet: {
        title: meta.title.slice(0, 100),
        description: meta.description.slice(0, 5000),
        tags: meta.tags.slice(0, 30),
        categoryId: meta.categoryId,
      },
      status,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`YouTube initiate upload failed (${res.status}): ${text.slice(0, 400)}`);
  }

  const location = res.headers.get("location");
  if (!location) throw new Error("YouTube initiate upload: missing Location header");
  return location;
}

async function uploadFileResumable(
  sessionUrl: string,
  accessToken: string,
  filePath: string,
  fileSize: number,
): Promise<{ id: string; snippet?: { title?: string } }> {
  // Arquivos típicos da videoparada cabem em um PUT único; chunks para >~256MB.
  if (fileSize <= CHUNK_SIZE) {
    const buf = await import("node:fs/promises").then((fs) => fs.readFile(filePath));
    const res = await fetch(sessionUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "video/mp4",
        "Content-Length": String(fileSize),
      },
      body: buf,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`YouTube upload failed (${res.status}): ${text.slice(0, 400)}`);
    }
    return (await res.json()) as { id: string; snippet?: { title?: string } };
  }

  let offset = 0;
  const stream = createReadStream(filePath, { highWaterMark: CHUNK_SIZE });
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const start = offset;
    const end = offset + buf.length - 1;
    offset += buf.length;
    const res = await fetch(sessionUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "video/mp4",
        "Content-Length": String(buf.length),
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      },
      body: buf,
    });
    // 308 = Resume Incomplete; 200/201 = done
    if (res.status === 308) continue;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`YouTube chunk upload failed (${res.status}): ${text.slice(0, 400)}`);
    }
    return (await res.json()) as { id: string; snippet?: { title?: string } };
  }
  throw new Error("YouTube upload ended without final response");
}

/** Faz upload do MP4 ao canal OAuth do dono (@bruno / @chartFM). */
export async function uploadVideoToChartFmYouTube(
  input: YouTubeUploadInput,
): Promise<YouTubeUploadResult> {
  if (!youtubeOAuthConfigured()) {
    throw new Error("YouTube OAuth não configurado (YOUTUBE_CLIENT_ID/SECRET)");
  }

  const owner = await getPushYouTubeOwnerUser();
  if (!owner) throw new Error("Usuário dono do canal YouTube não encontrado");

  const accessToken = await getYouTubeAccessToken(owner.id);
  if (!accessToken) {
    throw new Error(
      "Sem token YouTube — reconecte o canal em /admin (OAuth @bruno / @chartFM)",
    );
  }

  const fileSize = statSync(input.filePath).size;
  if (fileSize <= 0) throw new Error(`Arquivo vazio: ${input.filePath}`);

  const sessionUrl = await initiateResumableSession(
    accessToken,
    {
      title: input.title,
      description: input.description ?? "",
      tags: input.tags ?? ["ChartFM", "parada", "Disk MTV"],
      categoryId: input.categoryId ?? "10",
      privacyStatus: input.privacyStatus ?? "public",
      publishAt: input.publishAt,
    },
    fileSize,
  );

  const uploaded = await uploadFileResumable(sessionUrl, accessToken, input.filePath, fileSize);
  if (!uploaded.id) throw new Error("YouTube upload: resposta sem video id");

  return {
    videoId: uploaded.id,
    url: `https://www.youtube.com/watch?v=${uploaded.id}`,
    title: uploaded.snippet?.title ?? input.title,
  };
}

export function defaultDiskMtvYouTubeMeta(opts: {
  weekLabel: string;
  weekIndex?: number;
  limit?: number;
  dateRange?: string;
  siteUrl?: string;
}): { title: string; description: string; tags: string[] } {
  const site = opts.siteUrl ?? "chartfm.com";
  const limit = opts.limit ?? 20;

  // "Semana 28 - 2026" → "Semana 28, 2026"
  let weekPart = opts.weekLabel.trim().replace(/\s*-\s*(\d{4})\s*$/, ", $1");
  if (opts.weekIndex != null && !/^Semana\s+\d+/i.test(weekPart)) {
    const year = Math.floor(opts.weekIndex / 100);
    const week = opts.weekIndex % 100;
    weekPart = `Semana ${week}, ${year}`;
  }

  const title = `Disk MTV Top ${limit} - ${weekPart}`;
  const description = [
    `Disk MTV Top ${limit} da comunidade Disk MTV no ChartFM.`,
    opts.dateRange ? `Período: ${opts.dateRange}.` : null,
    "",
    `Assista a parada completa: https://${site}/community/disk-mtv`,
    "",
    "#ChartFM #DiskMTV #parada #charts",
  ]
    .filter((l) => l != null)
    .join("\n");

  return {
    title,
    description,
    tags: ["ChartFM", "Disk MTV", "parada musical", "charts", `Top ${limit}`],
  };
}

/** Evita reupload da mesma semana (arquivo marcador em out/). */
export function diskMtvUploadMarkerName(weekIndex: number, format: string): string {
  return `videoparada-disk-mtv-${weekIndex}-${format}.uploaded.json`;
}

import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getVideoparadaAdminPayload, resolveDefaultVideoparadaWeek } from "@/lib/videoparada";
import { extractYoutubeId, searchOfficialYoutubeId } from "@/lib/videoparada/download-clip";
import {
  prepareParadeClip,
  type ParadeVideoFormat,
} from "@/lib/videoparada/prepare-clip";
import {
  VIDEOPARADA_SHORTS_SECONDS,
  VIDEOPARADA_YOUTUBE_SECONDS,
  type RemotionVideoparadaEntry,
  type RemotionVideoparadaProps,
} from "@/lib/videoparada-shared";

export type PreparedVideoparadaSong = {
  position: number;
  songId: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  status: RemotionVideoparadaEntry["status"];
  delta: number | null;
  isDebut: boolean;
  peak: number;
  weeks: number;
  numberOnes: number;
  youtubeId: string | null;
  publicRelPath: string | null;
  verticalPath: string | null;
  startSec: number | null;
  endSec: number | null;
  windowStrategy?: string;
  error?: string;
};

export async function resolveYoutubeIdForSong(
  songId: string,
  title: string,
  artist: string,
  configVideoUrl: string | null | undefined,
  suggestedYoutubeId: string | null | undefined,
): Promise<string | null> {
  if (configVideoUrl) {
    const fromUrl = extractYoutubeId(configVideoUrl);
    if (fromUrl) return fromUrl;
  }
  if (suggestedYoutubeId) return suggestedYoutubeId;

  const clip = await prisma.songVideoClip.findFirst({
    where: { songId, clipType: "OFFICIAL", youtubeId: { not: null } },
    orderBy: { votes: "desc" },
    select: { youtubeId: true },
  });
  if (clip?.youtubeId) return clip.youtubeId;

  const hit = await searchOfficialYoutubeId(title, artist);
  return hit?.youtubeId ?? null;
}

export async function prepareVideoparadaFromChart(opts: {
  chartKind?: string;
  weekIndex?: number | null;
  limit?: number;
  clipSeconds?: number;
  force?: boolean;
  format?: ParadeVideoFormat;
}): Promise<{
  props: RemotionVideoparadaProps;
  songs: PreparedVideoparadaSong[];
  weekIndex: number;
  chartKind: string;
  format: ParadeVideoFormat;
}> {
  const chartKind = opts.chartKind ?? "global";
  const limit = opts.limit ?? 3;
  const format = opts.format ?? "vertical";
  const clipSeconds =
    opts.clipSeconds ??
    (format === "landscape" ? VIDEOPARADA_YOUTUBE_SECONDS : VIDEOPARADA_SHORTS_SECONDS);

  let weekIndex = opts.weekIndex ?? null;
  if (weekIndex == null) {
    weekIndex = await resolveDefaultVideoparadaWeek(chartKind);
  }
  if (weekIndex == null) throw new Error("Nenhuma semana disponível para a parada");

  const payload = await getVideoparadaAdminPayload(chartKind, weekIndex);
  if ("error" in payload) throw new Error(payload.error);

  const top = payload.entries.slice(0, limit);
  const publicDir = path.join(process.cwd(), "public", "videoparada", "clips", format);
  const songs: PreparedVideoparadaSong[] = [];

  for (const e of top) {
    const skip = e.config.skipAutoVideo;
    let youtubeId: string | null = null;
    if (!skip) {
      youtubeId = await resolveYoutubeIdForSong(
        e.songId,
        e.title,
        e.artist,
        e.config.videoUrl,
        e.suggestedYoutubeId,
      );
    }

    const base: PreparedVideoparadaSong = {
      position: e.position,
      songId: e.songId,
      title: e.title,
      artist: e.artist,
      coverUrl: e.coverUrl,
      status: e.status,
      delta: e.delta,
      isDebut: e.config.forceDebut || e.status === "new",
      peak: e.peak,
      weeks: e.weeks,
      numberOnes: e.numberOnes,
      youtubeId,
      publicRelPath: null,
      verticalPath: null,
      startSec: null,
      endSec: null,
    };

    if (!youtubeId) {
      songs.push({
        ...base,
        error: skip ? "skipAutoVideo" : "sem youtubeId (DB/busca)",
      });
      continue;
    }

    try {
      const publicRelPath = `videoparada/clips/${format}/${e.position}-${youtubeId}.mp4`;
      const publicCopyPath = path.join(publicDir, `${e.position}-${youtubeId}.mp4`);
      const prepared = await prepareParadeClip({
        youtubeIdOrUrl: youtubeId,
        startSeconds: e.config.startSeconds,
        endSeconds: e.config.endSeconds,
        clipSeconds,
        force: opts.force,
        publicCopyPath,
        format,
        detectChorus: true,
        faceBoost: true,
      });

      songs.push({
        ...base,
        publicRelPath,
        verticalPath: prepared.verticalPath,
        startSec: prepared.startSec,
        endSec: prepared.endSec,
        windowStrategy: prepared.windowStrategy,
      });
    } catch (err) {
      songs.push({
        ...base,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const props: RemotionVideoparadaProps = {
    chartName: payload.chartLabel,
    weekLabel: payload.weekLabel,
    siteUrl: "chartfm.com",
    format,
    entries: songs.map((s) => ({
      position: s.position,
      title: s.title,
      artist: s.artist,
      coverUrl: s.coverUrl,
      coverPalette: ["#FA243C", "#FF5858"],
      status: s.status,
      delta: s.delta,
      isDebut: s.isDebut,
      peak: s.peak,
      weeks: s.weeks,
      numberOnes: s.numberOnes,
      videoSrc: s.publicRelPath ? `/${s.publicRelPath}` : null,
    })),
  };

  return { props, songs, weekIndex, chartKind, format };
}

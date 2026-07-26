import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  downloadYoutubeClip,
  extractYoutubeId,
  verticalClipPath,
} from "@/lib/videoparada/download-clip";
import { detectChorusWindow } from "@/lib/videoparada/chorus-detect";
import {
  probeVideo,
  smartCropVideoToFormat,
  type SmartCropAnalysis,
} from "@/lib/videoparada/smart-crop";
import {
  VIDEOPARADA_SHORTS_SECONDS,
  VIDEOPARADA_YOUTUBE_SECONDS,
} from "@/lib/videoparada-shared";

export type ParadeVideoFormat = "vertical" | "landscape";

export type PrepareClipInput = {
  youtubeIdOrUrl: string;
  startSeconds?: number | null;
  endSeconds?: number | null;
  clipSeconds?: number;
  force?: boolean;
  publicCopyPath?: string | null;
  format?: ParadeVideoFormat;
  /** Usa detecção de refrão por energia (padrão true se sem timestamps manuais). */
  detectChorus?: boolean;
  faceBoost?: boolean;
};

export type PrepareClipResult = {
  youtubeId: string;
  rawPath: string;
  verticalPath: string;
  publicPath: string | null;
  startSec: number;
  endSec: number;
  rawCached: boolean;
  analysis: SmartCropAnalysis;
  windowStrategy: string;
  format: ParadeVideoFormat;
};

/**
 * Escolhe trecho: manual > (opcional) refrão por energia > heurística 35%.
 */
export function resolveClipWindow(
  durationSec: number,
  opts: {
    startSeconds?: number | null;
    endSeconds?: number | null;
    clipSeconds?: number;
  },
): { startSec: number; endSec: number; strategy: "manual" | "heuristic-35" } {
  const clipLen = Math.max(1, opts.clipSeconds ?? VIDEOPARADA_SHORTS_SECONDS);

  if (
    opts.startSeconds != null &&
    Number.isFinite(opts.startSeconds) &&
    opts.endSeconds != null &&
    Number.isFinite(opts.endSeconds) &&
    opts.endSeconds > opts.startSeconds
  ) {
    return {
      startSec: Math.max(0, opts.startSeconds),
      endSec: Math.min(durationSec, opts.endSeconds),
      strategy: "manual",
    };
  }

  if (opts.startSeconds != null && Number.isFinite(opts.startSeconds)) {
    const startSec = Math.max(0, Math.min(opts.startSeconds, Math.max(0, durationSec - 1)));
    return {
      startSec,
      endSec: Math.min(durationSec, startSec + clipLen),
      strategy: "manual",
    };
  }

  const idealStart = durationSec * 0.35;
  const maxStart = Math.max(0, durationSec - clipLen);
  const startSec = Math.min(Math.max(0, idealStart), maxStart);
  return {
    startSec,
    endSec: Math.min(durationSec, startSec + clipLen),
    strategy: "heuristic-35",
  };
}

function formatOutputSize(format: ParadeVideoFormat) {
  if (format === "landscape") {
    return { outWidth: 1920, outHeight: 1080, targetAspect: 16 / 9 };
  }
  return { outWidth: 1080, outHeight: 1920, targetAspect: 9 / 16 };
}

/**
 * Download → (refrão) → smart-crop → MP4 no formato pedido.
 */
export async function prepareParadeClip(
  input: PrepareClipInput,
): Promise<PrepareClipResult> {
  const youtubeId = extractYoutubeId(input.youtubeIdOrUrl);
  if (!youtubeId) throw new Error(`YouTube ID inválido: ${input.youtubeIdOrUrl}`);

  const format = input.format ?? "vertical";
  const clipSeconds =
    input.clipSeconds ??
    (format === "landscape" ? VIDEOPARADA_YOUTUBE_SECONDS : VIDEOPARADA_SHORTS_SECONDS);

  const downloaded = await downloadYoutubeClip(youtubeId, { force: input.force });
  const probe = await probeVideo(downloaded.filePath);

  let startSec: number;
  let endSec: number;
  let windowStrategy: string;

  const hasManual =
    (input.startSeconds != null && Number.isFinite(input.startSeconds)) ||
    (input.endSeconds != null && Number.isFinite(input.endSeconds));

  if (hasManual) {
    const w = resolveClipWindow(probe.durationSec, {
      startSeconds: input.startSeconds,
      endSeconds: input.endSeconds,
      clipSeconds,
    });
    startSec = w.startSec;
    endSec = w.endSec;
    windowStrategy = w.strategy;
  } else if (input.detectChorus !== false) {
    const chorus = await detectChorusWindow(downloaded.filePath, { clipSeconds });
    startSec = Math.min(chorus.startSec, Math.max(0, probe.durationSec - clipSeconds));
    // Duração exata do formato (6s Shorts / 11s YouTube)
    endSec = Math.min(probe.durationSec, startSec + clipSeconds);
    if (endSec - startSec < clipSeconds - 0.05 && probe.durationSec >= clipSeconds) {
      startSec = Math.max(0, probe.durationSec - clipSeconds);
      endSec = probe.durationSec;
    }
    windowStrategy = chorus.strategy;
  } else {
    const w = resolveClipWindow(probe.durationSec, { clipSeconds });
    startSec = w.startSec;
    endSec = w.endSec;
    windowStrategy = w.strategy;
  }

  const outPath = verticalClipPath(youtubeId, startSec, endSec).replace(
    `${path.sep}vertical${path.sep}`,
    `${path.sep}${format}${path.sep}`,
  );

  const size = formatOutputSize(format);
  const analysis = await smartCropVideoToFormat(downloaded.filePath, outPath, {
    startSec,
    endSec,
    sampleCount: 5,
    faceBoost: input.faceBoost !== false,
    ...size,
  });

  let publicPath: string | null = null;
  if (input.publicCopyPath) {
    await mkdir(path.dirname(input.publicCopyPath), { recursive: true });
    await copyFile(outPath, input.publicCopyPath);
    publicPath = input.publicCopyPath;
  }

  return {
    youtubeId,
    rawPath: downloaded.filePath,
    verticalPath: outPath,
    publicPath,
    startSec,
    endSec,
    rawCached: downloaded.cached,
    analysis,
    windowStrategy,
    format,
  };
}

/** @deprecated use prepareParadeClip */
export async function prepareVerticalClip(
  input: PrepareClipInput,
): Promise<PrepareClipResult> {
  return prepareParadeClip({ ...input, format: input.format ?? "vertical" });
}

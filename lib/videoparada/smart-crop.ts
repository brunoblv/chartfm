import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import smartcrop from "smartcrop-sharp";
import { detectSkinBoostRegions } from "@/lib/videoparada/face-boost";

const execFileAsync = promisify(execFile);

export type SmartCropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SmartCropAnalysis = {
  sourceWidth: number;
  sourceHeight: number;
  durationSec: number;
  crop: SmartCropRect;
  samples: Array<{ t: number; crop: SmartCropRect; score: number; boostCount: number }>;
  strategy: "smartcrop" | "center";
  faceBoost: boolean;
};

export type SmartCropOptions = {
  targetAspect?: number;
  sampleCount?: number;
  startSec?: number;
  endSec?: number | null;
  outWidth?: number;
  outHeight?: number;
  ffmpegPath?: string;
  ffprobePath?: string;
  faceBoost?: boolean;
};

type ProbeInfo = {
  width: number;
  height: number;
  durationSec: number;
};

function ffmpegBin(opts: SmartCropOptions) {
  return opts.ffmpegPath ?? "ffmpeg";
}

function ffprobeBin(opts: SmartCropOptions) {
  return opts.ffprobePath ?? "ffprobe";
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function centerCropRect(
  sourceWidth: number,
  sourceHeight: number,
  targetAspect: number,
): SmartCropRect {
  const srcAspect = sourceWidth / sourceHeight;
  if (srcAspect > targetAspect) {
    const width = Math.round(sourceHeight * targetAspect);
    const height = sourceHeight;
    const x = Math.round((sourceWidth - width) / 2);
    return { x, y: 0, width, height };
  }
  const width = sourceWidth;
  const height = Math.round(sourceWidth / targetAspect);
  const y = Math.round((sourceHeight - height) / 2);
  return { x: 0, y, width, height };
}

export async function probeVideo(
  inputPath: string,
  opts: SmartCropOptions = {},
): Promise<ProbeInfo> {
  const { stdout } = await execFileAsync(ffprobeBin(opts), [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height:format=duration",
    "-of",
    "json",
    inputPath,
  ]);
  const json = JSON.parse(stdout) as {
    streams?: Array<{ width?: number; height?: number }>;
    format?: { duration?: string };
  };
  const stream = json.streams?.[0];
  const width = stream?.width;
  const height = stream?.height;
  const durationSec = Number(json.format?.duration ?? 0);
  if (!width || !height || !Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error(`ffprobe: metadados inválidos em ${inputPath}`);
  }
  return { width, height, durationSec };
}

async function extractFrame(
  inputPath: string,
  t: number,
  outPath: string,
  opts: SmartCropOptions,
) {
  await execFileAsync(ffmpegBin(opts), [
    "-y",
    "-ss",
    t.toFixed(3),
    "-i",
    inputPath,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    outPath,
  ]);
}

export async function analyzeSmartCrop(
  inputPath: string,
  opts: SmartCropOptions = {},
): Promise<SmartCropAnalysis> {
  const targetAspect = opts.targetAspect ?? 9 / 16;
  const sampleCount = Math.max(1, opts.sampleCount ?? 5);
  const useFaceBoost = opts.faceBoost !== false;
  const probe = await probeVideo(inputPath, opts);

  const startSec = Math.max(0, opts.startSec ?? 0);
  const endSec = Math.min(
    probe.durationSec,
    opts.endSec == null ? probe.durationSec : opts.endSec,
  );
  if (endSec <= startSec) {
    throw new Error("Trecho inválido: endSec deve ser > startSec");
  }

  const ideal = centerCropRect(probe.width, probe.height, targetAspect);
  const cropWidth = ideal.width;
  const cropHeight = ideal.height;

  const srcAspect = probe.width / probe.height;
  if (Math.abs(srcAspect - targetAspect) < 0.02) {
    return {
      sourceWidth: probe.width,
      sourceHeight: probe.height,
      durationSec: probe.durationSec,
      crop: ideal,
      samples: [],
      strategy: "center",
      faceBoost: false,
    };
  }

  const tmp = await mkdtemp(path.join(tmpdir(), "cfm-smartcrop-"));
  const samples: SmartCropAnalysis["samples"] = [];

  try {
    for (let i = 0; i < sampleCount; i++) {
      const ratio = sampleCount === 1 ? 0.5 : i / (sampleCount - 1);
      const t = startSec + (endSec - startSec) * (0.12 + ratio * 0.76);
      const framePath = path.join(tmp, `frame-${i}.jpg`);
      await extractFrame(inputPath, t, framePath, opts);

      const boost = useFaceBoost ? await detectSkinBoostRegions(framePath) : [];
      const result = await smartcrop.crop(framePath, {
        width: cropWidth,
        height: cropHeight,
        minScale: 1,
        ruleOfThirds: true,
        ...(boost.length ? { boost } : {}),
      });

      const top = result.topCrop as {
        x: number;
        y: number;
        width: number;
        height: number;
        score?: number | { total?: number };
      };
      const scoreRaw = top.score;
      const score =
        typeof scoreRaw === "number"
          ? scoreRaw
          : typeof scoreRaw?.total === "number"
            ? scoreRaw.total
            : 0;
      samples.push({
        t,
        crop: { x: top.x, y: top.y, width: top.width, height: top.height },
        score,
        boostCount: boost.length,
      });
    }
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }

  if (!samples.length) {
    return {
      sourceWidth: probe.width,
      sourceHeight: probe.height,
      durationSec: probe.durationSec,
      crop: ideal,
      samples,
      strategy: "center",
      faceBoost: useFaceBoost,
    };
  }

  const x = Math.round(median(samples.map((s) => s.crop.x)));
  const y = Math.round(median(samples.map((s) => s.crop.y)));
  const width = Math.round(median(samples.map((s) => s.crop.width)));
  const height = Math.round(median(samples.map((s) => s.crop.height)));

  const crop: SmartCropRect = {
    x: clamp(x, 0, probe.width - width),
    y: clamp(y, 0, probe.height - height),
    width: clamp(width, 1, probe.width),
    height: clamp(height, 1, probe.height),
  };

  return {
    sourceWidth: probe.width,
    sourceHeight: probe.height,
    durationSec: probe.durationSec,
    crop,
    samples,
    strategy: "smartcrop",
    faceBoost: useFaceBoost && samples.some((s) => s.boostCount > 0),
  };
}

export async function applyFixedCrop(
  inputPath: string,
  outputPath: string,
  crop: SmartCropRect,
  opts: SmartCropOptions = {},
): Promise<void> {
  const outWidth = opts.outWidth ?? 1080;
  const outHeight = opts.outHeight ?? 1920;
  await mkdir(path.dirname(outputPath), { recursive: true });

  const vf = `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},scale=${outWidth}:${outHeight}:flags=lanczos,setsar=1`;
  const args = ["-y", "-i", inputPath];

  if (opts.startSec != null && opts.startSec > 0) {
    args.push("-ss", String(opts.startSec));
  }
  if (opts.endSec != null && opts.startSec != null) {
    args.push("-t", String(Math.max(0.1, opts.endSec - opts.startSec)));
  } else if (opts.endSec != null && opts.startSec == null) {
    args.push("-t", String(opts.endSec));
  }

  args.push(
    "-vf",
    vf,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "18",
    "-r",
    "30",
    "-g",
    "30",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath,
  );

  await execFileAsync(ffmpegBin(opts), args);
}

export async function smartCropVideoToVertical(
  inputPath: string,
  outputPath: string,
  opts: SmartCropOptions = {},
): Promise<SmartCropAnalysis> {
  return smartCropVideoToFormat(inputPath, outputPath, {
    ...opts,
    targetAspect: 9 / 16,
    outWidth: opts.outWidth ?? 1080,
    outHeight: opts.outHeight ?? 1920,
  });
}

export async function smartCropVideoToFormat(
  inputPath: string,
  outputPath: string,
  opts: SmartCropOptions = {},
): Promise<SmartCropAnalysis> {
  const analysis = await analyzeSmartCrop(inputPath, opts);
  await applyFixedCrop(inputPath, outputPath, analysis.crop, opts);
  const metaPath = outputPath.replace(/\.mp4$/i, ".crop.json");
  await writeFile(
    metaPath,
    JSON.stringify({ input: path.resolve(inputPath), output: path.resolve(outputPath), ...analysis }, null, 2),
    "utf8",
  );
  return analysis;
}

export async function listCropMeta(dir: string): Promise<string[]> {
  try {
    const files = await readdir(dir);
    return files.filter((f) => f.endsWith(".crop.json")).map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

/**
 * Job semanal Disk MTV: prepara clipes → Remotion → upload YouTube.
 *
 * Uso:
 *   npx tsx scripts/videoparada-disk-mtv-weekly.ts
 *   npx tsx scripts/videoparada-disk-mtv-weekly.ts --limit=20 --format=landscape
 *   npx tsx scripts/videoparada-disk-mtv-weekly.ts --dry-run   # só gera, não sobe
 *   npx tsx scripts/videoparada-disk-mtv-weekly.ts --force    # ignora marcador de upload
 */
import { access, mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prepareVideoparadaFromChart } from "../lib/videoparada/prepare-chart";
import { calcDurationFrames } from "../remotion/data/timing";
import { prisma } from "../lib/prisma";
import type { ParadeVideoFormat } from "../lib/videoparada/prepare-clip";
import {
  defaultDiskMtvYouTubeMeta,
  diskMtvUploadMarkerName,
  uploadVideoToChartFmYouTube,
} from "../lib/videoparada/youtube-upload";

const execFileAsync = promisify(execFile);

const CHART_KIND = "community:disk-mtv";

function argValue(args: string[], name: string): string | null {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limit = Number(argValue(args, "limit") ?? process.env.VIDEOPARADA_DISK_MTV_LIMIT ?? "20");
  const weekRaw = argValue(args, "week");
  const weekIndex = weekRaw ? Number(weekRaw) : null;
  const formatRaw = argValue(args, "format") ?? "landscape";
  const format: ParadeVideoFormat = formatRaw === "vertical" ? "vertical" : "landscape";
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");
  const skipUpload = dryRun || args.includes("--skip-upload");
  const privacy =
    (argValue(args, "privacy") as "public" | "unlisted" | "private" | null) ?? "public";

  console.log(`Disk MTV weekly · ${format} · top ${limit}${dryRun ? " · dry-run" : ""}`);

  const result = await prepareVideoparadaFromChart({
    chartKind: CHART_KIND,
    weekIndex,
    limit,
    force,
    format,
  });

  for (const s of result.songs) {
    if (s.error) {
      console.warn(`  #${s.position} ${s.title} — FALHA: ${s.error}`);
    } else {
      console.log(
        `  #${s.position} ${s.title} — ${s.youtubeId} · ${s.startSec?.toFixed(1)}s–${s.endSec?.toFixed(1)}s`,
      );
    }
  }

  const propsForRemotion = {
    ...result.props,
    format,
    entries: result.songs.map((s) => ({
      position: s.position,
      title: s.title,
      artist: s.artist,
      coverUrl: s.coverUrl,
      coverPalette: ["#FA243C", "#FF5858"] as [string, string],
      status: s.status,
      delta: s.delta,
      isDebut: s.isDebut,
      peak: s.peak,
      weeks: s.weeks,
      numberOnes: s.numberOnes,
      videoSrc: s.publicRelPath ? `/${s.publicRelPath}` : null,
    })),
  };

  const outDir = path.join(process.cwd(), "out");
  await mkdir(outDir, { recursive: true });
  const slug = `disk-mtv-${result.weekIndex}-${format}`;
  const propsPath = path.join(outDir, `videoparada-props-${slug}.json`);
  const renderOut = path.join(outDir, `videoparada-${slug}.mp4`);
  const markerPath = path.join(outDir, diskMtvUploadMarkerName(result.weekIndex, format));

  await writeFile(propsPath, JSON.stringify(propsForRemotion, null, 2), "utf8");
  console.log(`Props: ${propsPath}`);
  console.log(
    `Duração estimada: ${calcDurationFrames(propsForRemotion.entries.length, format)} frames`,
  );

  if (!force && (await fileExists(markerPath))) {
    const prev = JSON.parse(await readFile(markerPath, "utf8")) as { url?: string };
    console.log(`Já publicado esta semana (${markerPath})${prev.url ? `: ${prev.url}` : ""}`);
    console.log("Use --force para regenerar/reenviar.");
    return;
  }

  const okCount = result.songs.filter((s) => s.publicRelPath).length;
  if (okCount === 0) {
    throw new Error("Nenhum clipe preparado — abortando");
  }

  const compositionId = format === "landscape" ? "VideoparadaLandscape" : "VideoparadaVertical";
  console.log(`Renderizando ${compositionId} → ${renderOut}`);
  const remotionCli = path.join(
    process.cwd(),
    "node_modules",
    "@remotion",
    "cli",
    "remotion-cli.js",
  );
  await execFileAsync(
    process.execPath,
    [
      remotionCli,
      "render",
      "remotion/index.ts",
      compositionId,
      renderOut,
      `--props=${propsPath}`,
    ],
    { cwd: process.cwd(), windowsHide: true, maxBuffer: 50 * 1024 * 1024 },
  );
  console.log(`OK: ${renderOut}`);

  if (skipUpload) {
    console.log("Upload pulado (--dry-run / --skip-upload).");
    return;
  }

  const meta = defaultDiskMtvYouTubeMeta({
    weekLabel: result.props.weekLabel,
    weekIndex: result.weekIndex,
    limit,
    siteUrl: result.props.siteUrl,
  });

  console.log(`Enviando ao YouTube: ${meta.title}`);
  const publicClipPaths = result.songs
    .map((s) => (s.publicRelPath ? path.join(process.cwd(), "public", s.publicRelPath) : null))
    .filter((p): p is string => Boolean(p));

  const uploaded = await uploadVideoToChartFmYouTube({
    filePath: renderOut,
    title: meta.title,
    description: meta.description,
    tags: meta.tags,
    privacyStatus: privacy,
    // MP4 + props + clipes em public/ — regeneráveis; marcador .uploaded.json fica.
    extraLocalPathsToDelete: [propsPath, ...publicClipPaths],
  });

  await writeFile(
    markerPath,
    JSON.stringify(
      {
        weekIndex: result.weekIndex,
        format,
        videoId: uploaded.videoId,
        url: uploaded.url,
        title: uploaded.title,
        uploadedAt: new Date().toISOString(),
        // arquivo local já apagado após upload OK
        file: renderOut,
        localDeleted: true,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`YouTube: ${uploaded.url}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * Prepara Top N da parada oficial: download → refrão → smart-crop → Remotion.
 *
 * Uso:
 *   npx tsx scripts/videoparada-prepare-global.ts --limit=3 --render
 *   npx tsx scripts/videoparada-prepare-global.ts --format=landscape --limit=3 --render
 *   npx tsx scripts/videoparada-prepare-global.ts --chart=genre:brasil --limit=5
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prepareVideoparadaFromChart } from "../lib/videoparada/prepare-chart";
import { calcDurationFrames } from "../remotion/data/timing";
import { prisma } from "../lib/prisma";
import type { ParadeVideoFormat } from "../lib/videoparada/prepare-clip";

const execFileAsync = promisify(execFile);

function argValue(args: string[], name: string): string | null {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

async function main() {
  const args = process.argv.slice(2);
  const limit = Number(argValue(args, "limit") ?? "3");
  const chartKind = argValue(args, "chart") ?? "global";
  const weekRaw = argValue(args, "week");
  const weekIndex = weekRaw ? Number(weekRaw) : null;
  const formatRaw = argValue(args, "format") ?? "vertical";
  const format: ParadeVideoFormat = formatRaw === "landscape" ? "landscape" : "vertical";
  const doRender = args.includes("--render");
  const force = args.includes("--force");

  console.log(`Preparando ${chartKind} · ${format} · top ${limit}…`);
  const result = await prepareVideoparadaFromChart({
    chartKind,
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
        `  #${s.position} ${s.title} — ${s.youtubeId} · ${s.startSec?.toFixed(1)}s–${s.endSec?.toFixed(1)}s · ${s.windowStrategy ?? "?"}`,
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
  const propsPath = path.join(outDir, `videoparada-props-${format}.json`);
  await writeFile(propsPath, JSON.stringify(propsForRemotion, null, 2), "utf8");
  console.log(`Props: ${propsPath}`);
  console.log(
    `Duração estimada: ${calcDurationFrames(propsForRemotion.entries.length, format)} frames`,
  );

  if (!doRender) {
    console.log("Passe --render para gerar o MP4 com Remotion.");
    return;
  }

  const okCount = result.songs.filter((s) => s.publicRelPath).length;
  if (okCount === 0) {
    throw new Error("Nenhum clipe preparado — abortando render");
  }

  const compositionId = format === "landscape" ? "VideoparadaLandscape" : "VideoparadaVertical";
  const renderOut = path.join(outDir, `videoparada-global-${format}.mp4`);
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
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

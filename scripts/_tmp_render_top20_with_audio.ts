/**
 * Render landscape Top20 com áudio via ffmpeg (workaround Windows Remotion audio-mixing).
 * Uso: npx tsx scripts/_tmp_render_top20_with_audio.ts
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { calcDurationFrames, FPS, LANDSCAPE } from "../remotion/data/timing";

const execFileAsync = promisify(execFile);

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const propsPath = path.join(process.cwd(), "out", "videoparada-props-global-top20-landscape.json");
  const mutedOut = path.join(process.cwd(), "out", "videoparada-global-top20-landscape.muted.mp4");
  const audioOut = path.join(process.cwd(), "out", "videoparada-global-top20-landscape.audio.m4a");
  const finalOut = path.join(process.cwd(), "out", "videoparada-global-top20-landscape.mp4");
  const listPath = path.join(process.cwd(), "out", "videoparada-global-top20-audio-list.txt");

  const props = JSON.parse(await import("node:fs/promises").then((fs) => fs.readFile(propsPath, "utf8"))) as {
    entries: Array<{ position: number; videoSrc?: string | null }>;
  };

  const countdown = [...props.entries].sort((a, b) => b.position - a.position);
  const entryCount = countdown.length;
  const durationFrames = calcDurationFrames(entryCount, "landscape");
  const durationSec = durationFrames / FPS;
  const introSec = LANDSCAPE.introFrames / FPS;
  const outroSec = LANDSCAPE.outroFrames / FPS;
  const posSec = LANDSCAPE.positionFrames / FPS;
  const transSec = LANDSCAPE.transitionFrames / FPS;
  // Duração audível por posição (exceto a última): remove o overlap da transição
  const bodySec = posSec - transSec; // 10.1s

  console.log(
    `Video ${durationSec.toFixed(1)}s · intro ${introSec}s · pos ${posSec}s · body ${bodySec}s · outro ${outroSec}s`,
  );

  // 1) Render mudo
  console.log("=== Remotion render (muted) ===");
  const remotionCli = path.join(process.cwd(), "node_modules", "@remotion", "cli", "remotion-cli.js");
  await execFileAsync(
    process.execPath,
    [
      remotionCli,
      "render",
      "remotion/index.ts",
      "VideoparadaLandscape",
      mutedOut,
      `--props=${propsPath}`,
      "--muted",
      "--concurrency=3",
    ],
    { cwd: process.cwd(), windowsHide: true, maxBuffer: 50 * 1024 * 1024 },
  );
  console.log(`Muted OK: ${mutedOut}`);

  // 2) Monta lista de áudio: silence + clips + silence
  await mkdir(path.join(process.cwd(), "out"), { recursive: true });
  const lines: string[] = [];
  // anullsrc via ffmpeg -f lavfi; usamos um wav gerado
  const silenceIntro = path.join(process.cwd(), "out", "_silence_intro.wav");
  const silenceOutro = path.join(process.cwd(), "out", "_silence_outro.wav");
  await execFileAsync(
    "ffmpeg",
    ["-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", String(introSec), silenceIntro],
    { windowsHide: true },
  );
  await execFileAsync(
    "ffmpeg",
    ["-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", String(outroSec), silenceOutro],
    { windowsHide: true },
  );

  lines.push(`file '${silenceIntro.replace(/\\/g, "/")}'`);

  for (let i = 0; i < countdown.length; i++) {
    const e = countdown[i];
    const rel = String(e.videoSrc ?? "").replace(/^\//, "");
    const clipPath = path.join(process.cwd(), "public", rel);
    if (!(await exists(clipPath))) {
      throw new Error(`Clipe ausente: ${clipPath}`);
    }
    const isLast = i === countdown.length - 1;
    const take = isLast ? posSec : bodySec;
    const trimmed = path.join(process.cwd(), "out", `_a_${e.position}.wav`);
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        clipPath,
        "-t",
        String(take),
        "-vn",
        "-ac",
        "2",
        "-ar",
        "44100",
        trimmed,
      ],
      { windowsHide: true },
    );
    lines.push(`file '${trimmed.replace(/\\/g, "/")}'`);
  }
  lines.push(`file '${silenceOutro.replace(/\\/g, "/")}'`);
  await writeFile(listPath, lines.join("\n"), "utf8");

  console.log("=== Concat áudio ===");
  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-t",
      String(durationSec),
      audioOut,
    ],
    { windowsHide: true, maxBuffer: 20 * 1024 * 1024 },
  );

  console.log("=== Mux vídeo + áudio ===");
  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-i",
      mutedOut,
      "-i",
      audioOut,
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-shortest",
      "-movflags",
      "+faststart",
      finalOut,
    ],
    { windowsHide: true, maxBuffer: 20 * 1024 * 1024 },
  );

  console.log(`OK: ${finalOut}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

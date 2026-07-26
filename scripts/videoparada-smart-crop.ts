/**
 * CLI: smart-crop de um vídeo landscape → vertical 9:16.
 *
 * Uso:
 *   npx tsx scripts/videoparada-smart-crop.ts <input.mp4> [output.mp4]
 *   npx tsx scripts/videoparada-smart-crop.ts --demo
 */
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { smartCropVideoToVertical } from "../lib/videoparada/smart-crop";

const execFileAsync = promisify(execFile);

async function makeDemoLandscape(outPath: string) {
  await mkdir(path.dirname(outPath), { recursive: true });
  // Assunto (caixa vermelha) deslocado à DIREITA — crop central erraria o foco.
  // Sem drawtext: builds Windows do ffmpeg costumam falhar sem fontconfig.
  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=0x1a1a2e:s=1280x720:d=4",
    "-vf",
    [
      "drawbox=x=40:y=40:w=220:h=100:color=0x333355:t=fill",
      "drawbox=x=880:y=180:w=320:h=360:color=0xfa243c:t=fill",
      "drawbox=x=940:y=280:w=200:h=160:color=0xffffff:t=fill",
    ].join(","),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-t",
    "4",
    outPath,
  ]);
}

async function main() {
  const args = process.argv.slice(2);
  const demo = args.includes("--demo");

  let input: string;
  let output: string;

  if (demo) {
    input = path.resolve("out/videoparada-landscape-demo.mp4");
    output = path.resolve("out/videoparada-vertical-smart.mp4");
    console.log("Gerando landscape de teste (assunto à direita)…");
    await makeDemoLandscape(input);
  } else {
    input = path.resolve(args[0] ?? "");
    if (!input || input.startsWith("-")) {
      console.error(
        "Uso: npx tsx scripts/videoparada-smart-crop.ts <input.mp4> [output.mp4]\n" +
          "     npx tsx scripts/videoparada-smart-crop.ts --demo",
      );
      process.exit(1);
    }
    output = path.resolve(args[1] ?? path.join("out", `${path.parse(input).name}-vertical.mp4`));
  }

  console.log(`Analisando + crop → ${output}`);
  const analysis = await smartCropVideoToVertical(input, output, {
    sampleCount: 5,
    outWidth: 1080,
    outHeight: 1920,
  });

  console.log(
    JSON.stringify(
      {
        strategy: analysis.strategy,
        source: `${analysis.sourceWidth}x${analysis.sourceHeight}`,
        crop: analysis.crop,
        samples: analysis.samples.map((s) => ({
          t: Number(s.t.toFixed(2)),
          x: s.crop.x,
          score: Number(s.score.toFixed(6)),
        })),
        output,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

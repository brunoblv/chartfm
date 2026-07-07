/**
 * Dispara aviso do Global 100 da semana no Telegram (com top 5 no texto).
 *   npm run telegram:global
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

type SnapshotSong = { position: number; song: { title: string; artist: string } };

async function main() {
  const { prisma } = await import("../lib/prisma");
  const { getRankingWeekReference } = await import("../lib/chart-week");
  const { notifyTelegramEvent } = await import("../lib/telegram");

  const week = getRankingWeekReference();
  let snap = await prisma.globalSnapshot.findUnique({ where: { weekIndex: week.weekIndex } });
  if (!snap) {
    snap = await prisma.globalSnapshot.findFirst({ orderBy: { weekIndex: "desc" } });
  }
  if (!snap) {
    console.error("Nenhum snapshot do Global 100 encontrado no banco.");
    process.exit(1);
  }

  const songs = (snap.weeklySongs as SnapshotSong[]).slice(0, 5);
  const topLines = songs.map((e) => `${e.position}. ${e.song.title} — ${e.song.artist}`).join("\n");
  const text = `A Parada Global (${snap.weekLabel}) foi publicada! Confira os resultados.\n\nTop 5:\n${topLines}`;

  console.log(`Semana: ${snap.weekLabel} (${snap.weekIndex})`);
  console.log("Enviando para o Telegram...");
  await notifyTelegramEvent({ kind: "global_chart", text, targetUrl: "/global/100" });
  console.log("Pronto. Confira o canal no Telegram.");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

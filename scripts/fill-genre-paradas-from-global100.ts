/**
 * Preenche os slots vazios de todas as 22 paradas "de estilo" (Parada.autoDecay)
 * com músicas na ordem em que aparecem no Global 100 (snapshot congelado mais
 * recente), pulando faixas que já estão na própria parada.
 *
 * Usage: npx tsx scripts/fill-genre-paradas-from-global100.ts [--prod] [--only=julianast,keku]
 */

import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { pointsForChartPosition, scoringTierFromPrimary } from "../lib/parada-points";
import { paletteFor } from "../lib/mytrl-weekly-chart";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
}

const DRY_RUN = !process.argv.includes("--prod");
const ONLY_ARG = process.argv.find((a) => a.startsWith("--only="));
const ONLY = ONLY_ARG ? new Set(ONLY_ARG.split("=").slice(1).join("=").split(",").map((s) => s.trim().toLowerCase())) : null;

process.env.DATABASE_URL = process.env.PRODUCTION_DATABASE_URL ?? process.env.DATABASE_URL;

const prisma = new PrismaClient();

type GlobalSong = { position: number; song: { id?: string | null; title: string; artist: string } };

function keyOf(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}|||${(artist.split(",")[0] ?? artist).trim().toLowerCase()}`;
}

async function fillParada(paradaId: string, paradaName: string, handle: string, weeklySongs: GlobalSong[]) {
  const parada = await prisma.parada.findUnique({ where: { id: paradaId }, select: { chartSize: true } });
  const chart = await prisma.chart.findFirst({
    where: { paradaId },
    orderBy: { weekIndex: "desc" },
    include: { entries: { include: { song: true }, orderBy: { position: "asc" } } },
  });
  if (!chart) {
    console.log(`  [skip] @${handle} "${paradaName}" — sem chart.`);
    return;
  }

  const maxItems = parada?.chartSize ?? chart.maxItems;
  const filledPositions = new Set(chart.entries.map((e) => e.position));
  const missingPositions = Array.from({ length: maxItems }, (_, i) => i + 1).filter((p) => !filledPositions.has(p));

  if (!missingPositions.length) {
    console.log(`  [ok] @${handle} "${paradaName}" — já completa (${chart.entries.length}/${maxItems}).`);
    return;
  }

  const existingKeys = new Set(chart.entries.map((e) => keyOf(e.song.title, e.song.artist)));
  const existingSongIds = new Set(chart.entries.map((e) => e.songId));

  const candidates: Array<{ songId: string; title: string; artist: string }> = [];
  for (const g of weeklySongs) {
    if (!g.song.id) continue;
    if (existingSongIds.has(g.song.id)) continue;
    const key = keyOf(g.song.title, g.song.artist);
    if (existingKeys.has(key)) continue;
    candidates.push({ songId: g.song.id, title: g.song.title, artist: g.song.artist });
    existingKeys.add(key);
    existingSongIds.add(g.song.id);
    if (candidates.length >= missingPositions.length) break;
  }

  const scoringTier = scoringTierFromPrimary(false);
  const entryPayload = missingPositions.slice(0, candidates.length).map((position, i) => {
    const c = candidates[i];
    const { palette, seed } = paletteFor(c.artist, c.title);
    return {
      chartId: chart.id,
      position,
      songId: c.songId,
      points: pointsForChartPosition(position, scoringTier, maxItems, "WEEKLY"),
      status: "new",
      delta: null,
      prevPos: null,
      peak: position,
      weeks: 1,
      coverPaletteA: palette[0],
      coverPaletteB: palette[1],
      coverSeed: seed,
    };
  });

  console.log(
    `  @${handle} "${paradaName}": ${chart.entries.length}/${maxItems} -> +${entryPayload.length} (faltavam ${missingPositions.length})`,
  );

  if (DRY_RUN || !entryPayload.length) return;
  await prisma.chartEntry.createMany({ data: entryPayload });
}

async function main() {
  const snapshot = await prisma.globalSnapshot.findFirst({ orderBy: { weekIndex: "desc" } });
  if (!snapshot) throw new Error("nenhum GlobalSnapshot encontrado.");
  console.log(`Usando Global 100 da semana ${snapshot.weekIndex} (${snapshot.weekLabel}).`);
  const weeklySongs = (snapshot.weeklySongs as GlobalSong[]).sort((a, b) => a.position - b.position);

  const paradas = await prisma.parada.findMany({
    where: { autoDecay: true, deletedAt: null },
    select: { id: true, name: true, user: { select: { handle: true } } },
  });

  const filtered = ONLY ? paradas.filter((p) => ONLY.has(p.user.handle.toLowerCase())) : paradas;
  console.log(DRY_RUN ? "=== DRY-RUN (nada será gravado) ===" : "=== PRODUÇÃO ===");

  for (const p of filtered) {
    await fillParada(p.id, p.name, p.user.handle, weeklySongs);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

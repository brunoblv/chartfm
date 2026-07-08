/**
 * Preenche os slots vazios da parada "The Hits" (@julianast) com músicas na
 * ordem em que aparecem no Global 100 (snapshot congelado mais recente),
 * pulando faixas que já estão na parada.
 *
 * Usage: npx tsx scripts/fill-the-hits-from-global100.ts [--prod]
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
process.env.DATABASE_URL = process.env.PRODUCTION_DATABASE_URL ?? process.env.DATABASE_URL;

const prisma = new PrismaClient();

type GlobalSong = { position: number; song: { id?: string | null; title: string; artist: string } };

async function main() {
  const user = await prisma.user.findUnique({ where: { handle: "julianast" }, select: { id: true } });
  if (!user) throw new Error("usuário @julianast não encontrado.");

  const parada = await prisma.parada.findFirst({
    where: { userId: user.id, name: { equals: "The Hits", mode: "insensitive" } },
    select: { id: true, chartSize: true },
  });
  if (!parada) throw new Error('parada "The Hits" não encontrada.');

  const chart = await prisma.chart.findFirst({
    where: { paradaId: parada.id },
    orderBy: { weekIndex: "desc" },
    include: { entries: { include: { song: true }, orderBy: { position: "asc" } } },
  });
  if (!chart) throw new Error("chart de The Hits não encontrado.");

  const maxItems = parada.chartSize ?? chart.maxItems;
  const filledPositions = new Set(chart.entries.map((e) => e.position));
  const missingPositions = Array.from({ length: maxItems }, (_, i) => i + 1).filter((p) => !filledPositions.has(p));

  console.log(`Parada "The Hits": ${chart.entries.length}/${maxItems} preenchidas. Faltam: ${missingPositions.join(", ") || "(nenhuma)"}`);
  if (!missingPositions.length) {
    console.log("Nada a fazer.");
    return;
  }

  const snapshot = await prisma.globalSnapshot.findFirst({ orderBy: { weekIndex: "desc" } });
  if (!snapshot) throw new Error("nenhum GlobalSnapshot encontrado.");
  console.log(`Usando Global 100 da semana ${snapshot.weekIndex} (${snapshot.weekLabel}).`);

  const weeklySongs = (snapshot.weeklySongs as GlobalSong[]).sort((a, b) => a.position - b.position);

  const existingKeys = new Set(
    chart.entries.map((e) => `${e.song.title.trim().toLowerCase()}|||${(e.song.artist.split(",")[0] ?? e.song.artist).trim().toLowerCase()}`),
  );
  const existingSongIds = new Set(chart.entries.map((e) => e.songId));

  const candidates: Array<{ songId: string; title: string; artist: string }> = [];
  for (const g of weeklySongs) {
    if (!g.song.id) continue;
    if (existingSongIds.has(g.song.id)) continue;
    const key = `${g.song.title.trim().toLowerCase()}|||${(g.song.artist.split(",")[0] ?? g.song.artist).trim().toLowerCase()}`;
    if (existingKeys.has(key)) continue;
    candidates.push({ songId: g.song.id, title: g.song.title, artist: g.song.artist });
    existingKeys.add(key);
    existingSongIds.add(g.song.id);
    if (candidates.length >= missingPositions.length) break;
  }

  console.log(`Encontradas ${candidates.length} faixas do Global 100 para preencher ${missingPositions.length} vaga(s).`);

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

  for (const e of entryPayload) {
    const c = candidates[missingPositions.indexOf(e.position)];
    console.log(`  #${e.position} ${c.artist} - ${c.title}`);
  }

  if (DRY_RUN) {
    console.log("\n(dry-run, nada gravado — use --prod para gravar)");
    return;
  }

  await prisma.chartEntry.createMany({ data: entryPayload });
  console.log(`\n[ok] ${entryPayload.length} entrada(s) criada(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

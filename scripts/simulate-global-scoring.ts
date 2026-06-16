/**
 * Simulação (NÃO grava nada): compara o Global 100 atual (linear, #1=100)
 * com uma curva geométrica (#1 = TOP_POINTS, razão DECAY_RATIO).
 *
 * Uso:
 *   npx tsx scripts/simulate-global-scoring.ts            # semana mais recente
 *   npx tsx scripts/simulate-global-scoring.ts --week=202615
 *   npx tsx scripts/simulate-global-scoring.ts --all      # todas as semanas
 *   npx tsx scripts/simulate-global-scoring.ts --top=20
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { GLOBAL_RANKING_FIRST_WEEK_INDEX } from "../lib/global-ranking-config";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

// ---- Parâmetros da curva nova ----
const TOP_POINTS = 1000; // pontos do #1 em cada parada
const DECAY_RATIO = 0.95; // razão geométrica: cada posição abaixo vale 95% da anterior

function geometricWeight(position: number): number {
  return TOP_POINTS * Math.pow(DECAY_RATIO, position - 1);
}

// Linear atual: #1 = 100 ... #100 = 1
function linearWeight(position: number, storedPoints: number): number {
  return storedPoints > 0 ? storedPoints : 101 - position;
}

// Mesma chave de agregação usada em weekly-chart-aggregate.ts
function songKey(song: { spotifyId: string | null; title: string; artist: string }): string {
  if (song.spotifyId) return `song_spotify:${song.spotifyId}`;
  const t = song.title.trim().replace(/\s+/g, " ").toLowerCase();
  const a = song.artist.trim().replace(/\s+/g, " ").toLowerCase();
  return `song_local:${t}|${a}`;
}

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const allWeeks = args.includes("--all");
const weekArg = args.find((a) => a.startsWith("--week="));
const topArg = args.find((a) => a.startsWith("--top="));
const TOP_N = topArg ? Number(topArg.split("=")[1]) : 15;

type Agg = {
  key: string;
  label: string;
  linear: number;
  geom: number;
  charts: Set<string>;
};

async function rankWeek(weekIndex: number) {
  const entries = await prisma.chartEntry.findMany({
    where: {
      chart: { weekIndex, parada: { isPrimary: true } },
      position: { lte: 100 },
    },
    select: {
      position: true,
      points: true,
      chartId: true,
      song: { select: { title: true, artist: true, spotifyId: true, artistRef: { select: { name: true } } } },
    },
  });

  const map = new Map<string, Agg>();
  for (const e of entries) {
    const key = songKey(e.song);
    const label = `${e.song.title} — ${e.song.artistRef?.name ?? e.song.artist}`;
    const cur = map.get(key) ?? { key, label, linear: 0, geom: 0, charts: new Set<string>() };
    cur.linear += linearWeight(e.position, e.points);
    cur.geom += geometricWeight(e.position);
    cur.charts.add(e.chartId);
    map.set(key, cur);
  }

  const rows = [...map.values()];
  const byLinear = [...rows].sort((a, b) => b.linear - a.linear);
  const byGeom = [...rows].sort((a, b) => b.geom - a.geom);

  const linearPos = new Map(byLinear.map((r, i) => [r.key, i + 1]));

  return { entries: entries.length, songs: rows.length, byLinear, byGeom, linearPos };
}

function fmtDelta(d: number | undefined): string {
  if (d === undefined) return "novo".padStart(6);
  if (d === 0) return "  =  ";
  return (d > 0 ? `+${d}` : `${d}`).padStart(5);
}

async function printWeek(weekIndex: number) {
  const meta = await prisma.chart.findFirst({
    where: { weekIndex, parada: { isPrimary: true } },
    select: { weekLabel: true },
    orderBy: { publishedAt: "desc" },
  });
  const { entries, songs, byGeom, linearPos } = await rankWeek(weekIndex);

  console.log("\n" + "=".repeat(78));
  console.log(`Semana ${weekIndex}  ${meta?.weekLabel ?? ""}   (${entries} entradas, ${songs} músicas)`);
  console.log(`Curva nova: #1=${TOP_POINTS} pts, geométrica r=${DECAY_RATIO}`);
  console.log("=".repeat(78));
  console.log("NOVO  Δvs.atual  músic­a".padEnd(60) + "pts(novo)   paradas");
  console.log("-".repeat(78));

  for (let i = 0; i < Math.min(TOP_N, byGeom.length); i++) {
    const r = byGeom[i];
    const oldPos = linearPos.get(r.key);
    const delta = oldPos ? oldPos - (i + 1) : undefined; // + sobe, - desce
    const newPos = String(i + 1).padStart(3);
    const label = r.label.length > 42 ? r.label.slice(0, 41) + "…" : r.label;
    console.log(
      `#${newPos}  ${fmtDelta(delta)}    ${label.padEnd(44)} ${Math.round(r.geom).toString().padStart(6)}   ${String(r.charts.size).padStart(3)}`,
    );
  }
}

async function latestWeek(): Promise<number | null> {
  const row = await prisma.chart.findFirst({
    where: { weekIndex: { gte: GLOBAL_RANKING_FIRST_WEEK_INDEX }, parada: { isPrimary: true } },
    select: { weekIndex: true },
    orderBy: { weekIndex: "desc" },
  });
  return row?.weekIndex ?? null;
}

async function main() {
  if (allWeeks) {
    const rows = await prisma.chart.findMany({
      where: { weekIndex: { gte: GLOBAL_RANKING_FIRST_WEEK_INDEX }, parada: { isPrimary: true } },
      select: { weekIndex: true },
      distinct: ["weekIndex"],
      orderBy: { weekIndex: "asc" },
    });
    for (const r of rows) await printWeek(r.weekIndex);
    return;
  }

  const week = weekArg ? Number(weekArg.split("=")[1]) : await latestWeek();
  if (!week) {
    console.log("Nenhuma semana do Global 100 encontrada.");
    return;
  }
  await printWeek(week);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

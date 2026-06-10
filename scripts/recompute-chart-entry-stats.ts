/**
 * Recomputa e persiste status, delta, prevPos, peak e weeks de todas as entradas
 * de parada, corrigindo viradas de ano com 53 semanas ISO (ex.: 202053 → 202101).
 *
 * Uso:
 *   npx tsx scripts/recompute-chart-entry-stats.ts
 *   npx tsx scripts/recompute-chart-entry-stats.ts --handle=romulolima22
 *   npx tsx scripts/recompute-chart-entry-stats.ts --dry-run
 *   npx tsx scripts/recompute-chart-entry-stats.ts --from-week=202101
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

import { prisma } from "../lib/prisma";
import { applyComputedEntryStatsToCharts } from "../lib/chart-entry-stats";

const BATCH_SIZE = 200;

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  const handleArg = process.argv.find((a) => a.startsWith("--handle="));
  const paradaArg = process.argv.find((a) => a.startsWith("--parada-id="));
  const fromWeekArg = process.argv.find((a) => a.startsWith("--from-week="));
  return {
    dryRun,
    handle: handleArg?.split("=")[1]?.trim() || null,
    paradaId: paradaArg?.split("=")[1]?.trim() || null,
    fromWeek: fromWeekArg ? Number(fromWeekArg.split("=")[1]) : undefined,
  };
}

type EntryRow = {
  id: string;
  status: string;
  delta: number | null;
  prevPos: number | null;
  peak: number;
  weeks: number;
};

function entryChanged(current: EntryRow, next: EntryRow) {
  return (
    current.status !== next.status ||
    current.delta !== next.delta ||
    current.prevPos !== next.prevPos ||
    current.peak !== next.peak ||
    current.weeks !== next.weeks
  );
}

async function recomputeParada(
  paradaId: string,
  paradaName: string,
  userHandle: string,
  fromWeekIndex: number | undefined,
  dryRun: boolean,
) {
  const charts = await prisma.chart.findMany({
    where: { paradaId },
    orderBy: { weekIndex: "asc" },
    select: {
      id: true,
      weekIndex: true,
      entries: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          songId: true,
          position: true,
          status: true,
          delta: true,
          prevPos: true,
          peak: true,
          weeks: true,
        },
      },
    },
  });

  if (charts.length === 0) return { charts: 0, entries: 0, changed: 0 };

  const computed = applyComputedEntryStatsToCharts(charts);
  const updates: Array<{ id: string; data: EntryRow }> = [];

  for (const chart of computed) {
    if (fromWeekIndex !== undefined && chart.weekIndex < fromWeekIndex) continue;
    const original = charts.find((c) => c.id === chart.id);
    if (!original) continue;

    for (const entry of chart.entries) {
      const current = original.entries.find((e) => e.id === entry.id);
      if (!current) continue;
      const next: EntryRow = {
        id: entry.id,
        status: entry.status,
        delta: entry.delta,
        prevPos: entry.prevPos,
        peak: entry.peak,
        weeks: entry.weeks,
      };
      if (entryChanged(current, next)) {
        updates.push({ id: entry.id, data: next });
      }
    }
  }

  console.log(
    `  @${userHandle} · ${paradaName}: ${charts.length} parada(s), ${updates.length} entrada(s) a atualizar`,
  );

  if (dryRun || updates.length === 0) return { charts: charts.length, entries: updates.length, changed: 0 };

  let changed = 0;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map(({ id, data }) =>
        prisma.chartEntry.update({
          where: { id },
          data: {
            status: data.status,
            delta: data.delta,
            prevPos: data.prevPos,
            peak: data.peak,
            weeks: data.weeks,
          },
        }),
      ),
    );
    changed += batch.length;
  }

  return { charts: charts.length, entries: updates.length, changed };
}

async function main() {
  const { dryRun, handle, paradaId, fromWeek } = parseArgs();

  console.log(dryRun ? "Modo dry-run — nenhuma alteração será gravada.\n" : "Recomputando stats persistidos…\n");
  if (fromWeek !== undefined) console.log(`Filtrando a partir da semana ${fromWeek}.\n`);

  const paradas = await prisma.parada.findMany({
    where: {
      ...(paradaId ? { id: paradaId } : {}),
      ...(handle ? { user: { handle } } : {}),
    },
    select: {
      id: true,
      name: true,
      user: { select: { handle: true } },
    },
    orderBy: [{ user: { handle: "asc" } }, { sortOrder: "asc" }],
  });

  if (paradas.length === 0) {
    console.log("Nenhuma parada encontrada com os filtros informados.");
    return;
  }

  let totalCharts = 0;
  let totalPending = 0;
  let totalChanged = 0;

  for (const parada of paradas) {
    const result = await recomputeParada(
      parada.id,
      parada.name,
      parada.user.handle,
      fromWeek,
      dryRun,
    );
    totalCharts += result.charts;
    totalPending += result.entries;
    totalChanged += result.changed;
  }

  console.log("\n--- Resumo ---");
  console.log(`Paradas processadas: ${paradas.length}`);
  console.log(`Charts analisados:   ${totalCharts}`);
  console.log(`Entradas alteradas:  ${dryRun ? `${totalPending} (simulado)` : totalChanged}`);
  console.log(dryRun ? "\nExecute sem --dry-run para aplicar." : "\nConcluído.");
}

main().catch(console.error).finally(() => prisma.$disconnect());

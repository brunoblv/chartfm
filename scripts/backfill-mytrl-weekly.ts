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
import { MYTRL_WEEKLY_PARADA_ID } from "../lib/mytrl-access";
import { toBrtDate } from "../lib/mytrl-chart-engine";
import { publishMyTrlWeeklyChart, parseMyTrlWeeklyReferenceDate } from "../lib/mytrl-weekly-chart";

function fridayDateKeyFromSnapshot(computedAt: Date): string {
  const brt = toBrtDate(computedAt);
  const y = brt.getUTCFullYear();
  const m = String(brt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(brt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function main() {
  const existing = await prisma.chart.findMany({
    where: { paradaId: MYTRL_WEEKLY_PARADA_ID },
    select: { weekIndex: true, weekLabel: true },
    orderBy: { weekIndex: "asc" },
  });
  const existingWeeks = new Set(existing.map((c) => c.weekIndex));
  console.log("Charts existentes:", existing.map((c) => `${c.weekIndex} (${c.weekLabel})`).join(", ") || "nenhum");

  const fridaySnapshots = await prisma.myTrlSnapshot.findMany({
    where: { weekday: 5 },
    select: { weekIndex: true, weekLabel: true, computedAt: true },
    orderBy: { weekIndex: "asc" },
  });

  const weekCounts = await prisma.myTrlSnapshot.groupBy({
    by: ["weekIndex"],
    _count: { _all: true },
    orderBy: { weekIndex: "asc" },
  });

  console.log("\nSnapshots por semana:");
  for (const w of weekCounts) {
    console.log(`  ${w.weekIndex}: ${w._count._all} edição(ões)`);
  }

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const snap of fridaySnapshots) {
    if (existingWeeks.has(snap.weekIndex)) {
      console.log(`\nSKIP semana ${snap.weekIndex} (${snap.weekLabel}) — chart já existe`);
      skip++;
      continue;
    }

    const dateKey = fridayDateKeyFromSnapshot(snap.computedAt);
    const referenceDay = parseMyTrlWeeklyReferenceDate(dateKey);
    if (!referenceDay) {
      console.log(`\nFAIL semana ${snap.weekIndex} — ${dateKey} inválida para publicação semanal`);
      fail++;
      continue;
    }

    process.stdout.write(`\nPublicando semana ${snap.weekIndex} (${snap.weekLabel}) ref ${dateKey} ... `);
    try {
      const result = await publishMyTrlWeeklyChart(referenceDay);
      if (result.ok) {
        console.log(`OK — ${result.count} faixas, chart ${result.chartId}${result.created ? "" : " (atualizada)"}`);
        ok++;
      } else {
        console.log(`FAIL — ${result.error}`);
        fail++;
      }
    } catch (err) {
      console.log(`ERROR — ${String(err)}`);
      fail++;
    }
  }

  const final = await prisma.chart.findMany({
    where: { paradaId: MYTRL_WEEKLY_PARADA_ID },
    select: { weekIndex: true, weekLabel: true, _count: { select: { entries: true } } },
    orderBy: { weekIndex: "asc" },
  });

  console.log(`\n\nConcluído: ${ok} publicadas, ${skip} já existiam, ${fail} falhas`);
  console.log("\nParadas Under My Skin Video Countdown:");
  for (const c of final) {
    console.log(`  ${c.weekLabel} (${c.weekIndex}) — ${c._count.entries} faixas`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

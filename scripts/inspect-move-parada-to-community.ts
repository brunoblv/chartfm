/**
 * Inspeção (somente leitura): parada cmr5uzuag0001wdob0glc8g3o e comunidade cmr2tt8qg000q1s1gzws572c6.
 *
 * Usage: npx tsx scripts/inspect-move-parada-to-community.ts
 */

import { PrismaClient } from "@prisma/client";
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

const prisma = new PrismaClient();

const PARADA_ID = "cmr5uzuag0001wdob0glc8g3o";
const COMMUNITY_ID = "cmr2tt8qg000q1s1gzws572c6";

async function main() {
  const parada = await prisma.parada.findUnique({
    where: { id: PARADA_ID },
    select: {
      id: true,
      name: true,
      userId: true,
      isPrimary: true,
      sortOrder: true,
      chartSize: true,
      cadence: true,
      deletedAt: true,
      user: { select: { id: true, handle: true, name: true } },
      _count: { select: { charts: true } },
    },
  });
  console.log("=== PARADA ===");
  console.log(JSON.stringify(parada, null, 2));

  const community = await prisma.community.findUnique({
    where: { id: COMMUNITY_ID },
    select: {
      id: true,
      slug: true,
      name: true,
      paradaName: true,
      ownerId: true,
      maxSongs: true,
      owner: { select: { id: true, handle: true, name: true } },
    },
  });
  console.log("\n=== COMUNIDADE ===");
  console.log(JSON.stringify(community, null, 2));

  if (parada) {
    const charts = await prisma.chart.findMany({
      where: { paradaId: PARADA_ID },
      select: {
        id: true,
        weekIndex: true,
        weekLabel: true,
        communityId: true,
        isPublished: true,
        userId: true,
        _count: { select: { entries: true } },
      },
      orderBy: { weekIndex: "asc" },
    });
    console.log(`\n=== CHARTS DA PARADA (${charts.length}) ===`);
    for (const c of charts) {
      console.log(
        `${c.weekLabel} (weekIndex ${c.weekIndex}) — entries: ${c._count.entries}, communityId: ${c.communityId ?? "null"}, published: ${c.isPublished}`,
      );
    }
  }

  // Charts já atribuídos à comunidade (de qualquer parada)
  const existingCommunityCharts = await prisma.chart.findMany({
    where: { communityId: COMMUNITY_ID },
    select: { id: true, paradaId: true, weekIndex: true, weekLabel: true },
    orderBy: { weekIndex: "asc" },
  });
  console.log(`\n=== CHARTS JÁ COM communityId DA COMUNIDADE (${existingCommunityCharts.length}) ===`);
  for (const c of existingCommunityCharts) {
    console.log(`${c.weekLabel} (weekIndex ${c.weekIndex}) — paradaId: ${c.paradaId}`);
  }
}

main()
  .catch((err) => {
    console.error("[erro]", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

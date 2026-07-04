/**
 * Move os charts UCC da parada pessoal "Top Hits" para a parada oficial da comunidade.
 *
 * Usage: npx tsx scripts/migrate-ucc-to-community-parada.ts
 */

import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { recomputePersistedChartEntryStatsForParada } from "../lib/chart-entry-stats";

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

const COMMUNITY_SLUG = "hit-parade-paradas-pessoais-ucc";

async function main() {
  const community = await prisma.community.findUnique({
    where: { slug: COMMUNITY_SLUG },
    select: { id: true, paradaName: true, ownerId: true },
  });
  if (!community?.ownerId) throw new Error(`Comunidade ${COMMUNITY_SLUG} não encontrada.`);

  const owner = await prisma.user.findUnique({
    where: { id: community.ownerId },
    select: { id: true, handle: true },
  });
  if (!owner) throw new Error("Owner não encontrado.");

  let uccParada = await prisma.parada.findFirst({
    where: {
      userId: owner.id,
      name: { equals: community.paradaName, mode: "insensitive" },
    },
  });

  if (!uccParada) {
    const sortOrder = await prisma.parada.count({ where: { userId: owner.id } });
    uccParada = await prisma.parada.create({
      data: {
        userId: owner.id,
        name: community.paradaName,
        isPrimary: false,
        isCommunityOfficial: true,
        sortOrder,
        chartSize: 20,
        cadence: "WEEKLY",
        genres: ["Pop"],
      },
    });
    console.log(`[ok] Parada criada: "${uccParada.name}" (${uccParada.id})`);
  } else {
    console.log(`[info] Parada existente: "${uccParada.name}" (${uccParada.id})`);
  }

  const moved = await prisma.chart.updateMany({
    where: { communityId: community.id },
    data: { paradaId: uccParada.id },
  });
  console.log(`[ok] ${moved.count} charts movidos para a parada da comunidade.`);

  const topHits = await prisma.parada.findFirst({
    where: { userId: owner.id, name: "Top Hits" },
    select: { id: true },
  });

  if (topHits) {
    const statsUcc = await recomputePersistedChartEntryStatsForParada(prisma, uccParada.id);
    const statsTop = await recomputePersistedChartEntryStatsForParada(prisma, topHits.id);
    console.log(
      `[info] Stats UCC: ${statsUcc.charts} charts | Top Hits: ${statsTop.charts} charts`,
    );
  }
}

main()
  .catch((err) => {
    console.error("[erro]", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

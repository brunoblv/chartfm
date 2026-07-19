/**
 * Backfill da parada oficial da comunidade a partir das paradas primárias dos membros.
 *
 * Motivo: comunidades com histórico oficial (ex.: UCC importada da planilha) entram no
 * modo "parada oficial" e deixam de agregar membros ao vivo. Semanas novas precisam ser
 * persistidas — este script (e o cron publish-weekly-globals) fazem isso.
 *
 * Usage:
 *   npx tsx scripts/backfill-community-parada-from-members.ts --dry-run
 *   npx tsx scripts/backfill-community-parada-from-members.ts
 *   npx tsx scripts/backfill-community-parada-from-members.ts --slug=hit-parade-paradas-pessoais-ucc --from=2026-01-01 --until=2026-07-19
 *   npx tsx scripts/backfill-community-parada-from-members.ts --from=202601 --until=202629 --force
 *   npx tsx scripts/backfill-community-parada-from-members.ts --week=202627
 */

import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  buildWeekIndexFromDate,
  getRankingWeekReference,
} from "../lib/chart-week";
import { getGlobalPublishSlot } from "../lib/global-publish-schedule";
import { recomputePersistedChartEntryStatsForParada } from "../lib/chart-entry-stats";
import {
  listCommunitiesWithOfficialCharts,
  listWeekIndexesInclusive,
  publishCommunityOfficialWeekFromMembers,
} from "../lib/community-official-from-members";

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

const DEFAULT_SLUG = "hit-parade-paradas-pessoais-ucc";
const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const VERBOSE = process.argv.includes("--verbose");

function argValue(prefix: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function parseWeekOrDate(raw: string): number {
  if (/^\d{6}$/.test(raw)) return Number(raw);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`Data/semana inválida: ${raw} (use YYYY-MM-DD ou weekIndex YYYYWW)`);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return buildWeekIndexFromDate(d);
}

async function resolveFromUntil(): Promise<{ from: number; until: number }> {
  const weekOnly = argValue("--week=");
  if (weekOnly) {
    const w = parseWeekOrDate(weekOnly);
    return { from: w, until: w };
  }

  const fromRaw = argValue("--from=");
  const untilRaw = argValue("--until=");

  const slot = await getGlobalPublishSlot();
  const ranking = getRankingWeekReference(new Date(), slot);

  const from = fromRaw ? parseWeekOrDate(fromRaw) : 202601;
  const until = untilRaw ? parseWeekOrDate(untilRaw) : ranking.weekIndex;

  if (from > until) {
    throw new Error(`--from (${from}) > --until (${until})`);
  }
  return { from, until };
}

async function main() {
  const slug = argValue("--slug=") ?? DEFAULT_SLUG;
  const { from, until } = await resolveFromUntil();
  const weeks = listWeekIndexesInclusive(from, until);

  const community = await prisma.community.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, paradaName: true, ownerId: true },
  });
  if (!community) {
    const official = await listCommunitiesWithOfficialCharts();
    console.error(`[erro] Comunidade "${slug}" não encontrada.`);
    if (official.length) {
      console.error("Comunidades com parada oficial:", official.map((c) => c.slug).join(", "));
    }
    process.exitCode = 1;
    return;
  }

  console.log(`[info] Comunidade: ${community.name} (${community.slug})`);
  console.log(`[info] Semanas: ${from} → ${until} (${weeks.length} semanas)`);
  console.log(`[info] dry-run=${DRY_RUN} force=${FORCE}`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let empty = 0;

  for (const weekIndex of weeks) {
    const result = await publishCommunityOfficialWeekFromMembers(community.id, weekIndex, {
      force: FORCE,
      dryRun: DRY_RUN,
      recomputeStats: false,
    });

    if (result.status === "created") created += 1;
    else if (result.status === "updated") updated += 1;
    else if (result.status === "skipped") skipped += 1;
    else empty += 1;

    if (VERBOSE || result.status !== "skipped") {
      console.log(
        `[${result.status}] week ${weekIndex}: ${result.entryCount} entradas` +
          (result.contributorCount ? ` (${result.contributorCount} paradas)` : ""),
      );
    }
  }

  if (!DRY_RUN && (created > 0 || updated > 0) && community.ownerId) {
    const parada = await prisma.parada.findFirst({
      where: {
        userId: community.ownerId,
        name: { equals: community.paradaName, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (parada) {
      console.log(`[info] Recalculando stats a partir de ${from}...`);
      const stats = await recomputePersistedChartEntryStatsForParada(prisma, parada.id, from);
      console.log(`[info] Stats: ${stats.charts} charts, ${stats.entries} entradas`);
    }
  }

  console.log("");
  console.log("=== RESUMO ===");
  console.log(`Criados: ${created}`);
  console.log(`Atualizados: ${updated}`);
  console.log(`Pulados (já existiam): ${skipped}`);
  console.log(`Vazios (sem paradas de membros): ${empty}`);
  if (DRY_RUN) console.log("(dry-run — nada foi gravado)");
}

main()
  .catch((err) => {
    console.error("[erro]", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

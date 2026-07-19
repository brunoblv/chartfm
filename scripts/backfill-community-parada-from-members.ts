/**
 * Backfill da parada oficial (snapshot) da comunidade a partir das paradas primárias dos membros.
 *
 * Create-only por padrão (não sobrescreve semana já congelada) — igual Global 100.
 * Use --force só para regenerar de propósito.
 *
 * Usage:
 *   npx tsx scripts/backfill-community-parada-from-members.ts --dry-run
 *   npx tsx scripts/backfill-community-parada-from-members.ts --slug=hit-parade-paradas-pessoais-ucc --from=202601 --until=202629
 *   npx tsx scripts/backfill-community-parada-from-members.ts --all --from=202601 --until=202629
 *   npx tsx scripts/backfill-community-parada-from-members.ts --all --live-only --from=202601
 *   npx tsx scripts/backfill-community-parada-from-members.ts --week=202627 --force
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
  listAllCommunitiesForOfficialPublish,
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
const ALL = process.argv.includes("--all");
/** Com --all: só comunidades que ainda não têm nenhum Chart oficial. */
const LIVE_ONLY = process.argv.includes("--live-only");

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

type CommunityTarget = {
  id: string;
  slug: string;
  name: string;
  paradaName: string;
  ownerId: string | null;
};

async function resolveCommunities(): Promise<CommunityTarget[]> {
  if (ALL) {
    const all = await prisma.community.findMany({
      select: { id: true, slug: true, name: true, paradaName: true, ownerId: true },
      orderBy: { slug: "asc" },
    });
    if (!LIVE_ONLY) return all;

    const withOfficial = await prisma.chart.findMany({
      where: { communityId: { not: null }, isPublished: true },
      select: { communityId: true },
      distinct: ["communityId"],
    });
    const officialIds = new Set(
      withOfficial.map((r) => r.communityId).filter((id): id is string => Boolean(id)),
    );
    return all.filter((c) => !officialIds.has(c.id));
  }

  const slug = argValue("--slug=") ?? DEFAULT_SLUG;
  const community = await prisma.community.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, paradaName: true, ownerId: true },
  });
  if (!community) {
    const known = await listAllCommunitiesForOfficialPublish();
    console.error(`[erro] Comunidade "${slug}" não encontrada.`);
    if (known.length) {
      console.error("Comunidades:", known.map((c) => c.slug).join(", "));
    }
    process.exitCode = 1;
    return [];
  }
  return [community];
}

async function backfillCommunity(
  community: CommunityTarget,
  weeks: number[],
  from: number,
): Promise<{ created: number; updated: number; skipped: number; empty: number }> {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let empty = 0;

  console.log(`\n=== ${community.name} (${community.slug}) ===`);

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

  return { created, updated, skipped, empty };
}

async function main() {
  const { from, until } = await resolveFromUntil();
  const weeks = listWeekIndexesInclusive(from, until);
  const communities = await resolveCommunities();
  if (!communities.length) return;

  console.log(
    `[info] Comunidades: ${communities.length} | Semanas: ${from} → ${until} (${weeks.length})`,
  );
  console.log(`[info] dry-run=${DRY_RUN} force=${FORCE} all=${ALL} live-only=${LIVE_ONLY}`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let empty = 0;

  for (const community of communities) {
    const r = await backfillCommunity(community, weeks, from);
    created += r.created;
    updated += r.updated;
    skipped += r.skipped;
    empty += r.empty;
  }

  console.log("");
  console.log("=== RESUMO GERAL ===");
  console.log(`Comunidades: ${communities.length}`);
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

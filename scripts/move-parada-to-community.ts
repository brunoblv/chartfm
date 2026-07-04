/**
 * Converte uma parada pessoal em parada oficial de uma comunidade,
 * marcando todos os charts dela com community_id (padrão UCC: a Parada
 * continua atribuída a um usuário; a posse pela comunidade é no nível do Chart).
 *
 * Por padrão roda em modo dry-run (só verifica e reporta). Use --apply para gravar.
 *
 * Usage (na VPS, em /root/chartfm):
 *   npx tsx scripts/move-parada-to-community.ts
 *   npx tsx scripts/move-parada-to-community.ts --apply
 *   npx tsx scripts/move-parada-to-community.ts --parada=<id> --community=<id> --apply
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

const APPLY = process.argv.includes("--apply");
const PARADA_ARG = process.argv.find((a) => a.startsWith("--parada="));
const COMMUNITY_ARG = process.argv.find((a) => a.startsWith("--community="));

const PARADA_ID = PARADA_ARG ? PARADA_ARG.split("=")[1] : "cmr5uzuag0001wdob0glc8g3o";
const COMMUNITY_ID = COMMUNITY_ARG ? COMMUNITY_ARG.split("=")[1] : "cmr2tt8qg000q1s1gzws572c6";

async function main() {
  console.log(`[info] Modo: ${APPLY ? "APPLY (grava no banco)" : "dry-run (só verifica)"}`);

  const parada = await prisma.parada.findUnique({
    where: { id: PARADA_ID },
    select: {
      id: true,
      name: true,
      userId: true,
      isPrimary: true,
      chartSize: true,
      cadence: true,
      deletedAt: true,
      isCommunityOfficial: true,
      user: { select: { handle: true, name: true } },
    },
  });
  if (!parada) throw new Error(`Parada ${PARADA_ID} não encontrada.`);
  if (parada.deletedAt) throw new Error(`Parada ${PARADA_ID} está na lixeira (deletedAt).`);

  const community = await prisma.community.findUnique({
    where: { id: COMMUNITY_ID },
    select: {
      id: true,
      slug: true,
      name: true,
      paradaName: true,
      ownerId: true,
      owner: { select: { handle: true } },
    },
  });
  if (!community) throw new Error(`Comunidade ${COMMUNITY_ID} não encontrada.`);

  console.log(`[info] Parada: "${parada.name}" (${parada.id})`);
  console.log(
    `[info]   dona: @${parada.user.handle} | isPrimary: ${parada.isPrimary} | cadence: ${parada.cadence} | chartSize: ${parada.chartSize ?? "-"}`,
  );
  console.log(`[info] Comunidade: ${community.name} (${community.slug})`);
  console.log(
    `[info]   owner: @${community.owner?.handle ?? "?"} | paradaName: "${community.paradaName}"`,
  );

  if (community.ownerId && parada.userId !== community.ownerId) {
    console.warn(
      `[warn] A parada pertence a @${parada.user.handle}, que NÃO é o owner da comunidade. ` +
        "No padrão UCC a parada oficial fica com o owner — confirme se é intencional.",
    );
  }
  if (parada.isPrimary) {
    console.warn(
      "[warn] A parada é PRIMÁRIA do usuário: os charts dela contam para o Global 100 " +
        "(publishedPrimaryParadaChartWhere). A parada oficial da comunidade deveria ser " +
        "isPrimary=false. Este script NÃO altera isPrimary — trate manualmente se preciso.",
    );
  }

  const charts = await prisma.chart.findMany({
    where: { paradaId: PARADA_ID },
    select: { id: true, weekIndex: true, weekLabel: true, communityId: true, isPublished: true },
    orderBy: { weekIndex: "asc" },
  });
  console.log(`[info] Charts na parada: ${charts.length}`);
  for (const c of charts) {
    console.log(
      `  ${c.weekLabel} (weekIndex ${c.weekIndex}) — communityId: ${c.communityId ?? "null"}, published: ${c.isPublished}`,
    );
  }

  const foreign = charts.filter((c) => c.communityId && c.communityId !== COMMUNITY_ID);
  if (foreign.length) {
    throw new Error(
      `${foreign.length} chart(s) já pertencem a OUTRA comunidade (ex.: ${foreign[0].communityId}). Abortando.`,
    );
  }

  // Colisão de semanas com charts que a comunidade já possui em outras paradas
  // (o modo oficial agrega por communityId; semanas duplicadas somariam em dobro).
  const existing = await prisma.chart.findMany({
    where: { communityId: COMMUNITY_ID, paradaId: { not: PARADA_ID } },
    select: { weekIndex: true, paradaId: true },
  });
  console.log(`[info] Charts que a comunidade já possui em outras paradas: ${existing.length}`);
  const existingWeeks = new Set(existing.map((c) => c.weekIndex));
  const collisions = charts.filter((c) => existingWeeks.has(c.weekIndex));
  if (collisions.length) {
    console.error("[erro] Semanas em colisão (já existem como chart oficial da comunidade):");
    for (const c of collisions) console.error(`  weekIndex ${c.weekIndex} (${c.weekLabel})`);
    throw new Error("Resolva as colisões antes de aplicar. Abortando.");
  }

  const pending = charts.filter((c) => c.communityId !== COMMUNITY_ID);
  const needsFlag = !parada.isCommunityOfficial;

  if (!pending.length && !needsFlag) {
    console.log("[ok] Nada a fazer: charts já na comunidade e parada já marcada isCommunityOfficial.");
    return;
  }

  if (!APPLY) {
    if (pending.length) {
      console.log(`[dry-run] ${pending.length} chart(s) receberiam communityId=${COMMUNITY_ID}.`);
    }
    if (needsFlag) {
      console.log(
        "[dry-run] A parada seria marcada isCommunityOfficial=true (some do perfil do usuário e não conta no limite de paradas).",
      );
    }
    console.log("[dry-run] Rode novamente com --apply para gravar.");
    return;
  }

  if (pending.length) {
    const moved = await prisma.chart.updateMany({
      where: { paradaId: PARADA_ID, communityId: null },
      data: { communityId: COMMUNITY_ID },
    });
    console.log(`[ok] ${moved.count} chart(s) marcados como parada oficial da comunidade.`);
  }

  if (needsFlag) {
    await prisma.parada.update({
      where: { id: PARADA_ID },
      data: { isCommunityOfficial: true },
    });
    console.log(
      "[ok] Parada marcada isCommunityOfficial=true: some do perfil do usuário e não conta no limite de paradas.",
    );
  }
}

main()
  .catch((err) => {
    console.error("[erro]", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

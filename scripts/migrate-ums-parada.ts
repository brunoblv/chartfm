/**
 * Move charts da parada criada pelo importador para a parada principal existente
 * e remove a parada duplicada.
 *
 * Usage:
 *   npx tsx scripts/migrate-ums-parada.ts --dry-run
 *   npx tsx scripts/migrate-ums-parada.ts
 */

import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { syncUserPrimaryParadaFields } from "../lib/paradas";

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
const DRY_RUN = process.argv.includes("--dry-run");

const HANDLE = "bruno";
const TARGET_PARADA_NAME = "Under My Skin Video";
const SOURCE_PARADA_NAME = "Under My Skin Video Countdown (Top 20)";

async function main() {
  const user = await prisma.user.findUnique({
    where: { handle: HANDLE },
    select: { id: true, handle: true },
  });
  if (!user) throw new Error(`Usuário @${HANDLE} não encontrado.`);

  const target = await prisma.parada.findFirst({
    where: {
      userId: user.id,
      cadence: "WEEKLY",
      OR: [
        { name: TARGET_PARADA_NAME },
        {
          isPrimary: true,
          name: { contains: "Under My Skin Video", mode: "insensitive" },
        },
      ],
    },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
  });
  if (!target) {
    throw new Error(`Parada destino "${TARGET_PARADA_NAME}" não encontrada.`);
  }

  const source = await prisma.parada.findFirst({
    where: { userId: user.id, name: SOURCE_PARADA_NAME, cadence: "WEEKLY" },
  });
  if (!source) {
    console.log(`[info] Parada origem "${SOURCE_PARADA_NAME}" não existe — nada a migrar.`);
    return;
  }

  if (source.id === target.id) {
    console.log("[info] Origem e destino são a mesma parada — nada a migrar.");
    return;
  }

  const sourceCharts = await prisma.chart.findMany({
    where: { paradaId: source.id },
    select: { id: true, weekIndex: true, weekLabel: true },
    orderBy: { weekIndex: "asc" },
  });

  console.log(`[info] Destino: "${target.name}" (${target.id}) principal=${target.isPrimary}`);
  console.log(`[info] Origem:  "${source.name}" (${source.id})`);
  console.log(`[info] Charts a mover: ${sourceCharts.length}`);

  let moved = 0;
  let replaced = 0;

  for (const chart of sourceCharts) {
    const conflict = await prisma.chart.findUnique({
      where: { paradaId_weekIndex: { paradaId: target.id, weekIndex: chart.weekIndex } },
      select: { id: true, weekLabel: true },
    });

    if (conflict) {
      console.log(
        `[replace] ${chart.weekLabel} (${chart.weekIndex}): remove chart destino ${conflict.id}`,
      );
      if (!DRY_RUN) {
        await prisma.chart.delete({ where: { id: conflict.id } });
      }
      replaced += 1;
    }

    if (DRY_RUN) {
      console.log(`[dry-run] mover chart ${chart.id} -> "${target.name}"`);
    } else {
      await prisma.chart.update({
        where: { id: chart.id },
        data: { paradaId: target.id },
      });
    }
    moved += 1;
  }

  if (DRY_RUN) {
    console.log(`[dry-run] remover parada "${SOURCE_PARADA_NAME}" (${source.id})`);
  } else {
    await prisma.parada.delete({ where: { id: source.id } });
    if (!target.isPrimary) {
      await prisma.parada.updateMany({
        where: { userId: user.id },
        data: { isPrimary: false },
      });
      await prisma.parada.update({
        where: { id: target.id },
        data: { isPrimary: true },
      });
    }
    await syncUserPrimaryParadaFields(prisma, user.id);
  }

  console.log("");
  console.log("=== RESUMO ===");
  console.log(`Charts movidos: ${moved}`);
  console.log(`Conflitos substituídos no destino: ${replaced}`);
  console.log(`Parada removida: ${DRY_RUN ? "(dry-run)" : SOURCE_PARADA_NAME}`);
}

main()
  .catch((err) => {
    console.error("[erro]", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

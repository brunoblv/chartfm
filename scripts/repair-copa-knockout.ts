/**
 * Repara o mata-mata de uma copa que usou a estrutura antiga (oitavas direto).
 *
 * Uso:
 *   npx tsx scripts/repair-copa-knockout.ts              # lista copas ativas
 *   npx tsx scripts/repair-copa-knockout.ts --id <copaId> # simula
 *   npx tsx scripts/repair-copa-knockout.ts --id <copaId> --apply
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { repairCopaKnockout, fixMislabeledGroupFixtures } from "../lib/copa-repair";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
  }
}

const p = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

(async () => {
  const copaId = arg("--id");
  const apply = process.argv.includes("--apply");
  const fixGroupsOnly = process.argv.includes("--fix-groups");

  if (!copaId) {
    const editions = await p.copaEdition.findMany({
      where: { status: { not: "FINISHED" } },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { fixtures: true } },
      },
    });

    console.log("Copas em andamento:\n");
    for (const e of editions) {
      const byPhase = await p.copaFixture.groupBy({
        by: ["phase"],
        where: { copaId: e.id },
        _count: true,
      });
      const phases = Object.fromEntries(byPhase.map((x) => [x.phase, x._count]));
      console.log(`  ${e.id}`);
      console.log(`    ${e.name} ${e.year} · ${e.status} · ${e._count.fixtures} jogos`);
      console.log(`    fases:`, phases);
      console.log();
    }
    console.log("Repasse --id <copaId> --apply para executar o reparo.");
    return;
  }

  const mislabeled = await p.copaFixture.count({
    where: {
      copaId,
      groupLetter: { not: null, notIn: ["?"] },
      round: { in: [1, 2, 3] },
      NOT: { phase: "GROUP" },
    },
  });
  console.log(`Jogos de grupos com phase errada (devem ser GROUP): ${mislabeled}`);

  if (fixGroupsOnly) {
    if (!apply) {
      console.log("\n⚠ Simulação — use --apply para corrigir phase → GROUP.");
      return;
    }
    const fixed = await fixMislabeledGroupFixtures(copaId);
    console.log(`\n✓ ${fixed} jogo(s) corrigidos para GROUP.`);
    return;
  }

  const before = await p.copaFixture.groupBy({
    by: ["phase"],
    where: { copaId, phase: { not: "GROUP" } },
    _count: true,
  });
  console.log("Mata-mata atual (será apagado):", Object.fromEntries(before.map((x) => [x.phase, x._count])));

  if (!apply) {
    console.log("\n⚠ Simulação — nada foi alterado. Use --apply para executar.");
    return;
  }

  const result = await repairCopaKnockout(copaId);
  console.log(`\n✓ Reparo concluído:`);
  console.log(JSON.stringify(result, null, 2));
  console.log("\nOitavas R16 preservadas. Peça aos usuários definirem slot 3 (32 avos) em Meu Time.");
  console.log("Depois use Avançar Dia para abrir o Dia 7 (1/16 de final).");
})()
  .catch((e) => {
    console.error("ERR:", e.message);
    process.exit(1);
  })
  .finally(() => p.$disconnect());

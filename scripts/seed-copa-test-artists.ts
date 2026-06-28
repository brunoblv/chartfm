/**
 * Cadastra 7 artistas aleatórios na copa em inscrições (Global 100, ≥8 singles).
 *
 * Uso:
 *   npx tsx scripts/seed-copa-test-artists.ts
 *   npx tsx scripts/seed-copa-test-artists.ts --copa-id=cmqqvcjd50000e5q01vvso1we
 *   npx tsx scripts/seed-copa-test-artists.ts --owner-handle=copa-test-bot
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { seedCopaTestArtists } from "../lib/copa-seed-test-artists";

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

function parseArgs() {
  return {
    ownerHandle: process.argv.find((a) => a.startsWith("--owner-handle="))?.split("=")[1],
    copaId: process.argv.find((a) => a.startsWith("--copa-id="))?.split("=")[1],
    count: Number(process.argv.find((a) => a.startsWith("--count="))?.split("=")[1] || "7"),
  };
}

async function main() {
  const { ownerHandle, copaId: copaIdArg, count } = parseArgs();

  const copa = copaIdArg
    ? await prisma.copaEdition.findUnique({ where: { id: copaIdArg } })
    : await prisma.copaEdition.findFirst({
        where: { status: "REGISTRATION" },
        orderBy: { createdAt: "desc" },
      });

  if (!copa) throw new Error("Nenhuma copa em REGISTRATION encontrada.");

  console.log(`Copa: ${copa.name} ${copa.year} (${copa.id})`);

  const result = await seedCopaTestArtists(prisma, {
    copaId: copa.id,
    ownerHandle,
    count,
  });

  console.log(`\n@${result.ownerHandle} — ${result.artists.length} artista(s):`);
  for (const a of result.artists) {
    console.log(`\n✓ ${a.name}`);
    a.singles.forEach((s, i) => console.log(`    ${i + 1}. ${s}`));
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

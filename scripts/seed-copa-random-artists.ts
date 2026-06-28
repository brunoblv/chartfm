/**
 * Preenche uma copa em inscrições com artistas ALEATÓRIOS (qualquer artista com
 * ≥8 músicas no banco — não exige Global 100), 8 singles cada, distribuídos por
 * donos-bot até a copa ficar completa e pronta para o sorteio.
 *
 * Uso:
 *   npx tsx scripts/seed-copa-random-artists.ts --copa-id=XXXX --dry-run
 *   npx tsx scripts/seed-copa-random-artists.ts --copa-id=XXXX
 *   npx tsx scripts/seed-copa-random-artists.ts --copa-id=XXXX --owners=8 --per-owner=8
 *   npx tsx scripts/seed-copa-random-artists.ts --copa-id=XXXX --skip-humans
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { seedCopaRandomArtists } from "../lib/copa-seed-random-artists";

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

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const copaId = arg("copa-id");
  const copa = copaId
    ? await prisma.copaEdition.findUnique({ where: { id: copaId } })
    : await prisma.copaEdition.findFirst({ where: { status: "REGISTRATION" }, orderBy: { createdAt: "desc" } });
  if (!copa) throw new Error("Nenhuma copa em REGISTRATION encontrada (use --copa-id=).");

  const targetOwners = arg("owners") ? Number(arg("owners")) : undefined;
  const perOwner = arg("per-owner") ? Number(arg("per-owner")) : undefined;
  const skipHumans = flag("skip-humans");
  const dryRun = flag("dry-run");

  const r = await seedCopaRandomArtists(prisma, { copaId: copa.id, targetOwners, perOwner, skipHumans, dryRun });

  console.log(`\nCopa: ${r.copa.name} (${r.copa.id})`);
  console.log(`Capacidade: ${r.copa.maxParticipants} donos × ${r.copa.artistsPerUser} artistas | alvo por dono: ${r.perOwnerTarget}`);
  console.log(`Pool de artistas elegíveis (≥7 músicas): ${r.poolSize}`);
  console.log(`${r.dryRun ? "[SIMULAÇÃO] " : ""}Donos-bot criados: ${r.addedOwners} | Artistas adicionados: ${r.addedArtists}`);
  console.log(`\nTime por dono:`);
  for (const o of r.perOwnerAfter) {
    const ok = o.count >= r.perOwnerTarget ? "✓" : "⚠";
    console.log(`  ${ok} @${o.handle}${o.isBot ? " (bot)" : " (humano)"} — ${o.count}/${r.perOwnerTarget}`);
  }

  if (r.perOwnerTarget !== r.copa.artistsPerUser) {
    console.log(`\n⚠ per-owner (${r.perOwnerTarget}) ≠ artistsPerUser (${r.copa.artistsPerUser}). O sorteio exige TODOS os donos com exatamente ${r.copa.artistsPerUser} artistas.`);
  }
  if (r.pending > 0) {
    console.log(`\n⚠ Faltaram ${r.pending} vaga(s) — pool de artistas elegíveis acabou. A copa ainda não está completa para o sorteio.`);
  } else {
    console.log(`\n✓ Todos os donos completos${r.dryRun ? " (na simulação)" : ""}. ${r.dryRun ? "Rode sem --dry-run para gravar." : "Pronto para o Sorteio."}`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

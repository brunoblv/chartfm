/**
 * Limpeza única de snapshots antigos de entity_page_snapshots.
 * Apaga todos os dias anteriores a (hoje BRT − 2) e roda VACUUM FULL
 * para devolver o espaço ao sistema operacional.
 *
 * Uso (na VPS): npx tsx scripts/purge-entity-page-snapshots.ts
 * Dry-run:      npx tsx scripts/purge-entity-page-snapshots.ts --dry-run
 */
import { prisma } from "../lib/prisma";
import { snapshotDayBrt } from "../lib/snapshot-day";

const RETENTION_DAYS = 2;

async function tableSize(): Promise<string> {
  const rows = await prisma.$queryRaw<{ size: string }[]>`
    SELECT pg_size_pretty(pg_total_relation_size('entity_page_snapshots')) AS size`;
  return rows[0]?.size ?? "?";
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const cutoff = snapshotDayBrt();
  cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS);

  const total = await prisma.entityPageSnapshot.count();
  const old = await prisma.entityPageSnapshot.count({
    where: { snapshotDay: { lt: cutoff } },
  });
  console.log(`Tamanho atual: ${await tableSize()}`);
  console.log(`Linhas: ${total} no total, ${old} anteriores a ${cutoff.toISOString().slice(0, 10)}`);

  if (dryRun) {
    console.log("Dry-run: nada apagado.");
    return;
  }

  const deleted = await prisma.entityPageSnapshot.deleteMany({
    where: { snapshotDay: { lt: cutoff } },
  });
  console.log(`Apagadas ${deleted.count} linhas. Rodando VACUUM FULL…`);

  await prisma.$executeRawUnsafe("VACUUM FULL ANALYZE entity_page_snapshots");
  console.log(`Tamanho após VACUUM: ${await tableSize()}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * Gera/atualiza snapshots diários das páginas de artista, álbum e música.
 * Uso: npx tsx scripts/refresh-entity-page-snapshots.ts
 */
import { refreshAllEntityPageSnapshots } from "../lib/entity-page-snapshot/refresh";

async function main() {
  console.log("Atualizando snapshots de páginas de entidade…");
  const result = await refreshAllEntityPageSnapshots();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Busca capa, data de single, data de álbum e data de clipe no Bugs para
 * uma música específica. Ferramenta pontual — não roda em massa/cron
 * (ver memória "api-rate-limit-policy": Bugs é API não-oficial).
 *
 * Uso:
 *   npx tsx scripts/bugs-lookup.ts "Hype Boy" "NewJeans"
 */

import { lookupBugsRelease } from "../lib/bugs-lookup";

async function main() {
  const [title, artist] = process.argv.slice(2);
  if (!title || !artist) {
    console.error('Uso: npx tsx scripts/bugs-lookup.ts "<título>" "<artista>"');
    process.exit(1);
  }

  const result = await lookupBugsRelease(title, artist);

  console.log(`\nBusca: "${title}" — ${artist}\n`);
  if (!result.artistConfirmed && result.matches.length) {
    console.log("⚠ Artista não confirmado pelo nome informado (pode estar indexado pelo nome nativo no Bugs) — confira manualmente.\n");
  }
  console.log("Capa:            ", result.cover ?? "—");
  console.log("Data (single):   ", result.singleReleaseDate ?? "—");
  console.log("Data (álbum/EP): ", result.albumReleaseDate ?? "—");
  console.log("Data (clipe):    ", result.clipReleaseDate ?? "—");

  if (result.matches.length) {
    console.log("\nLançamentos encontrados:");
    for (const m of result.matches) {
      console.log(
        `  - [${m.albumType ?? "tipo?"}] ${m.albumTitle} (${m.releaseDate ?? "?"}) — album_id=${m.albumId}`,
      );
    }
  }

  if (result.clips.length) {
    console.log("\nClipes encontrados:");
    for (const c of result.clips) {
      console.log(`  - ${c.mvTitle} (${c.releaseDate ?? "?"}) — mv_id=${c.mvId}`);
    }
  }

  if (!result.matches.length) {
    console.log("\nNenhum lançamento correspondente encontrado no Bugs.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

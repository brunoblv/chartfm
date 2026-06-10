/**
 * Sobrescreve manualmente as posições 1 e 2 do weeklySongs para semanas específicas.
 * Posição 1: Olivia Rodrigo – drop dead
 * Posição 2: Lady Gaga (primeira música dela na lista)
 *
 * Uso: npx tsx scripts/override-top-positions.ts
 *      npx tsx scripts/override-top-positions.ts --dry-run
 */
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

import { prisma } from "../lib/prisma";
import type { GlobalSnapshotPayload } from "../lib/global-snapshot";

const WEEKS = [202622, 202623];
const DRY_RUN = process.argv.includes("--dry-run");

type WeeklySong = GlobalSnapshotPayload["weeklySongs"][number];

function matchesOliviaDropDead(s: WeeklySong): boolean {
  const artist = s.song.artist.toLowerCase();
  const title = s.song.title.toLowerCase();
  return artist.includes("olivia rodrigo") && title.includes("drop dead");
}

function matchesLadyGaga(s: WeeklySong): boolean {
  return s.song.artist.toLowerCase().includes("lady gaga");
}

function reorderTop(songs: WeeklySong[]): WeeklySong[] {
  const pos1 = songs.find(matchesOliviaDropDead);
  const pos2 = songs.find(matchesLadyGaga);

  if (!pos1) throw new Error("Entrada 'Olivia Rodrigo – drop dead' não encontrada no weeklySongs.");
  if (!pos2) throw new Error("Entrada 'Lady Gaga' não encontrada no weeklySongs.");
  if (pos1 === pos2) throw new Error("Olivia Rodrigo e Lady Gaga apontam para a mesma entrada.");

  // Restante na ordem original, excluindo os dois que foram movidos para o topo
  const rest = songs.filter((s) => s !== pos1 && s !== pos2);

  const reordered = [pos1, pos2, ...rest];

  return reordered.map((entry, i) => {
    const newPos = i + 1;
    // prevPos é a posição na semana ANTERIOR — não muda com o override
    const delta = entry.prevPos != null ? entry.prevPos - newPos : null;
    const status: WeeklySong["status"] =
      entry.status === "new" || entry.status === "return"
        ? entry.status
        : delta === null
        ? "new"
        : delta === 0
        ? "same"
        : delta > 0
        ? "up"
        : "down";
    return {
      ...entry,
      position: newPos,
      delta,
      status,
      peak: Math.min(entry.peak, newPos),
    };
  });
}

async function main() {
  for (const weekIndex of WEEKS) {
    const snap = await prisma.globalSnapshot.findUnique({ where: { weekIndex } });
    if (!snap) {
      console.log(`Semana ${weekIndex}: snapshot não encontrado — pulando.`);
      continue;
    }

    const songs = snap.weeklySongs as unknown as WeeklySong[];
    console.log(`\nSemana ${weekIndex}: ${songs.length} músicas`);
    console.log(`  atual #1: ${songs[0]?.song.artist} – ${songs[0]?.song.title}`);
    console.log(`  atual #2: ${songs[1]?.song.artist} – ${songs[1]?.song.title}`);

    const reordered = reorderTop(songs);
    console.log(`  novo  #1: ${reordered[0].song.artist} – ${reordered[0].song.title}`);
    console.log(`  novo  #2: ${reordered[1].song.artist} – ${reordered[1].song.title}`);

    if (!DRY_RUN) {
      await prisma.globalSnapshot.update({
        where: { weekIndex },
        data: { weeklySongs: reordered as unknown as object },
      });
      console.log(`  Salvo ✓`);
    } else {
      console.log(`  [dry-run] não salvo`);
    }
  }
  console.log("\nConcluído.");
}

main().catch(console.error).finally(() => prisma.$disconnect());

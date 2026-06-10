/**
 * Correção:
 * - 202621: aplicar override (#1 Olivia Rodrigo – drop dead, #2 Lady Gaga)
 * - 202622: já está correto (override já aplicado)
 * - 202623: recalcular normalmente (desfaz o override anterior)
 * - 202624: apagar (semana ainda não fechou)
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
import { saveGlobalSnapshotForWeek } from "../lib/global-snapshot";
import type { GlobalSnapshotPayload } from "../lib/global-snapshot";

type WeeklySong = GlobalSnapshotPayload["weeklySongs"][number];

function matchesOliviaDropDead(s: WeeklySong) {
  return s.song.artist.toLowerCase().includes("olivia rodrigo") && s.song.title.toLowerCase().includes("drop dead");
}
function matchesLadyGaga(s: WeeklySong) {
  return s.song.artist.toLowerCase().includes("lady gaga");
}

function reorderTop(songs: WeeklySong[]): WeeklySong[] {
  const pos1 = songs.find(matchesOliviaDropDead);
  const pos2 = songs.find(matchesLadyGaga);
  if (!pos1) throw new Error("'Olivia Rodrigo – drop dead' não encontrada.");
  if (!pos2) throw new Error("'Lady Gaga' não encontrada.");
  if (pos1 === pos2) throw new Error("Olivia Rodrigo e Lady Gaga apontam para a mesma entrada.");
  const rest = songs.filter((s) => s !== pos1 && s !== pos2);
  return [pos1, pos2, ...rest].map((entry, i) => {
    const newPos = i + 1;
    // prevPos é a posição na semana ANTERIOR — não muda com o override
    const delta = entry.prevPos != null ? entry.prevPos - newPos : null;
    const status: WeeklySong["status"] =
      entry.status === "new" || entry.status === "return"
        ? entry.status
        : delta === null ? "new" : delta === 0 ? "same" : delta > 0 ? "up" : "down";
    return { ...entry, position: newPos, delta, status, peak: Math.min(entry.peak, newPos) };
  });
}

async function main() {
  // 1. Override 202621
  console.log("--- 202621: aplicando override ---");
  const snap21 = await prisma.globalSnapshot.findUnique({ where: { weekIndex: 202621 } });
  if (!snap21) {
    console.log("202621: snapshot não encontrado, recalculando antes do override...");
    await saveGlobalSnapshotForWeek(202621);
  }
  const snap21fresh = await prisma.globalSnapshot.findUnique({ where: { weekIndex: 202621 } });
  const songs21 = snap21fresh!.weeklySongs as unknown as WeeklySong[];
  console.log(`  atual #1: ${songs21[0]?.song.artist} – ${songs21[0]?.song.title}`);
  console.log(`  atual #2: ${songs21[1]?.song.artist} – ${songs21[1]?.song.title}`);
  const reordered21 = reorderTop(songs21);
  await prisma.globalSnapshot.update({ where: { weekIndex: 202621 }, data: { weeklySongs: reordered21 as unknown as object } });
  console.log(`  novo  #1: ${reordered21[0].song.artist} – ${reordered21[0].song.title}`);
  console.log(`  novo  #2: ${reordered21[1].song.artist} – ${reordered21[1].song.title} ✓`);

  // 2. 202622 já está correto — apenas confirmar
  const snap22 = await prisma.globalSnapshot.findUnique({ where: { weekIndex: 202622 }, select: { weeklySongs: true } });
  const songs22 = snap22?.weeklySongs as unknown as WeeklySong[];
  console.log(`\n--- 202622: já corrigido ---`);
  console.log(`  #1: ${songs22?.[0]?.song.artist} – ${songs22?.[0]?.song.title}`);
  console.log(`  #2: ${songs22?.[1]?.song.artist} – ${songs22?.[1]?.song.title} ✓`);

  // 3. Recalcular 202623 (desfaz override anterior)
  console.log("\n--- 202623: recalculando ---");
  const result23 = await saveGlobalSnapshotForWeek(202623);
  console.log(`  #1: ${result23.payload.weeklySongs[0]?.song.artist} – ${result23.payload.weeklySongs[0]?.song.title}`);
  console.log(`  #2: ${result23.payload.weeklySongs[1]?.song.artist} – ${result23.payload.weeklySongs[1]?.song.title} ✓`);

  // 4. Apagar 202624
  console.log("\n--- 202624: apagando ---");
  const deleted = await prisma.globalSnapshot.deleteMany({ where: { weekIndex: 202624 } });
  console.log(`  ${deleted.count} snapshot(s) removido(s) ✓`);

  console.log("\nConcluído.");
}

main().catch(console.error).finally(() => prisma.$disconnect());

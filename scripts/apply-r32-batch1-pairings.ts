import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
  }
}

const p = new PrismaClient();
const copaId = process.argv[2] ?? "cmqr3sma1000gvacfk24dl970";

/** 1/16 · Parte 1 — confrontos que estavam ao vivo */
const PAIRINGS: Array<[string, string]> = [
  ["Fresno", "The Veronicas"],
  ["Christina Aguilera", "Florence + The Machine"],
  ["Britney Spears", "Marisa Monte"],
  ["Olivia Rodrigo", "Depeche Mode"],
  ["Kylie Minogue", "Madonna"],
  ["Avril Lavigne", "Katy Perry"],
  ["Spice Girls", "The Killers"],
  ["Kelly Clarkson", "Alanis Morissette"],
];

(async () => {
  const artists = await p.copaArtist.findMany({
    where: { copaId },
    select: { id: true, artistName: true },
  });
  const byName = new Map(artists.map((a) => [a.artistName, a.id]));

  for (const [a, b] of PAIRINGS) {
    if (!byName.has(a) || !byName.has(b)) {
      throw new Error(`Artista não encontrado: ${!byName.has(a) ? a : b}`);
    }
  }

  const fixtures = await p.copaFixture.findMany({
    where: { copaId, phase: "R32", matchIndex: { lte: 7 } },
    orderBy: { matchIndex: "asc" },
  });
  if (fixtures.length !== 8) {
    throw new Error(`Esperados 8 jogos R32 (mi 0–7), encontrados ${fixtures.length}`);
  }

  for (let i = 0; i < 8; i++) {
    const [nameA, nameB] = PAIRINGS[i];
    const f = fixtures[i];
    if (f.matchIndex !== i) throw new Error(`matchIndex mismatch at ${i}`);

    await p.copaFixture.update({
      where: { id: f.id },
      data: {
        artistAId: byName.get(nameA)!,
        artistBId: byName.get(nameB)!,
        singleAIdx: 3,
        singleBIdx: 3,
        status: "LIVE",
      },
    });
    console.log(`J${i + 1} OK: ${nameA} vs ${nameB}`);
  }

  const verify = await p.copaFixture.findMany({
    where: { copaId, phase: "R32", matchIndex: { lte: 7 } },
    include: {
      artistA: { include: { singles: true } },
      artistB: { include: { singles: true } },
    },
    orderBy: { matchIndex: "asc" },
  });
  console.log("\n=== Verificação ===");
  for (const f of verify) {
    const sA = f.artistA.singles.find((s) => s.slotIndex === 3);
    const sB = f.artistB.singles.find((s) => s.slotIndex === 3);
    console.log(
      `J${f.matchIndex + 1} [${f.status}] ${f.artistA.artistName} vs ${f.artistB.artistName}`,
    );
    console.log(`   "${sA?.songName}" × "${sB?.songName}"`);
  }
})()
  .catch((e) => {
    console.error("ERR:", e.message);
    process.exit(1);
  })
  .finally(() => p.$disconnect());

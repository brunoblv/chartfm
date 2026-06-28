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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

(async () => {
  const r32 = await p.copaFixture.findMany({
    where: { copaId, phase: "R32" },
    include: {
      artistA: { select: { id: true, artistName: true } },
      artistB: { select: { id: true, artistName: true } },
    },
    orderBy: { matchIndex: "asc" },
  });

  const batch1Ids = new Set<string>();
  for (const f of r32.filter((x) => x.matchIndex < 8)) {
    batch1Ids.add(f.artistAId);
    batch1Ids.add(f.artistBId);
  }

  const allR32Ids = new Set<string>();
  for (const f of r32) {
    allR32Ids.add(f.artistAId);
    allR32Ids.add(f.artistBId);
  }

  // Artistas do 1/16 que ainda não estão na parte 1 (inclui os 8 “órfãos” dos jogos antigos)
  const poolFromFixtures = [...allR32Ids].filter((id) => !batch1Ids.has(id));

  // Completar pool: 1º/2º de cada grupo que ainda não apareceu na parte 1
  const { COPA_GROUP_LETTERS, computeStandings } = await import("../lib/copa");
  const groupFixtures = await p.copaFixture.findMany({
    where: { copaId, phase: "GROUP" },
    include: { votes: true },
  });
  const allArtists = await p.copaArtist.findMany({ where: { copaId }, select: { id: true, groupLetter: true } });

  const qualifiedIds = new Set<string>();
  for (const letter of COPA_GROUP_LETTERS) {
    const ids = allArtists.filter((a) => a.groupLetter === letter).map((a) => a.id);
    if (ids.length < 2) continue;
    const standings = computeStandings(
      groupFixtures.filter((f) => f.groupLetter === letter),
      ids,
    );
    if (standings[0]) qualifiedIds.add(standings[0].artistId);
    if (standings[1]) qualifiedIds.add(standings[1].artistId);
  }

  const remainingIds = [...qualifiedIds].filter((id) => !batch1Ids.has(id));
  const merged = new Set([...poolFromFixtures, ...remainingIds]);

  if (merged.size !== 16) {
    throw new Error(
      `Esperados 16 artistas para a parte 2, encontrados ${merged.size}. ` +
        `Verifique classificados dos grupos e parte 1.`,
    );
  }

  const artists = await p.copaArtist.findMany({
    where: { id: { in: [...merged] } },
    select: { id: true, artistName: true },
  });

  const shuffled = shuffle(artists);
  const pairings: Array<{ artistAId: string; artistBId: string; nameA: string; nameB: string }> = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    pairings.push({
      artistAId: shuffled[i].id,
      artistBId: shuffled[i + 1].id,
      nameA: shuffled[i].artistName,
      nameB: shuffled[i + 1].artistName,
    });
  }

  const batch2Fixtures = r32.filter((f) => f.matchIndex >= 8);
  if (batch2Fixtures.length !== 8) {
    throw new Error(`Esperados 8 fixtures (J9–J16), encontrados ${batch2Fixtures.length}`);
  }

  for (let j = 0; j < 8; j++) {
    const f = batch2Fixtures[j];
    const pair = pairings[j];
    await p.copaFixture.update({
      where: { id: f.id },
      data: {
        matchIndex: 8 + j,
        artistAId: pair.artistAId,
        artistBId: pair.artistBId,
        singleAIdx: 3,
        singleBIdx: 3,
        status: "UPCOMING",
      },
    });
    console.log(`J${9 + j}: ${pair.nameA} vs ${pair.nameB}`);
  }

  const verify = await p.copaFixture.findMany({
    where: { copaId, phase: "R32", matchIndex: { gte: 8 } },
    include: {
      artistA: { include: { singles: { where: { slotIndex: 3 } } } },
      artistB: { include: { singles: { where: { slotIndex: 3 } } } },
    },
    orderBy: { matchIndex: "asc" },
  });
  console.log("\n=== Parte 2 (UPCOMING) ===");
  for (const f of verify) {
    const sA = f.artistA.singles[0];
    const sB = f.artistB.singles[0];
    console.log(
      `J${f.matchIndex + 1} ${f.artistA.artistName} vs ${f.artistB.artistName} — "${sA?.songName ?? "?"}" × "${sB?.songName ?? "?"}"`,
    );
  }
})()
  .catch((e) => {
    console.error("ERR:", e.message);
    process.exit(1);
  })
  .finally(() => p.$disconnect());

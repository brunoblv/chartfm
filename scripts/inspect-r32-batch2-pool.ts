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
const copaId = "cmqr3sma1000gvacfk24dl970";

(async () => {
  const r32 = await p.copaFixture.findMany({
    where: { copaId, phase: "R32" },
    include: {
      artistA: { select: { id: true, artistName: true } },
      artistB: { select: { id: true, artistName: true } },
    },
    orderBy: { matchIndex: "asc" },
  });

  const batch1 = r32.filter((f) => f.matchIndex < 8);
  const batch2 = r32.filter((f) => f.matchIndex >= 8);

  const inBatch1 = new Set<string>();
  for (const f of batch1) {
    inBatch1.add(f.artistAId);
    inBatch1.add(f.artistBId);
  }

  const allR32Ids = new Set<string>();
  for (const f of r32) {
    allR32Ids.add(f.artistAId);
    allR32Ids.add(f.artistBId);
  }

  console.log("Batch 1 artists:", batch1.flatMap((f) => [f.artistA.artistName, f.artistB.artistName]));
  console.log("\nAll R32 count:", allR32Ids.size);
  console.log("Batch 1 count:", inBatch1.size);

  const remaining = [...allR32Ids].filter((id) => !inBatch1.has(id));
  const remainingNames = await p.copaArtist.findMany({
    where: { id: { in: remaining } },
    select: { id: true, artistName: true },
    orderBy: { artistName: "asc" },
  });
  console.log("\nRemaining for batch 2:", remainingNames.length);
  console.log(remainingNames.map((a) => a.artistName).join(", "));

  console.log("\nCurrent batch 2:");
  for (const f of batch2) {
    console.log(`  J${f.matchIndex + 1}: ${f.artistA.artistName} vs ${f.artistB.artistName}`);
  }
})().finally(() => p.$disconnect());

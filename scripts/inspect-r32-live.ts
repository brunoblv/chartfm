import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { fixtureBatchOrder } from "../lib/copa";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
  }
}

const p = new PrismaClient();
const copaId = process.argv[2] ?? "cmqr3sma1000gvacfk24dl970";

(async () => {
  const copa = await p.copaEdition.findUnique({
    where: { id: copaId },
    select: { name: true, year: true, status: true, startsAt: true },
  });
  console.log("Copa:", copa);

  const live = await p.copaFixture.findMany({
    where: { copaId, status: "LIVE" },
    include: {
      artistA: { select: { artistName: true } },
      artistB: { select: { artistName: true } },
    },
    orderBy: [{ phase: "asc" }, { matchIndex: "asc" }],
  });
  console.log("\n=== LIVE fixtures:");
  for (const f of live) {
    console.log(`  ${f.phase} mi=${f.matchIndex} batch=${fixtureBatchOrder(f)} | ${f.artistA.artistName} vs ${f.artistB.artistName}`);
  }

  const r32 = await p.copaFixture.findMany({
    where: { copaId, phase: "R32" },
    include: {
      artistA: { select: { artistName: true } },
      artistB: { select: { artistName: true } },
    },
    orderBy: { matchIndex: "asc" },
  });
  console.log("\n=== All R32:");
  for (const f of r32) {
    console.log(`  mi=${f.matchIndex} status=${f.status} batch=${fixtureBatchOrder(f)} | ${f.artistA.artistName} vs ${f.artistB.artistName}`);
  }

  const r32Live = r32.filter((f) => f.status === "LIVE");
  const r32Upcoming = r32.filter((f) => f.status === "UPCOMING");
  console.log(`\nR32 LIVE: ${r32Live.length}, UPCOMING: ${r32Upcoming.length}`);

  const byBatch = new Map<number, typeof r32>();
  for (const f of [...r32, ...live.filter((x) => x.phase !== "R32")]) {
    const b = fixtureBatchOrder(f);
    if (!byBatch.has(b)) byBatch.set(b, []);
    byBatch.get(b)!.push(f as typeof r32[0]);
  }
  console.log("\n=== By batch (live status):");
  for (const [b, fixtures] of [...byBatch.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  batch ${b}: ${fixtures.map((f) => `${f.phase} mi=${f.matchIndex} ${f.status}`).join(", ")}`);
  }
})()
  .finally(() => p.$disconnect());

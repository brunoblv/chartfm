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

(async () => {
  const live = await p.copaFixture.findMany({
    where: { copaId, status: "LIVE" },
    include: {
      artistA: { include: { singles: true } },
      artistB: { include: { singles: true } },
    },
    orderBy: [{ phase: "asc" }, { matchIndex: "asc" }],
  });

  console.log("=== LIVE fixtures:", live.length);
  for (const f of live) {
    const sA = f.artistA.singles.find((s) => s.slotIndex === f.singleAIdx);
    const sB = f.artistB.singles.find((s) => s.slotIndex === f.singleBIdx);
    const sA3 = f.artistA.singles.find((s) => s.slotIndex === 3);
    const sB3 = f.artistB.singles.find((s) => s.slotIndex === 3);

    console.log(`\n${f.phase} mi=${f.matchIndex} singleAIdx=${f.singleAIdx} singleBIdx=${f.singleBIdx}`);
    console.log(`  A: ${f.artistA.artistName} -> [${f.singleAIdx}]: ${sA?.songName ?? "?"}`);
    if (f.singleAIdx === 4 && sA3 && sA?.songName !== sA3.songName) {
      console.log(`  A MISMATCH — slot 3 tinha: ${sA3.songName}`);
    }
    console.log(`  B: ${f.artistB.artistName} -> [${f.singleBIdx}]: ${sB?.songName ?? "?"}`);
    if (f.singleBIdx === 4 && sB3 && sB?.songName !== sB3.songName) {
      console.log(`  B MISMATCH — slot 3 tinha: ${sB3.songName}`);
    }
  }

  const r16 = await p.copaFixture.findMany({
    where: { copaId, phase: "R16" },
    select: { id: true, matchIndex: true, status: true, singleAIdx: true, singleBIdx: true },
    orderBy: { matchIndex: "asc" },
  });
  console.log("\n=== All R16 fixtures:");
  console.log(JSON.stringify(r16, null, 2));

  const slot3Live = await p.copaFixture.count({
    where: { copaId, status: "LIVE", OR: [{ singleAIdx: 3 }, { singleBIdx: 3 }] },
  });
  const slot4Live = await p.copaFixture.count({
    where: { copaId, status: "LIVE", OR: [{ singleAIdx: 4 }, { singleBIdx: 4 }] },
  });
  console.log(`\nLIVE using slot 3: ${slot3Live}, slot 4: ${slot4Live}`);
})()
  .catch((e) => {
    console.error("ERR:", e.message);
    process.exit(1);
  })
  .finally(() => p.$disconnect());

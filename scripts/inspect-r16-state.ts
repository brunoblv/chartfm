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
  const byPhase = await p.copaFixture.groupBy({
    by: ["phase", "status"],
    where: { copaId },
    _count: true,
  });
  console.log("Fixtures by phase/status:", byPhase);

  const r16 = await p.copaFixture.findMany({
    where: { copaId, phase: "R16" },
    include: {
      artistA: { select: { artistName: true } },
      artistB: { select: { artistName: true } },
    },
    orderBy: { matchIndex: "asc" },
  });
  console.log("\nR16 fixtures:", r16.length);
  for (const f of r16) {
    console.log(`  mi=${f.matchIndex} ${f.status} | ${f.artistA.artistName} vs ${f.artistB.artistName}`);
  }

  const r32live = await p.copaFixture.count({ where: { copaId, phase: "R32", status: "LIVE" } });
  const r32done = await p.copaFixture.count({ where: { copaId, phase: "R32", status: "DONE" } });
  console.log(`\nR32 LIVE=${r32live} DONE=${r32done}`);
})().finally(() => p.$disconnect());

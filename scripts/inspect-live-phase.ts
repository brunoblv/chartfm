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
const copaId = "cmqr3sma1000gvacfk24dl970";

(async () => {
  const live = await p.copaFixture.findMany({
    where: { copaId, status: "LIVE" },
    include: {
      artistA: { select: { artistName: true } },
      artistB: { select: { artistName: true } },
    },
    orderBy: { matchIndex: "asc" },
  });
  console.log("LIVE count:", live.length);
  for (const f of live) {
    console.log(`  ${f.phase} mi=${f.matchIndex} batch=${fixtureBatchOrder(f)} | ${f.artistA.artistName} vs ${f.artistB.artistName}`);
  }

  const notR32Live = live.filter((f) => f.phase !== "R32");
  if (notR32Live.length) console.log("\nWARNING: LIVE not in R32:", notR32Live.length);
})().finally(() => p.$disconnect());

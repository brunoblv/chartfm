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
  const groups = await p.copaFixture.findMany({
    where: { copaId, phase: "GROUP" },
    select: { groupLetter: true, round: true, status: true },
  });
  const byBatch = new Map<number, { done: number; total: number }>();
  for (const f of groups) {
    const b = fixtureBatchOrder(f);
    const cur = byBatch.get(b) ?? { done: 0, total: 0 };
    cur.total++;
    if (f.status === "DONE") cur.done++;
    byBatch.set(b, cur);
  }
  console.log("Group batches:");
  for (const [b, s] of [...byBatch.entries()].sort((a, c) => a[0] - c[0])) {
    console.log(`  batch ${b}: ${s.done}/${s.total} DONE`);
  }
})().finally(() => p.$disconnect());

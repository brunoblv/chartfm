import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { copaDayIndex } from "../lib/copa-day";
import { fixtureBatchOrder, COPA_DAY_LABELS } from "../lib/copa";

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
  const copa = await p.copaEdition.findUnique({ where: { id: copaId }, select: { startsAt: true } });
  const now = new Date();
  const dayIndex = copa?.startsAt ? copaDayIndex(copa.startsAt, now) : -1;
  console.log("Today dayIndex:", dayIndex, "label:", COPA_DAY_LABELS[dayIndex]);

  const r16live = await p.copaFixture.findMany({
    where: { copaId, phase: "R16", status: "LIVE" },
    include: { _count: { select: { votes: true } } },
  });
  console.log("\nR16 LIVE votes:", r16live.map((f) => f._count.votes));

  const all = await p.copaFixture.findMany({
    where: { copaId },
    select: { phase: true, status: true, matchIndex: true },
  });
  const doneByBatch = new Map<number, string[]>();
  for (const f of all) {
    const b = fixtureBatchOrder(f);
    if (f.status === "DONE") {
      if (!doneByBatch.has(b)) doneByBatch.set(b, []);
      doneByBatch.get(b)!.push(`${f.phase} mi=${f.matchIndex}`);
    }
  }
  console.log("\nDONE batches:");
  for (const [b, items] of [...doneByBatch.entries()].sort((a, c) => a[0] - c[0])) {
    console.log(`  batch ${b} (${COPA_DAY_LABELS[b]}): ${items.length} jogos`);
  }

  const minUpcoming = Math.min(
    ...all.filter((f) => f.status === "UPCOMING").map((f) => fixtureBatchOrder(f)),
  );
  console.log("\nMin UPCOMING batch:", minUpcoming, COPA_DAY_LABELS[minUpcoming]);
})().finally(() => p.$disconnect());

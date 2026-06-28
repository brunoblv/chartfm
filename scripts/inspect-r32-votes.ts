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
  const r32 = await p.copaFixture.findMany({
    where: { copaId, phase: "R32" },
    include: { _count: { select: { votes: true } } },
    orderBy: { matchIndex: "asc" },
  });
  for (const f of r32) {
    console.log(`mi=${f.matchIndex} ${f.status} votes=${f._count.votes} batch=${fixtureBatchOrder(f)}`);
  }
})().finally(() => p.$disconnect());

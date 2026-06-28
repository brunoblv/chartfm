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
  const rows = await p.copaFixture.findMany({
    where: { copaId, phase: "R32" },
    include: {
      artistA: { include: { singles: true } },
      artistB: { include: { singles: true } },
    },
    orderBy: { matchIndex: "asc" },
  });
  console.log("=== 1/16 DE FINAL (R32) ===\n");
  for (const f of rows) {
    const sA = f.artistA.singles.find((s) => s.slotIndex === f.singleAIdx);
    const sB = f.artistB.singles.find((s) => s.slotIndex === f.singleBIdx);
    console.log(
      `J${f.matchIndex + 1} [${f.status}] ${f.artistA.artistName} vs ${f.artistB.artistName}`,
    );
    console.log(`   A: "${sA?.songName ?? "?"}" | B: "${sB?.songName ?? "?"}"\n`);
  }
})().finally(() => p.$disconnect());

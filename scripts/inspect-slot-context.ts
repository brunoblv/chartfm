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
  const r32 = await p.copaFixture.groupBy({
    by: ["status"],
    where: { copaId, phase: "R32" },
    _count: true,
  });
  console.log("R32 by status:", r32);

  const sample = await p.copaArtist.findFirst({
    where: { copaId, artistName: "Fresno" },
    include: { singles: { orderBy: { slotIndex: "asc" } } },
  });
  console.log("\nFresno singles:", sample?.singles.map((s) => `[${s.slotIndex}] ${s.songName}`));

  const r32Fix = await p.copaFixture.findFirst({
    where: { copaId, phase: "R32", OR: [{ artistAId: sample?.id }, { artistBId: sample?.id }] },
    select: { status: true, singleAIdx: true, singleBIdx: true, matchIndex: true },
  });
  console.log("Fresno R32 fixture:", r32Fix);
})()
  .finally(() => p.$disconnect());

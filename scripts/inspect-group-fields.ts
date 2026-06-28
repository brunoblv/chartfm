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
p.copaFixture
  .findMany({
    where: { copaId: "cmqr3sma1000gvacfk24dl970", phase: "GROUP" },
    select: { groupLetter: true, round: true, matchIndex: true },
    take: 5,
  })
  .then((rows) => {
    console.log(rows);
    return p.copaFixture.groupBy({
      by: ["groupLetter", "round"],
      where: { copaId: "cmqr3sma1000gvacfk24dl970", phase: "GROUP" },
      _count: true,
    });
  })
  .then(console.log)
  .finally(() => p.$disconnect());

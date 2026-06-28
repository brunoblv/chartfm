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
  const totalVotes = await p.copaVote.count({
    where: { fixture: { copaId } },
  });
  console.log("Total votos na copa:", totalVotes);

  const byPhase = await p.copaVote.groupBy({
    by: ["fixtureId"],
    where: { fixture: { copaId } },
    _count: true,
  });
  console.log("Fixtures com votos:", byPhase.length);

  const liveFixtures = await p.copaFixture.findMany({
    where: { copaId, status: "LIVE" },
    include: { _count: { select: { votes: true } }, artistA: { select: { artistName: true } }, artistB: { select: { artistName: true } } },
    orderBy: { matchIndex: "asc" },
  });
  console.log("\nLIVE fixtures:");
  for (const f of liveFixtures) {
    console.log(`  ${f.phase} mi=${f.matchIndex} votes=${f._count.votes} | ${f.artistA.artistName} vs ${f.artistB.artistName} id=${f.id}`);
  }

  const allVotes = await p.copaVote.findMany({
    where: { fixture: { copaId } },
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { fixture: { select: { phase: true, matchIndex: true } } },
  });
  console.log("\nÚltimos 5 votos (se existirem):", allVotes);

  const deletedFixtureVotes = await p.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n FROM copa_votes v
    WHERE NOT EXISTS (SELECT 1 FROM copa_fixtures f WHERE f.id = v.fixture_id)
  `;
  console.log("\nVotos órfãos (fixture apagado):", deletedFixtureVotes[0]?.n?.toString());
})().finally(() => p.$disconnect());

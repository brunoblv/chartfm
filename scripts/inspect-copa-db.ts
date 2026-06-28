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

(async () => {
  const editions = await p.copaEdition.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { copaArtists: true, fixtures: true } } },
  });

  console.log("=== Edições ===\n");
  for (const e of editions) {
    console.log(`${e.name} ${e.year} | ${e.status} | id=${e.id}`);
    console.log(`  artistas: ${e._count.copaArtists} | jogos: ${e._count.fixtures}`);

    const byPhase = await p.copaFixture.groupBy({
      by: ["phase"],
      where: { copaId: e.id },
      _count: true,
    });
    console.log("  por phase:", Object.fromEntries(byPhase.map((x) => [x.phase, x._count])));

    const mislabeled = await p.copaFixture.count({
      where: {
        copaId: e.id,
        groupLetter: { not: null, notIn: ["?"] },
        round: { in: [1, 2, 3] },
        NOT: { phase: "GROUP" },
      },
    });
    const properGroup = await p.copaFixture.count({
      where: { copaId: e.id, phase: "GROUP" },
    });
    const knockoutR16 = await p.copaFixture.count({
      where: {
        copaId: e.id,
        phase: "R16",
        OR: [{ groupLetter: null }, { groupLetter: "?" }],
      },
    });
    const r32 = await p.copaFixture.count({ where: { copaId: e.id, phase: "R32" } });

    const byStatus = await p.copaFixture.groupBy({
      by: ["status"],
      where: { copaId: e.id },
      _count: true,
    });
    console.log("  por status:", Object.fromEntries(byStatus.map((x) => [x.status, x._count])));
    console.log(`  grupos phase=GROUP: ${properGroup}`);
    console.log(`  grupos phase ERRADA (tem group_letter+round): ${mislabeled}`);
    console.log(`  mata-mata R16 (sem group_letter): ${knockoutR16}`);
    console.log(`  mata-mata R32: ${r32}`);

    if (mislabeled > 0) {
      const sample = await p.copaFixture.findMany({
        where: {
          copaId: e.id,
          groupLetter: { not: null, notIn: ["?"] },
          round: { in: [1, 2, 3] },
          NOT: { phase: "GROUP" },
        },
        select: { id: true, phase: true, groupLetter: true, round: true, status: true, matchIndex: true },
        take: 5,
        orderBy: { matchIndex: "asc" },
      });
      console.log("  amostra phase errada:", sample);
    }
    console.log();
  }

  const raw = await p.$queryRaw<
    { phase: string; has_group: boolean; has_round: boolean; n: bigint }[]
  >`
    SELECT phase::text AS phase,
           (group_letter IS NOT NULL AND group_letter <> '?') AS has_group,
           (round IS NOT NULL) AS has_round,
           COUNT(*)::bigint AS n
    FROM copa_fixtures
    GROUP BY 1, 2, 3
    ORDER BY 1, 2 DESC, 3 DESC
  `;
  console.log("=== Raw SQL (phase × group_letter × round) ===");
  for (const row of raw) {
    console.log(`  phase=${row.phase} has_group=${row.has_group} has_round=${row.has_round} n=${row.n}`);
  }
})()
  .catch((e) => {
    console.error("ERR:", e.message);
    process.exit(1);
  })
  .finally(() => p.$disconnect());

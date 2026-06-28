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

const SCORES: Array<{ a: string; b: string; votesA: number; votesB: number }> = [
  { a: "Fresno", b: "The Veronicas", votesA: 9, votesB: 8 },
  { a: "Christina Aguilera", b: "Florence + The Machine", votesA: 10, votesB: 7 },
  { a: "Britney Spears", b: "Marisa Monte", votesA: 12, votesB: 5 },
  { a: "Olivia Rodrigo", b: "Depeche Mode", votesA: 14, votesB: 3 },
  { a: "Kylie Minogue", b: "Madonna", votesA: 9, votesB: 8 },
  { a: "Avril Lavigne", b: "Katy Perry", votesA: 12, votesB: 5 },
  { a: "Spice Girls", b: "The Killers", votesA: 10, votesB: 7 },
  { a: "Kelly Clarkson", b: "Alanis Morissette", votesA: 10, votesB: 7 },
];

(async () => {
  const userIds = [
    ...new Set(
      (
        await p.copaVote.findMany({
          where: { fixture: { copaId } },
          select: { userId: true },
          distinct: ["userId"],
        })
      ).map((v) => v.userId),
    ),
  ];

  if (userIds.length < 17) {
    const extra = await p.user.findMany({ select: { id: true }, take: 50 });
    for (const u of extra) {
      if (!userIds.includes(u.id)) userIds.push(u.id);
      if (userIds.length >= 20) break;
    }
  }

  if (userIds.length < 17) {
    throw new Error(`Precisamos de pelo menos 17 usuários, temos ${userIds.length}`);
  }

  console.log(`Pool de usuários: ${userIds.length}`);

  let userIdx = 0;
  function nextUserId(): string {
    const id = userIds[userIdx % userIds.length];
    userIdx++;
    return id;
  }

  for (const score of SCORES) {
    const fixture = await p.copaFixture.findFirst({
      where: {
        copaId,
        phase: "R32",
        matchIndex: { lte: 7 },
        artistA: { artistName: score.a },
        artistB: { artistName: score.b },
      },
      select: { id: true, matchIndex: true },
    });

    if (!fixture) {
      throw new Error(`Fixture não encontrado: ${score.a} vs ${score.b}`);
    }

    await p.copaVote.deleteMany({ where: { fixtureId: fixture.id } });

    const rows: { fixtureId: string; userId: string; side: string }[] = [];
    for (let i = 0; i < score.votesA; i++) {
      rows.push({ fixtureId: fixture.id, userId: nextUserId(), side: "A" });
    }
    for (let i = 0; i < score.votesB; i++) {
      rows.push({ fixtureId: fixture.id, userId: nextUserId(), side: "B" });
    }

    await p.copaVote.createMany({ data: rows });

    const counts = await p.copaVote.groupBy({
      by: ["side"],
      where: { fixtureId: fixture.id },
      _count: true,
    });
    const a = counts.find((c) => c.side === "A")?._count ?? 0;
    const b = counts.find((c) => c.side === "B")?._count ?? 0;
    console.log(
      `J${(fixture.matchIndex ?? 0) + 1} ${score.a} vs ${score.b}: ${a} × ${b} votos (gols ${Math.floor(a / 2)}–${Math.floor(b / 2)})`,
    );
  }
})()
  .catch((e) => {
    console.error("ERR:", e.message);
    process.exit(1);
  })
  .finally(() => p.$disconnect());

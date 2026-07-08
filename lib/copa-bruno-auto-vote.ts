import { prisma } from "./prisma";

// Handles das 22 paradas "de estilo" que votam em massa nos jogos abertos da Copa.
const AUTO_VOTE_HANDLES = [
  "cesarmaziero", "demilovatique", "dudabts", "kendikamura", "julianast", "karlacomk",
  "theandre", "joaoHT", "caiosoares", "heavydirtysoul", "jessycv", "midnightrain",
  "mayaradias", "diegox", "guisouza", "kamarcelino", "marinasemdiamonds", "lachica",
  "xalmeida", "sandman", "ingrididas7", "keku",
];

// Artistas que recebem voto garantido de todos os 22 (quando estiverem em algum
// jogo aberto na rodada atual); os demais jogos recebem voto aleatório.
const FORCED_ARTIST_NAMES = ["Silverchair", "Bring Me the Horizon", "Foo Fighters", "Keane"];

function randomSide(): "A" | "B" {
  return Math.random() < 0.5 ? "A" : "B";
}

export type BrunoAutoVoteResult =
  | { ok: false; error: string }
  | {
      ok: true;
      copaId: string;
      fixturesVoted: number;
      usersVoted: number;
      votesCreated: number;
      votesAttempted: number;
      forcedArtists: string[];
      forcedFixtures: number;
      missingHandles: string[];
    };

/**
 * Faz os 22 usuários das paradas "de estilo" votarem em todos os jogos "LIVE"
 * da Copa ativa: aleatório em geral, mas todos votam no lado dos artistas em
 * FORCED_ARTIST_NAMES (se estiverem em algum jogo aberto). Idempotente — usa
 * `@@unique([fixtureId, userId])` + skipDuplicates, então pode ser chamada
 * repetidamente (ex.: cron a cada minuto) sem duplicar ou alterar votos já dados.
 */
export async function runBrunoAutoVote(): Promise<BrunoAutoVoteResult> {
  const copa = await prisma.copaEdition.findFirst({
    where: { status: { not: "FINISHED" } },
    orderBy: { createdAt: "desc" },
  });
  if (!copa) return { ok: false, error: "Nenhuma Copa ativa encontrada" };

  const fixtures = await prisma.copaFixture.findMany({
    where: { copaId: copa.id, status: "LIVE" },
    select: { id: true, artistAId: true, artistBId: true },
  });
  if (!fixtures.length) return { ok: false, error: "Nenhum jogo aberto (LIVE) no momento" };

  const forcedArtists = await prisma.copaArtist.findMany({
    where: { copaId: copa.id, OR: FORCED_ARTIST_NAMES.map((name) => ({ artistName: { contains: name, mode: "insensitive" as const } })) },
    select: { id: true, artistName: true },
  });
  const forcedArtistIds = new Set(forcedArtists.map((a) => a.id));

  const users = await prisma.user.findMany({
    where: { handle: { in: AUTO_VOTE_HANDLES } },
    select: { id: true, handle: true },
  });
  const missingHandles = AUTO_VOTE_HANDLES.filter((h) => !users.some((u) => u.handle.toLowerCase() === h.toLowerCase()));

  const sideForFixture = new Map<string, "A" | "B">();
  for (const f of fixtures) {
    if (forcedArtistIds.has(f.artistAId)) sideForFixture.set(f.id, "A");
    else if (forcedArtistIds.has(f.artistBId)) sideForFixture.set(f.id, "B");
  }

  const votesData: Array<{ fixtureId: string; userId: string; side: "A" | "B" }> = [];
  for (const user of users) {
    for (const f of fixtures) {
      const side = sideForFixture.get(f.id) ?? randomSide();
      votesData.push({ fixtureId: f.id, userId: user.id, side });
    }
  }

  const result = await prisma.copaVote.createMany({ data: votesData, skipDuplicates: true });

  return {
    ok: true,
    copaId: copa.id,
    fixturesVoted: fixtures.length,
    usersVoted: users.length,
    votesCreated: result.count,
    votesAttempted: votesData.length,
    forcedArtists: forcedArtists.map((a) => a.artistName),
    forcedFixtures: sideForFixture.size,
    missingHandles,
  };
}

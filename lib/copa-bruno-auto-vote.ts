import { prisma } from "./prisma";

// Handles das 22 paradas "de estilo" que votam em massa nos jogos abertos da Copa.
const AUTO_VOTE_HANDLES = [
  "cesarmaziero", "demilovatique", "dudabts", "kendikamura", "julianast", "karlacomk",
  "theandre", "joaoHT", "caiosoares", "heavydirtysoul", "jessycv", "midnightrain",
  "mayaradias", "diegox", "guisouza", "kamarcelino", "marinasemdiamonds", "lachica",
  "xalmeida", "sandman", "ingrididas7", "keku",
];

function randomSide(): "A" | "B" {
  return Math.random() < 0.5 ? "A" : "B";
}

export type EnqueueBrunoAutoVoteResult =
  | { ok: false; error: string }
  | {
      ok: true;
      copaId: string;
      fixturesOpen: number;
      usersConsidered: number;
      queued: number;
      alreadyVoted: number;
      alreadyQueued: number;
      missingHandles: string[];
    };

/**
 * Botão @bruno: sorteia o lado (A/B) de cada um dos 22 usuários para cada
 * jogo "LIVE" da Copa ativa e enfileira em CopaAutoVoteQueue os pares
 * (fixture, usuário) que ainda não votaram nem estão na fila. Não vota na
 * hora — o cron drena a fila 1 item a cada 10 minutos.
 */
export async function enqueueBrunoAutoVotes(): Promise<EnqueueBrunoAutoVoteResult> {
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

  const users = await prisma.user.findMany({
    where: { handle: { in: AUTO_VOTE_HANDLES } },
    select: { id: true, handle: true },
  });
  const missingHandles = AUTO_VOTE_HANDLES.filter((h) => !users.some((u) => u.handle.toLowerCase() === h.toLowerCase()));

  const fixtureIds = fixtures.map((f) => f.id);
  const userIds = users.map((u) => u.id);

  const [existingVotes, existingQueue] = await Promise.all([
    prisma.copaVote.findMany({
      where: { fixtureId: { in: fixtureIds }, userId: { in: userIds } },
      select: { fixtureId: true, userId: true },
    }),
    prisma.copaAutoVoteQueue.findMany({
      where: { fixtureId: { in: fixtureIds }, userId: { in: userIds } },
      select: { fixtureId: true, userId: true },
    }),
  ]);
  const doneKey = (fixtureId: string, userId: string) => `${fixtureId}|${userId}`;
  const alreadyVotedKeys = new Set(existingVotes.map((v) => doneKey(v.fixtureId, v.userId)));
  const alreadyQueuedKeys = new Set(existingQueue.map((v) => doneKey(v.fixtureId, v.userId)));

  const toQueue: Array<{ fixtureId: string; userId: string; side: "A" | "B" }> = [];
  let alreadyVoted = 0;
  let alreadyQueued = 0;
  for (const user of users) {
    for (const f of fixtures) {
      const key = doneKey(f.id, user.id);
      if (alreadyVotedKeys.has(key)) {
        alreadyVoted++;
        continue;
      }
      if (alreadyQueuedKeys.has(key)) {
        alreadyQueued++;
        continue;
      }
      toQueue.push({ fixtureId: f.id, userId: user.id, side: randomSide() });
    }
  }

  if (toQueue.length) {
    await prisma.copaAutoVoteQueue.createMany({ data: toQueue });
  }

  return {
    ok: true,
    copaId: copa.id,
    fixturesOpen: fixtures.length,
    usersConsidered: users.length,
    queued: toQueue.length,
    alreadyVoted,
    alreadyQueued,
    missingHandles,
  };
}

export type DripBrunoAutoVoteResult =
  | { ok: true; voted: false; reason: "queue_empty" }
  | { ok: true; voted: true; fixtureId: string; userId: string; side: "A" | "B"; alreadyVoted: boolean; remaining: number };

/**
 * Cron (a cada 10 min): tira o item mais antigo da fila e registra o voto de
 * verdade (CopaVote). Se o par já tiver voto (ex.: usuário votou manualmente
 * nesse meio-tempo), só descarta o item da fila sem erro.
 */
export async function dripBrunoAutoVote(): Promise<DripBrunoAutoVoteResult> {
  const next = await prisma.copaAutoVoteQueue.findFirst({ orderBy: { createdAt: "asc" } });
  if (!next) return { ok: true, voted: false, reason: "queue_empty" };

  let alreadyVoted = false;
  try {
    await prisma.copaVote.create({ data: { fixtureId: next.fixtureId, userId: next.userId, side: next.side } });
  } catch {
    alreadyVoted = true;
  }

  await prisma.copaAutoVoteQueue.delete({ where: { id: next.id } });
  const remaining = await prisma.copaAutoVoteQueue.count();

  return { ok: true, voted: true, fixtureId: next.fixtureId, userId: next.userId, side: next.side as "A" | "B", alreadyVoted, remaining };
}

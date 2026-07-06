import { Prisma, type CopaPhase } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { COPA_GROUP_LETTERS, R16_FROM_R32_PAIRING, computeStandings, fixtureBatchOrder, resolveKnockoutWinner } from "@/lib/copa";



// Pontos no Global 100 (snapshot congelado mais recente) por Song.id. Música

// fora do top 100 conta 0 — é o que o critério de pênaltis precisa.

async function globalPointsBySongId(songIds: string[]): Promise<Map<string, number>> {

  const ids = [...new Set(songIds.filter(Boolean))];

  const map = new Map<string, number>();

  if (ids.length === 0) return map;



  const snapshot = await prisma.globalSnapshot.findFirst({

    orderBy: { weekIndex: "desc" },

    select: { overallSongs: true },

  });

  if (!snapshot) return map;



  const entries = (snapshot.overallSongs as Array<{ song?: { id?: string }; points?: number }>) ?? [];

  for (const e of entries) {

    const id = e?.song?.id;

    if (id && ids.includes(id)) map.set(id, e.points ?? 0);

  }

  return map;

}



type PhaseResult = { matchIndex: number; winnerId: string; loserId: string };



function winnerMapFromPhase(results: PhaseResult[]): Map<number, string> {

  return new Map(results.map((r) => [r.matchIndex, r.winnerId]));

}



function buildRoundFixtures(

  copaId: string,

  phase: CopaPhase,

  winnerByMatchIndex: Map<number, string>,

  pairing: ReadonlyArray<readonly [number, number]>,

  singleIdx: number,

): Prisma.CopaFixtureCreateManyInput[] {

  const data: Prisma.CopaFixtureCreateManyInput[] = [];

  pairing.forEach(([idxA, idxB], matchIndex) => {

    const artistAId = winnerByMatchIndex.get(idxA);

    const artistBId = winnerByMatchIndex.get(idxB);

    if (!artistAId || !artistBId) return;

    data.push({

      copaId,

      phase,

      matchIndex,

      artistAId,

      artistBId,

      singleAIdx: singleIdx,

      singleBIdx: singleIdx,

    });

  });

  return data;

}



/** Q1×Q2, Q3×Q4 … a partir de vencedores consecutivos (O1, O2, …). */

function consecutivePairing(matchCount: number): Array<[number, number]> {

  const pairs: Array<[number, number]> = [];

  for (let i = 0; i + 1 < matchCount; i += 2) pairs.push([i, i + 1]);

  return pairs;

}



// Resolve vencedores/perdedores de uma fase eliminatória 100% encerrada.

// Retorna null se a fase não existe ou ainda tem jogo em aberto.

async function resolvePhase(copaId: string, phase: CopaPhase): Promise<PhaseResult[] | null> {

  const fixtures = await prisma.copaFixture.findMany({

    where: { copaId, phase },

    include: { votes: true },

    orderBy: { matchIndex: "asc" },

  });

  if (fixtures.length === 0 || !fixtures.every((f) => f.status === "DONE")) return null;

  const copa = await prisma.copaEdition.findUnique({
    where: { id: copaId },
    select: { votesPerGoal: true },
  });
  const votesPerGoal = copa?.votesPerGoal ?? 2;

  // Song.id da música em disputa de cada lado (para o desempate do Global 100).

  const singleKeys = fixtures.flatMap((f) => [

    { copaArtistId: f.artistAId, slotIndex: f.singleAIdx },

    { copaArtistId: f.artistBId, slotIndex: f.singleBIdx },

  ]);

  const singles = await prisma.copaSingle.findMany({

    where: { OR: singleKeys },

    select: { copaArtistId: true, slotIndex: true, songId: true },

  });

  const songIdByKey = new Map<string, string | null>();

  for (const s of singles) songIdByKey.set(`${s.copaArtistId}:${s.slotIndex}`, s.songId);

  const points = await globalPointsBySongId(

    singles.map((s) => s.songId).filter((x): x is string => !!x),

  );



  return fixtures.map((f) => {

    const votesA = f.votes.filter((v) => v.side === "A").length;

    const votesB = f.votes.filter((v) => v.side === "B").length;

    const songA = songIdByKey.get(`${f.artistAId}:${f.singleAIdx}`) ?? null;

    const songB = songIdByKey.get(`${f.artistBId}:${f.singleBIdx}`) ?? null;

    const { winner } = resolveKnockoutWinner({

      votesA,

      votesB,

      globalPointsA: songA ? points.get(songA) ?? 0 : 0,

      globalPointsB: songB ? points.get(songB) ?? 0 : 0,

      votesPerGoal,

    });

    return {

      matchIndex: f.matchIndex,

      winnerId: winner === "A" ? f.artistAId : f.artistBId,

      loserId: winner === "A" ? f.artistBId : f.artistAId,

    };

  });

}



// 1/16 de final (32 avos): 1º×2º entre grupos pareados — A×B, C×D, … O×P (16 jogos).

export async function maybeGenerateR32Only(copaId: string): Promise<void> {

  if ((await prisma.copaFixture.count({ where: { copaId, phase: "R32" } })) > 0) return;



  const groupFixtures = await prisma.copaFixture.findMany({

    where: { copaId, phase: "GROUP" },

    include: { votes: true },

  });

  if (groupFixtures.length === 0 || !groupFixtures.every((f) => f.status === "DONE")) return;

  const copa = await prisma.copaEdition.findUnique({
    where: { id: copaId },
    select: { votesPerGoal: true },
  });
  const votesPerGoal = copa?.votesPerGoal ?? 2;

  const artists = await prisma.copaArtist.findMany({ where: { copaId } });

  const topByGroup: Record<string, { first: string; second: string }> = {};

  for (const letter of COPA_GROUP_LETTERS) {

    const ids = artists.filter((a) => a.groupLetter === letter).map((a) => a.id);

    if (ids.length < 4) continue;

    const standings = computeStandings(groupFixtures.filter((f) => f.groupLetter === letter), ids, votesPerGoal);

    if (standings.length < 2) continue;

    topByGroup[letter] = { first: standings[0].artistId, second: standings[1].artistId };

  }



  const data: Prisma.CopaFixtureCreateManyInput[] = [];

  for (let i = 0; i < COPA_GROUP_LETTERS.length; i += 2) {

    const l1 = COPA_GROUP_LETTERS[i];

    const l2 = COPA_GROUP_LETTERS[i + 1];

    const t1 = topByGroup[l1];

    const t2 = topByGroup[l2];

    if (!t1 || !t2) continue;

    data.push(

      {

        copaId,

        phase: "R32",

        matchIndex: i,

        artistAId: t1.first,

        artistBId: t2.second,

        singleAIdx: 3,

        singleBIdx: 3,

      },

      {

        copaId,

        phase: "R32",

        matchIndex: i + 1,

        artistAId: t2.first,

        artistBId: t1.second,

        singleAIdx: 3,

        singleBIdx: 3,

      },

    );

  }

  if (data.length === 0) return;



  await prisma.$transaction([

    prisma.copaFixture.createMany({ data }),

    prisma.copaEdition.update({ where: { id: copaId }, data: { status: "KNOCKOUT" } }),

  ]);

}



const KNOCKOUT_FROM_R16 = ["R16", "QF", "SF", "FINAL", "THIRD_PLACE"] as const;

async function assertR32Complete(copaId: string): Promise<void> {
  const r32Total = await prisma.copaFixture.count({ where: { copaId, phase: "R32" } });
  const r32Done = await prisma.copaFixture.count({ where: { copaId, phase: "R32", status: "DONE" } });
  if (r32Total === 0 || r32Done < r32Total) {
    throw new Error("O 1/16 de Final (R32) precisa estar 100% encerrado.");
  }
}

/** IDs dos 16 classificados (vencedores do R32). Null se a fase não estiver encerrada. */
export async function getR32WinnerArtistIds(copaId: string): Promise<string[] | null> {
  const results = await resolvePhase(copaId, "R32");
  if (!results || results.length < 16) return null;
  return results.map((r) => r.winnerId);
}

/**
 * Apaga oitavas e fases seguintes (votos em cascade). Use antes de reabrir edição.
 */
export async function deleteKnockoutFromR16(copaId: string): Promise<{ deletedFixtures: number; deletedVotes: number }> {
  const fixtures = await prisma.copaFixture.findMany({
    where: { copaId, phase: { in: [...KNOCKOUT_FROM_R16] } },
    select: { id: true },
  });
  if (fixtures.length === 0) return { deletedFixtures: 0, deletedVotes: 0 };

  const ids = fixtures.map((f) => f.id);
  const deletedVotes = await prisma.copaVote.count({ where: { fixtureId: { in: ids } } });
  const deleted = await prisma.copaFixture.deleteMany({ where: { id: { in: ids } } });
  return { deletedFixtures: deleted.count, deletedVotes };
}

// Oitavas (8 jogos): O1 = J1×J3, O2 = J2×J4, … (J = vencedor do R32 matchIndex 0..15).

export async function generateR16FromR32(copaId: string): Promise<number> {
  if ((await prisma.copaFixture.count({ where: { copaId, phase: "R16" } })) > 0) {
    throw new Error("Já existem jogos de oitavas. Apague-as antes de gerar de novo.");
  }

  await assertR32Complete(copaId);

  const results = await resolvePhase(copaId, "R32");
  if (!results || results.length < 16) {
    throw new Error("Não foi possível resolver os 16 vencedores do 1/16 de Final.");
  }

  const data = buildRoundFixtures(copaId, "R16", winnerMapFromPhase(results), R16_FROM_R32_PAIRING, 4);
  if (data.length !== 8) {
    throw new Error(`Esperados 8 jogos de oitavas, obtidos ${data.length}. Verifique o chaveamento R32.`);
  }

  await prisma.copaFixture.createMany({ data });
  return data.length;
}

async function maybeGenerateR16FromR32(copaId: string): Promise<void> {
  if ((await prisma.copaFixture.count({ where: { copaId, phase: "R16" } })) > 0) return;

  const r32Total = await prisma.copaFixture.count({ where: { copaId, phase: "R32" } });
  const r32Done = await prisma.copaFixture.count({ where: { copaId, phase: "R32", status: "DONE" } });
  if (r32Total === 0 || r32Done < r32Total) return;

  const results = await resolvePhase(copaId, "R32");
  if (!results || results.length < 16) return;

  const data = buildRoundFixtures(copaId, "R16", winnerMapFromPhase(results), R16_FROM_R32_PAIRING, 4);
  if (data.length === 8) await prisma.copaFixture.createMany({ data });
}



// Próxima rodada (R16→QF, QF→SF): vencedor O1×O2, O3×O4 … / Q1×Q2, Q3×Q4 …

async function maybeGenerateRound(copaId: string, from: CopaPhase, to: CopaPhase, singleIdx: number): Promise<void> {

  if ((await prisma.copaFixture.count({ where: { copaId, phase: to } })) > 0) return;

  const results = await resolvePhase(copaId, from);

  if (!results) return;



  const pairing = consecutivePairing(results.length);

  const data = buildRoundFixtures(copaId, to, winnerMapFromPhase(results), pairing, singleIdx);

  if (data.length > 0) await prisma.copaFixture.createMany({ data });

}



// Final + Disputa de 3º lugar a partir das 2 semifinais: vencedores → Final,

// perdedores → 3º lugar.

async function maybeGenerateFinal(copaId: string): Promise<void> {

  const exists = await prisma.copaFixture.count({

    where: { copaId, phase: { in: ["FINAL", "THIRD_PLACE"] } },

  });

  if (exists > 0) return;



  const results = await resolvePhase(copaId, "SF");

  if (!results || results.length < 2) return;

  const winnerByIdx = winnerMapFromPhase(results);

  const s1Winner = winnerByIdx.get(0);

  const s2Winner = winnerByIdx.get(1);

  if (!s1Winner || !s2Winner) return;



  const s1 = results.find((r) => r.matchIndex === 0);

  const s2 = results.find((r) => r.matchIndex === 1);

  if (!s1 || !s2) return;



  await prisma.copaFixture.createMany({

    data: [

      { copaId, phase: "FINAL", matchIndex: 0, artistAId: s1Winner, artistBId: s2Winner, singleAIdx: 7, singleBIdx: 7 },

      { copaId, phase: "THIRD_PLACE", matchIndex: 0, artistAId: s1.loserId, artistBId: s2.loserId, singleAIdx: 7, singleBIdx: 7 },

    ],

  });

}



// Avança o chaveamento sempre que possível. Idempotente — pode ser chamado após

// qualquer jogo ser encerrado (grupos → R32 → R16 → QF → SF → Final/3º lugar).

export async function advanceKnockout(copaId: string): Promise<void> {
  await removePrematureKnockoutFixtures(copaId);
  await maybeGenerateR32Only(copaId);
  await maybeGenerateR16FromR32(copaId);

  await maybeGenerateRound(copaId, "R16", "QF", 5);

  await maybeGenerateRound(copaId, "QF", "SF", 6);

  await maybeGenerateFinal(copaId);
}

/**
 * Remove oitavas/quartas/semis/final criadas antes do 1/16 de final (R32) encerrar.
 * Nunca apaga jogos que já têm votos — evita perda irreversível de placares.
 */
export async function removePrematureKnockoutFixtures(
  copaId: string,
  opts?: { force?: boolean },
): Promise<number> {
  const r32Total = await prisma.copaFixture.count({ where: { copaId, phase: "R32" } });
  if (r32Total === 0) return 0;

  const r32Done = await prisma.copaFixture.count({ where: { copaId, phase: "R32", status: "DONE" } });
  if (r32Done >= r32Total) return 0;

  const premature = await prisma.copaFixture.findMany({
    where: { copaId, phase: { in: ["R16", "QF", "SF", "FINAL", "THIRD_PLACE"] } },
    select: { id: true },
  });
  if (premature.length === 0) return 0;

  const ids = premature.map((f) => f.id);
  const voteCount = await prisma.copaVote.count({ where: { fixtureId: { in: ids } } });
  if (voteCount > 0 && !opts?.force) {
    throw new Error(
      `Há ${voteCount} voto(s) em ${premature.length} jogo(s) fora de ordem. ` +
        `Não apagamos automaticamente para não perder placares. ` +
        `Encerre os jogos no admin ou restaure um backup do banco.`,
    );
  }

  await prisma.copaFixture.deleteMany({ where: { id: { in: ids } } });
  return premature.length;
}

/**
 * 1/16 de final tem 2 rodadas (8 jogos cada). A 2ª só abre após a 1ª encerrar (Avançar Dia).
 * Corrige se a 2ª rodada ficou LIVE antes da hora.
 */
export async function ensureR32SecondBatchClosed(copaId: string): Promise<number> {
  const r32 = await prisma.copaFixture.findMany({
    where: { copaId, phase: "R32" },
    select: { id: true, phase: true, matchIndex: true, status: true, round: true, groupLetter: true },
  });
  if (r32.length === 0) return 0;

  const firstBatch = r32.filter((f) => fixtureBatchOrder(f) === 6);
  const firstBatchDone = firstBatch.length > 0 && firstBatch.every((f) => f.status === "DONE");
  if (firstBatchDone) return 0;

  const secondBatchLive = r32.filter((f) => fixtureBatchOrder(f) === 7 && f.status === "LIVE");
  if (secondBatchLive.length === 0) return 0;

  await prisma.copaFixture.updateMany({
    where: { id: { in: secondBatchLive.map((f) => f.id) } },
    data: { status: "UPCOMING", endedAt: null },
  });
  return secondBatchLive.length;
}


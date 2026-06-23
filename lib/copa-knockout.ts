import { Prisma, type CopaPhase } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { COPA_GROUP_LETTERS, computeStandings, resolveKnockoutWinner } from "@/lib/copa";

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

// Resolve vencedores/perdedores de uma fase eliminatória 100% encerrada.
// Retorna null se a fase não existe ou ainda tem jogo em aberto.
async function resolvePhase(copaId: string, phase: CopaPhase): Promise<PhaseResult[] | null> {
  const fixtures = await prisma.copaFixture.findMany({
    where: { copaId, phase },
    include: { votes: true },
    orderBy: { matchIndex: "asc" },
  });
  if (fixtures.length === 0 || !fixtures.every((f) => f.status === "DONE")) return null;

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
    });
    return {
      matchIndex: f.matchIndex,
      winnerId: winner === "A" ? f.artistAId : f.artistBId,
      loserId: winner === "A" ? f.artistBId : f.artistAId,
    };
  });
}

// Oitavas (R16) a partir do 1º colocado de cada grupo: A×B, C×D, … O×P (8 jogos).
async function maybeGenerateR16(copaId: string): Promise<void> {
  if ((await prisma.copaFixture.count({ where: { copaId, phase: "R16" } })) > 0) return;

  const groupFixtures = await prisma.copaFixture.findMany({
    where: { copaId, phase: "GROUP" },
    include: { votes: true },
  });
  if (groupFixtures.length === 0 || !groupFixtures.every((f) => f.status === "DONE")) return;

  const artists = await prisma.copaArtist.findMany({ where: { copaId } });
  const winnerByGroup: Record<string, string> = {};
  for (const letter of COPA_GROUP_LETTERS) {
    const ids = artists.filter((a) => a.groupLetter === letter).map((a) => a.id);
    if (ids.length < 4) continue;
    const standings = computeStandings(groupFixtures.filter((f) => f.groupLetter === letter), ids);
    winnerByGroup[letter] = standings[0].artistId;
  }

  const data: Prisma.CopaFixtureCreateManyInput[] = [];
  for (let i = 0; i < COPA_GROUP_LETTERS.length; i += 2) {
    const l1 = COPA_GROUP_LETTERS[i];
    const l2 = COPA_GROUP_LETTERS[i + 1];
    if (!winnerByGroup[l1] || !winnerByGroup[l2]) continue;
    data.push({
      copaId,
      phase: "R16",
      matchIndex: i / 2,
      artistAId: winnerByGroup[l1],
      artistBId: winnerByGroup[l2],
      singleAIdx: 3,
      singleBIdx: 3,
    });
  }
  if (data.length === 0) return;

  await prisma.$transaction([
    prisma.copaFixture.createMany({ data }),
    prisma.copaEdition.update({ where: { id: copaId }, data: { status: "KNOCKOUT" } }),
  ]);
}

// Próxima rodada simples (R16→QF, QF→SF): pareia vencedores consecutivos.
async function maybeGenerateRound(copaId: string, from: CopaPhase, to: CopaPhase, singleIdx: number): Promise<void> {
  if ((await prisma.copaFixture.count({ where: { copaId, phase: to } })) > 0) return;
  const results = await resolvePhase(copaId, from);
  if (!results) return;

  const winners = results.map((r) => r.winnerId);
  const data: Prisma.CopaFixtureCreateManyInput[] = [];
  for (let i = 0; i + 1 < winners.length; i += 2) {
    data.push({
      copaId,
      phase: to,
      matchIndex: i / 2,
      artistAId: winners[i],
      artistBId: winners[i + 1],
      singleAIdx: singleIdx,
      singleBIdx: singleIdx,
    });
  }
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
  const [s1, s2] = results;

  await prisma.copaFixture.createMany({
    data: [
      { copaId, phase: "FINAL", matchIndex: 0, artistAId: s1.winnerId, artistBId: s2.winnerId, singleAIdx: 6, singleBIdx: 6 },
      { copaId, phase: "THIRD_PLACE", matchIndex: 0, artistAId: s1.loserId, artistBId: s2.loserId, singleAIdx: 6, singleBIdx: 6 },
    ],
  });
}

// Avança o chaveamento sempre que possível. Idempotente — pode ser chamado após
// qualquer jogo ser encerrado (grupos → R16 → QF → SF → Final/3º lugar).
export async function advanceKnockout(copaId: string): Promise<void> {
  await maybeGenerateR16(copaId);
  await maybeGenerateRound(copaId, "R16", "QF", 4);
  await maybeGenerateRound(copaId, "QF", "SF", 5);
  await maybeGenerateFinal(copaId);
}

import { prisma } from "@/lib/prisma";
import { COPA_UNASSIGNED_GROUP, songPickKey } from "@/lib/copa";
import { maybeGenerateR32Only, removePrematureKnockoutFixtures, ensureR32SecondBatchClosed } from "@/lib/copa-knockout";
import { openNextBatch } from "@/lib/copa-day";

const DELETABLE_KNOCKOUT = ["R32", "QF", "SF", "FINAL", "THIRD_PLACE"] as const;

const groupStageWhere = (copaId: string) => ({
  copaId,
  groupLetter: { not: null, notIn: [COPA_UNASSIGNED_GROUP] },
  round: { in: [1, 2, 3] },
});

export type RepairCopaKnockoutResult = {
  copaId: string;
  copaName: string;
  fixedGroupPhases: number;
  migratedR16Fixtures: number;
  revertedLiveR16Fixtures: number;
  removedPrematureFixtures: number;
  openedLiveFixtures: number;
  deletedKnockoutFixtures: number;
  preservedR16Fixtures: number;
  groupFixturesDone: number;
  r32Fixtures: number;
  r16Fixtures: number;
};

/**
 * Jogos de grupos têm group_letter + round 1–3. Se phase veio como R16 (ou outra),
 * corrige para GROUP.
 */
export async function fixMislabeledGroupFixtures(copaId: string): Promise<number> {
  const mislabeled = await prisma.copaFixture.findMany({
    where: {
      ...groupStageWhere(copaId),
      NOT: { phase: "GROUP" },
    },
    select: { id: true },
  });

  if (mislabeled.length === 0) return 0;

  await prisma.copaFixture.updateMany({
    where: { id: { in: mislabeled.map((f) => f.id) } },
    data: { phase: "GROUP" },
  });

  return mislabeled.length;
}

/**
 * Oitavas antigas usavam single idx 3; na estrutura nova idx 3 = R32 e idx 4 = oitavas.
 * Copia slot 3 → 4 só para artistas sem slot 4 definido; fixtures LIVE/DONE mantêm idx 3.
 */
export async function migrateLegacyR16SingleSlots(copaId: string): Promise<number> {
  const r16Fixtures = await prisma.copaFixture.findMany({
    where: {
      copaId,
      phase: "R16",
      OR: [{ singleAIdx: 3 }, { singleBIdx: 3 }],
    },
  });
  if (r16Fixtures.length === 0) return 0;

  const artistIds = new Set<string>();
  for (const f of r16Fixtures) {
    artistIds.add(f.artistAId);
    artistIds.add(f.artistBId);
  }

  for (const artistId of artistIds) {
    const singles = await prisma.copaSingle.findMany({ where: { copaArtistId: artistId } });
    const slot3 = singles.find((s) => s.slotIndex === 3);
    const slot4 = singles.find((s) => s.slotIndex === 4);
    const slot4Empty = !slot4 || slot4.songName.startsWith("Single ");
    if (slot3 && slot4Empty) {
      await prisma.copaSingle.upsert({
        where: { copaArtistId_slotIndex: { copaArtistId: artistId, slotIndex: 4 } },
        create: {
          copaArtistId: artistId,
          slotIndex: 4,
          songName: slot3.songName,
          songId: slot3.songId,
        },
        update: { songName: slot3.songName, songId: slot3.songId },
      });
    }
  }

  // Só fixtures ainda não iniciados passam a usar slot 4; LIVE/DONE mantêm idx 3 (música congelada).
  await prisma.copaFixture.updateMany({
    where: {
      copaId,
      phase: "R16",
      status: "UPCOMING",
      OR: [{ singleAIdx: 3 }, { singleBIdx: 3 }],
    },
    data: { singleAIdx: 4, singleBIdx: 4 },
  });

  return r16Fixtures.length;
}

/**
 * Corrige oitavas LIVE/DONE migradas indevidamente para slot 4 quando já tinham slot 4
 * com música diferente da disputada (idx 3).
 */
export async function revertLiveR16SingleIndices(copaId: string): Promise<number> {
  const affected = await prisma.copaFixture.findMany({
    where: {
      copaId,
      phase: "R16",
      status: { in: ["LIVE", "DONE"] },
      singleAIdx: 4,
      singleBIdx: 4,
    },
    include: {
      artistA: { include: { singles: true } },
      artistB: { include: { singles: true } },
    },
  });

  let reverted = 0;
  for (const f of affected) {
    const songA3 = f.artistA.singles.find((s) => s.slotIndex === 3);
    const songA4 = f.artistA.singles.find((s) => s.slotIndex === 4);
    const songB3 = f.artistB.singles.find((s) => s.slotIndex === 3);
    const songB4 = f.artistB.singles.find((s) => s.slotIndex === 4);

    const aDiffers =
      songA3 &&
      songA4 &&
      !songA4.songName.startsWith("Single ") &&
      songPickKey(songA3.songId, songA3.songName) !== songPickKey(songA4.songId, songA4.songName);
    const bDiffers =
      songB3 &&
      songB4 &&
      !songB4.songName.startsWith("Single ") &&
      songPickKey(songB3.songId, songB3.songName) !== songPickKey(songB4.songId, songB4.songName);

    if (aDiffers || bDiffers) {
      await prisma.copaFixture.update({
        where: { id: f.id },
        data: { singleAIdx: 3, singleBIdx: 3 },
      });
      reverted++;
    }
  }

  return reverted;
}

/** Alinha fase ao vivo: remove mata-mata prematuro; abre só o lote correto do 1/16 (8 jogos). */
export async function realignCopaLivePhase(copaId: string): Promise<{
  removedPrematureFixtures: number;
  openedLiveFixtures: number;
  closedPrematureR32Batch: number;
}> {
  const removedPrematureFixtures = await removePrematureKnockoutFixtures(copaId);
  const closedPrematureR32Batch = await ensureR32SecondBatchClosed(copaId);

  const hasLive = await prisma.copaFixture.count({ where: { copaId, status: "LIVE" } });
  const openedLiveFixtures = hasLive > 0 ? 0 : await openNextBatch(copaId);

  return { removedPrematureFixtures, openedLiveFixtures, closedPrematureR32Batch };
}

/**
 * Insere a fase R32 (32 avos) sem apagar oitavas já em andamento.
 * Mantém jogos R16 existentes com placares/votos; recria só R32 se faltando.
 */
export async function repairCopaKnockout(copaId: string): Promise<RepairCopaKnockoutResult> {
  const copa = await prisma.copaEdition.findUnique({ where: { id: copaId } });
  if (!copa) throw new Error("Copa não encontrada.");

  const fixedGroupPhases = await fixMislabeledGroupFixtures(copaId);

  const groupFixtures = await prisma.copaFixture.findMany({
    where: groupStageWhere(copaId),
    select: { status: true },
  });
  if (groupFixtures.length === 0) {
    throw new Error("Esta copa não tem jogos de grupos (group_letter + round).");
  }
  const pendingGroups = groupFixtures.filter((f) => f.status !== "DONE").length;
  if (pendingGroups > 0) {
    throw new Error(`Ainda há ${pendingGroups} jogo(s) de grupos em aberto. Encerre todos antes de reparar.`);
  }

  const preservedR16 = await prisma.copaFixture.count({ where: { copaId, phase: "R16" } });
  const migratedR16Fixtures = await migrateLegacyR16SingleSlots(copaId);
  const revertedLiveR16 = await revertLiveR16SingleIndices(copaId);

  const deleted = await prisma.copaFixture.deleteMany({
    where: { copaId, phase: { in: [...DELETABLE_KNOCKOUT] } },
  });

  await prisma.copaEdition.update({
    where: { id: copaId },
    data: { status: "KNOCKOUT" },
  });

  await maybeGenerateR32Only(copaId);
  const removedPremature = await removePrematureKnockoutFixtures(copaId);

  const [r32, r16] = await Promise.all([
    prisma.copaFixture.count({ where: { copaId, phase: "R32" } }),
    prisma.copaFixture.count({ where: { copaId, phase: "R16" } }),
  ]);

  if (r32 === 0) {
    throw new Error(
      "Não foi possível gerar os jogos de 1/16 de final. Verifique 16 grupos completos e se a migration R32 foi aplicada.",
    );
  }

  return {
    copaId,
    copaName: `${copa.name} ${copa.year}`,
    fixedGroupPhases,
    migratedR16Fixtures,
    revertedLiveR16Fixtures: revertedLiveR16,
    removedPrematureFixtures: removedPremature,
    openedLiveFixtures: 0,
    deletedKnockoutFixtures: deleted.count,
    preservedR16Fixtures: r16,
    groupFixturesDone: groupFixtures.length,
    r32Fixtures: r32,
    r16Fixtures: r16,
  };
}

import { prisma } from "@/lib/prisma";
import { fixtureBatchOrder } from "@/lib/copa";
import { advanceKnockout } from "@/lib/copa-knockout";

const DAY_MS = 86_400_000;

// Índice do dia da Copa (0 = primeiro dia) a partir de startsAt. A hora de
// startsAt define o horário de virada diário (o "horário dos jogos").
export function copaDayIndex(startsAt: Date, now: Date): number {
  return Math.floor((now.getTime() - startsAt.getTime()) / DAY_MS);
}

// Reconcilia o estado dos jogos com o calendário: no dia N, o lote batchOrder N
// fica LIVE, os anteriores DONE e os seguintes UPCOMING. Idempotente e
// auto-corretivo — pode rodar de hora em hora (cron) sem efeito colateral.
export async function syncCopaToSchedule(
  copaId: string,
  now: Date = new Date(),
): Promise<{ dayIndex: number; opened: number; closed: number } | null> {
  const copa = await prisma.copaEdition.findUnique({
    where: { id: copaId },
    select: { startsAt: true, status: true },
  });
  if (!copa?.startsAt) return null;
  if (copa.status !== "GROUP_STAGE" && copa.status !== "KNOCKOUT") return null;

  const dayIndex = copaDayIndex(copa.startsAt, now);
  if (dayIndex < 0) return { dayIndex, opened: 0, closed: 0 }; // ainda não começou

  // 1) Encerra os lotes de dias já passados que ainda não terminaram.
  const all = await prisma.copaFixture.findMany({
    where: { copaId },
    select: { id: true, phase: true, round: true, groupLetter: true, status: true },
  });
  const toClose = all.filter((f) => fixtureBatchOrder(f) < dayIndex && f.status !== "DONE");
  if (toClose.length > 0) {
    await prisma.copaFixture.updateMany({
      where: { id: { in: toClose.map((f) => f.id) } },
      data: { status: "DONE", endedAt: now },
    });
    // Gera as fases seguintes conforme grupos/rodadas terminam.
    await advanceKnockout(copaId);
  }

  // 2) Abre o lote do dia atual (refetch: advanceKnockout pode ter criado jogos).
  const upcoming = await prisma.copaFixture.findMany({
    where: { copaId, status: "UPCOMING" },
    select: { id: true, phase: true, round: true, groupLetter: true },
  });
  const toOpen = upcoming.filter((f) => fixtureBatchOrder(f) === dayIndex);
  if (toOpen.length > 0) {
    await prisma.copaFixture.updateMany({
      where: { id: { in: toOpen.map((f) => f.id) } },
      data: { status: "LIVE" },
    });
  }

  return { dayIndex, opened: toOpen.length, closed: toClose.length };
}

// Abre o próximo "lote do dia": os jogos UPCOMING com o menor batchOrder viram
// LIVE. Retorna quantos foram abertos (0 = não há mais lotes pendentes).
export async function openNextBatch(copaId: string): Promise<number> {
  const upcoming = await prisma.copaFixture.findMany({
    where: { copaId, status: "UPCOMING" },
    select: { id: true, phase: true, round: true, groupLetter: true },
  });
  if (upcoming.length === 0) return 0;

  const minOrder = Math.min(...upcoming.map((f) => fixtureBatchOrder(f)));
  const batch = upcoming.filter((f) => fixtureBatchOrder(f) === minOrder);
  await prisma.copaFixture.updateMany({
    where: { id: { in: batch.map((f) => f.id) } },
    data: { status: "LIVE" },
  });
  return batch.length;
}

// Avança um dia da Copa: encerra o lote Ao vivo (fecha a votação), avança o
// chaveamento se a fase acabou e abre o próximo lote. Usado tanto pelo botão
// Avançar Dia do admin quanto pelo cron diário (no prazo de votação).
export async function advanceCopaDay(copaId: string): Promise<{ closed: number; opened: number }> {
  const live = await prisma.copaFixture.findMany({
    where: { copaId, status: "LIVE" },
    select: { id: true },
  });
  if (live.length > 0) {
    await prisma.copaFixture.updateMany({
      where: { copaId, status: "LIVE" },
      data: { status: "DONE", endedAt: new Date() },
    });
    await advanceKnockout(copaId);
  }
  const opened = await openNextBatch(copaId);
  return { closed: live.length, opened };
}

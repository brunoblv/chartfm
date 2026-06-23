import { prisma } from "@/lib/prisma";
import { fixtureBatchOrder } from "@/lib/copa";
import { advanceKnockout } from "@/lib/copa-knockout";

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

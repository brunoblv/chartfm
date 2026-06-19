import { prisma } from "@/lib/prisma";
import { MYTRL_OWNER_HANDLE, MYTRL_WEEKLY_PARADA_ID } from "@/lib/mytrl-access";

export type ClearMyTrlResult = {
  snapshots: number;
  weeklyCharts: number;
};

/** Apaga todos os snapshots MyTRL e paradas semanais publicadas pelo MyTRL (@bruno). */
export async function clearAllMyTrlData(): Promise<ClearMyTrlResult> {
  let weeklyCharts = 0;

  const parada = await prisma.parada.findUnique({
    where: { id: MYTRL_WEEKLY_PARADA_ID },
    include: { user: { select: { handle: true } } },
  });

  if (parada?.user.handle === MYTRL_OWNER_HANDLE) {
    const deleted = await prisma.chart.deleteMany({ where: { paradaId: MYTRL_WEEKLY_PARADA_ID } });
    weeklyCharts = deleted.count;
  }

  const deletedSnapshots = await prisma.myTrlSnapshot.deleteMany({});

  return {
    snapshots: deletedSnapshots.count,
    weeklyCharts,
  };
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { Shell } from "@/components/layout/Shell";
import {
  buildWeekLabelFromDate,
  getRankingWeekReference,
  getWeeklySnapshotReferenceDate,
} from "@/lib/chart-week";
import { WeeklyEditorialClient } from "./WeeklyEditorialClient";

async function getLatestAvailableWeekIndex(maxWeekIndex: number): Promise<number | null> {
  const row = await prisma.globalSnapshot.findFirst({
    where: { weekIndex: { lte: maxWeekIndex } },
    orderBy: { weekIndex: "desc" },
    select: { weekIndex: true },
  });
  return row?.weekIndex ?? null;
}

export default async function AdminWeeklyEditorialPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return (
      <Shell title="Admin" subtitle="Editorial semanal">
        <div>Faça login para acessar.</div>
      </Shell>
    );
  }
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) {
    return (
      <Shell title="Admin" subtitle="Editorial semanal">
        <div>Acesso negado.</div>
      </Shell>
    );
  }

  const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const rankingWeek = getRankingWeekReference(nowBRT);
  const weekIndex = (await getLatestAvailableWeekIndex(rankingWeek.weekIndex)) ?? rankingWeek.weekIndex;
  const weekRefDate = getWeeklySnapshotReferenceDate(weekIndex);
  const weekLabel = buildWeekLabelFromDate(weekRefDate);

  const stored = await prisma.weeklyEditorial.findUnique({
    where: { weekIndex },
    select: { body: true },
  });

  return (
    <Shell title="Admin" subtitle="Editorial semanal da landing">
      <WeeklyEditorialClient
        weekIndex={weekIndex}
        weekLabel={weekLabel}
        initialBody={stored?.body ?? ""}
      />
    </Shell>
  );
}

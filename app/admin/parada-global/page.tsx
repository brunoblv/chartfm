import { Shell } from "@/components/layout/Shell";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { getEventSchedules } from "@/lib/social/event-schedule";
import { getRankingWeekReference, getGlobalSnapshotDeadline } from "@/lib/chart-week";
import { prisma } from "@/lib/prisma";
import { SocialEventType } from "@prisma/client";
import ParadaGlobalClient from "./ParadaGlobalClient";

export const dynamic = "force-dynamic";

export default async function AdminParadaGlobalPage() {
  const auth = await requirePrivilegedSession();
  if (!auth) {
    return (
      <Shell title="Admin · Parada Global" subtitle="Horário de publicação e data limite">
        <div style={{ color: "var(--text-muted)" }}>Acesso negado. Apenas ADMIN e DEV.</div>
      </Shell>
    );
  }

  const schedules = await getEventSchedules();
  const slot = schedules.get(SocialEventType.GLOBAL100_PUBLISHED) ?? { weekday: 2, time: "09:00" };

  const now = new Date();
  const rankingWeek = getRankingWeekReference(now, slot);
  const deadline = getGlobalSnapshotDeadline(rankingWeek.weekIndex, slot);
  const publishAt = new Date(deadline.getTime() + 60 * 60 * 1000);

  const existingSnapshot = await prisma.globalSnapshot.findUnique({
    where: { weekIndex: rankingWeek.weekIndex },
    select: { weekIndex: true },
  });

  return (
    <Shell title="Parada Global" subtitle="Horário de publicação e data limite para envio das paradas">
      <ParadaGlobalClient
        initialSlot={slot}
        weekLabel={rankingWeek.weekLabel}
        deadlineIso={deadline.toISOString()}
        publishAtIso={publishAt.toISOString()}
        alreadyPublished={Boolean(existingSnapshot)}
      />
    </Shell>
  );
}

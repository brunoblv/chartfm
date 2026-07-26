import { Shell } from "@/components/layout/Shell";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { getEventSchedules } from "@/lib/social/event-schedule";
import { getRankingWeekReference, getGlobalSnapshotDeadline } from "@/lib/chart-week";
import { prisma } from "@/lib/prisma";
import { SocialEventType } from "@prisma/client";
import { getGlobalWeekStatus, listAdminGlobalWeekOptions } from "@/lib/admin-global-ops";
import {
  DEFAULT_WEEKLY_POLL_CLOSE_SLOT,
  DEFAULT_WEEKLY_POLL_OPEN_SLOT,
} from "@/lib/weekly-poll-schedule";
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
  const pollOpenSlot =
    schedules.get(SocialEventType.WEEKLY_POLL_OPEN) ?? DEFAULT_WEEKLY_POLL_OPEN_SLOT;
  const pollCloseSlot =
    schedules.get(SocialEventType.WEEKLY_POLL_CLOSE) ?? DEFAULT_WEEKLY_POLL_CLOSE_SLOT;

  const now = new Date();
  const rankingWeek = getRankingWeekReference(now, slot);
  const deadline = getGlobalSnapshotDeadline(rankingWeek.weekIndex, slot);
  const publishAt = new Date(deadline.getTime() + 60 * 60 * 1000);

  const [existingSnapshot, weeks, status] = await Promise.all([
    prisma.globalSnapshot.findUnique({
      where: { weekIndex: rankingWeek.weekIndex },
      select: { weekIndex: true },
    }),
    listAdminGlobalWeekOptions(24),
    getGlobalWeekStatus(rankingWeek.weekIndex),
  ]);

  return (
    <Shell title="Parada Global" subtitle="Horário, publicação manual e recuperação de falhas">
      <ParadaGlobalClient
        initialSlot={slot}
        initialPollOpenSlot={pollOpenSlot}
        initialPollCloseSlot={pollCloseSlot}
        weekLabel={rankingWeek.weekLabel}
        deadlineIso={deadline.toISOString()}
        publishAtIso={publishAt.toISOString()}
        alreadyPublished={Boolean(existingSnapshot)}
        initialWeekIndex={rankingWeek.weekIndex}
        initialWeeks={weeks}
        initialStatus={status}
      />
    </Shell>
  );
}

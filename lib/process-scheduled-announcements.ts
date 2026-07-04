import { prisma } from "@/lib/prisma";
import { dispatchAnnouncement } from "@/lib/dispatch-announcement";

export type ProcessScheduledResult = {
  processed: number;
  sent: number;
  errors: string[];
};

export async function sendScheduledAnnouncement(
  row: {
    id: string;
    text: string;
    targetUrl: string | null;
    notifyType: string;
    feedKind: string;
    scheduleMode: string;
    intervalHours: number | null;
    runCount: number;
    maxRuns: number | null;
    templateId?: string | null;
    contextKey?: string | null;
  },
): Promise<number> {
  const targeted = row.templateId === "copa_incomplete_singles";
  const recipients = await dispatchAnnouncement({
    text: row.text,
    targetUrl: row.targetUrl,
    notifyType: row.notifyType,
    feedKind: row.feedKind,
    targeted,
    templateId: row.templateId,
    contextKey: row.contextKey,
  });

  const now = new Date();
  const nextRunCount = row.runCount + 1;
  const reachedMax = row.maxRuns != null && nextRunCount >= row.maxRuns;

  if (row.scheduleMode === "once" || reachedMax) {
    await prisma.scheduledAnnouncement.update({
      where: { id: row.id },
      data: {
        status: "completed",
        lastSentAt: now,
        runCount: nextRunCount,
        nextRunAt: null,
      },
    });
    return recipients;
  }

  const hours = row.intervalHours ?? 24;
  const nextRunAt = new Date(now.getTime() + hours * 60 * 60 * 1000);

  await prisma.scheduledAnnouncement.update({
    where: { id: row.id },
    data: {
      lastSentAt: now,
      runCount: nextRunCount,
      nextRunAt,
    },
  });

  return recipients;
}

export async function processDueScheduledAnnouncements(): Promise<ProcessScheduledResult> {
  const now = new Date();
  const due = await prisma.scheduledAnnouncement.findMany({
    where: {
      status: "active",
      nextRunAt: { lte: now },
    },
    orderBy: { nextRunAt: "asc" },
    take: 20,
  });

  let sent = 0;
  const errors: string[] = [];

  for (const row of due) {
    try {
      const count = await sendScheduledAnnouncement(row);
      if (count > 0) sent += 1;
    } catch (err) {
      errors.push(`${row.id}: ${err instanceof Error ? err.message : "erro desconhecido"}`);
    }
  }

  return { processed: due.length, sent, errors };
}

export function computeInitialNextRunAt(input: {
  delivery: "now" | "scheduled";
  scheduleMode: "once" | "recurring";
  scheduledAt?: Date | null;
  intervalHours?: number | null;
}): Date | null {
  if (input.delivery === "now") return null;

  if (input.scheduleMode === "once") {
    return input.scheduledAt ?? null;
  }

  if (input.scheduledAt && input.scheduledAt.getTime() > Date.now()) {
    return input.scheduledAt;
  }

  return new Date();
}

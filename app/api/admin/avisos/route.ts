import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { dispatchAnnouncement } from "@/lib/dispatch-announcement";
import {
  ANNOUNCEMENT_TEMPLATES,
  getAnnouncementContext,
  resolveAnnouncementTemplate,
  type AnnouncementTemplateId,
} from "@/lib/admin-announcement-templates";
import { computeInitialNextRunAt } from "@/lib/process-scheduled-announcements";

function serializeAnnouncement(row: {
  id: string;
  label: string | null;
  text: string;
  targetUrl: string | null;
  notifyType: string;
  feedKind: string;
  templateId: string | null;
  contextKey: string | null;
  status: string;
  scheduleMode: string;
  scheduledAt: Date | null;
  intervalHours: number | null;
  nextRunAt: Date | null;
  lastSentAt: Date | null;
  runCount: number;
  maxRuns: number | null;
  createdAt: Date;
}) {
  return {
    ...row,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
    lastSentAt: row.lastSentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET() {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const [scheduled, recentFeed, context] = await Promise.all([
    prisma.scheduledAnnouncement.findMany({
      orderBy: [{ status: "asc" }, { nextRunAt: "asc" }, { createdAt: "desc" }],
      take: 50,
    }),
    prisma.systemFeedPost.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { id: true, kind: true, text: true, targetUrl: true, createdAt: true },
    }),
    getAnnouncementContext(),
  ]);

  return NextResponse.json({
    templates: ANNOUNCEMENT_TEMPLATES,
    context,
    scheduled: scheduled.map(serializeAnnouncement),
    recentFeed: recentFeed.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}

type CreateBody = {
  templateId?: AnnouncementTemplateId;
  contextKey?: string | null;
  text?: string;
  targetUrl?: string | null;
  label?: string;
  delivery?: "now" | "scheduled";
  scheduleMode?: "once" | "recurring";
  scheduledAt?: string;
  intervalHours?: number;
  maxRuns?: number | null;
};

export async function POST(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json()) as CreateBody;
  const templateId = (body.templateId ?? "custom") as AnnouncementTemplateId;
  const delivery = body.delivery ?? "now";
  const scheduleMode = body.scheduleMode ?? "once";

  const resolved = await resolveAnnouncementTemplate(templateId, body.contextKey, {
    text: body.text,
    targetUrl: body.targetUrl,
  });
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  const text = body.text?.trim() || resolved.text;
  const targetUrl = body.targetUrl?.trim() || resolved.targetUrl;

  if (delivery === "now") {
    const recipients = await dispatchAnnouncement({
      text,
      targetUrl,
      notifyType: resolved.notifyType,
      feedKind: resolved.feedKind,
      targeted: resolved.targeted,
      templateId,
      contextKey: body.contextKey ?? null,
    });
    const targeted = resolved.targeted ?? false;
    return NextResponse.json({
      ok: true,
      delivery: "now",
      recipients,
      targeted,
      message:
        recipients === 0 && targeted
          ? "Nenhum inscrito com músicas incompletas no momento."
          : undefined,
    });
  }

  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  if (scheduleMode === "once" && (!scheduledAt || Number.isNaN(scheduledAt.getTime()))) {
    return NextResponse.json({ error: "Informe data/hora para agendamento único." }, { status: 400 });
  }
  if (scheduleMode === "recurring") {
    const hours = body.intervalHours ?? 0;
    if (hours < 1 || hours > 168) {
      return NextResponse.json({ error: "Intervalo deve ser entre 1 e 168 horas." }, { status: 400 });
    }
  }

  const nextRunAt = computeInitialNextRunAt({
    delivery: "scheduled",
    scheduleMode,
    scheduledAt,
    intervalHours: body.intervalHours,
  });
  if (!nextRunAt) {
    return NextResponse.json({ error: "Não foi possível calcular o próximo envio." }, { status: 400 });
  }

  const row = await prisma.scheduledAnnouncement.create({
    data: {
      label: body.label?.trim() || null,
      text,
      targetUrl,
      notifyType: resolved.notifyType,
      feedKind: resolved.feedKind,
      templateId,
      contextKey: body.contextKey ?? null,
      status: "active",
      scheduleMode,
      scheduledAt,
      intervalHours: scheduleMode === "recurring" ? (body.intervalHours ?? 24) : null,
      nextRunAt,
      maxRuns: body.maxRuns ?? null,
      createdById: auth.userId,
    },
  });

  return NextResponse.json({ ok: true, delivery: "scheduled", announcement: serializeAnnouncement(row) });
}

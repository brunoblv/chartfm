import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { SocialEventType, SocialPlatform } from "@prisma/client";

export async function PATCH(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const body = await req.json();
  const { kind } = body as { kind: "platform" | "automation" | "schedule" | "event-schedule" };

  if (kind === "platform") {
    const { platform, enabled } = body as { platform: SocialPlatform; enabled?: boolean };
    const updated = await prisma.socialPlatformConfig.upsert({
      where: { platform },
      create: { platform, enabled: enabled ?? true },
      update: { ...(enabled !== undefined ? { enabled } : {}) },
    });
    return NextResponse.json({ ok: true, config: updated });
  }

  if (kind === "event-schedule") {
    const { eventType, weekday, time } = body as { eventType: SocialEventType; weekday: number; time: string };
    const updated = await prisma.socialEventSchedule.upsert({
      where: { eventType },
      create: { eventType, weekday, time },
      update: { weekday, time },
    });
    return NextResponse.json({ ok: true, config: updated });
  }

  if (kind === "automation") {
    const { eventType, enabled } = body as { eventType: SocialEventType; enabled: boolean };
    const updated = await prisma.socialAutomationToggle.upsert({
      where: { eventType },
      create: { eventType, enabled },
      update: { enabled },
    });
    return NextResponse.json({ ok: true, toggle: updated });
  }

  if (kind === "schedule") {
    const { slots, timezone } = body as { slots?: string[]; timezone?: string };
    const updated = await prisma.socialScheduleConfig.upsert({
      where: { id: "default" },
      create: { id: "default", slots: slots ?? undefined, timezone: timezone ?? undefined },
      update: { ...(slots ? { slots } : {}), ...(timezone ? { timezone } : {}) },
    });
    return NextResponse.json({ ok: true, config: updated });
  }

  return NextResponse.json({ error: "kind desconhecido" }, { status: 400 });
}

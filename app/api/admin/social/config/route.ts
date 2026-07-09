import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { SocialEventType, SocialPlatform } from "@prisma/client";

export async function PATCH(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const body = await req.json();
  const { kind } = body as { kind: "platform" | "automation" | "schedule" };

  if (kind === "platform") {
    const { platform, dailyLimit, enabled } = body as { platform: SocialPlatform; dailyLimit?: number; enabled?: boolean };
    const updated = await prisma.socialPlatformConfig.upsert({
      where: { platform },
      create: { platform, dailyLimit: dailyLimit ?? 2, enabled: enabled ?? true },
      update: { ...(dailyLimit !== undefined ? { dailyLimit } : {}), ...(enabled !== undefined ? { enabled } : {}) },
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

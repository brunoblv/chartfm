import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { SocialEventType } from "@prisma/client";
import { priorityForEventType, expiresAtForEventType } from "@/lib/social/priority";

/** Criação manual de publicação — bypassa a checagem de elegibilidade automática, mas usa a mesma fila/scheduler/publish. */
export async function POST(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const body = await req.json();
  const { eventType, entityType, entityId } = body as { eventType: SocialEventType; entityType: string; entityId: string };
  if (!eventType || !entityType || !entityId) {
    return NextResponse.json({ error: "eventType, entityType e entityId são obrigatórios" }, { status: 400 });
  }

  const now = new Date();
  const post = await prisma.socialPost.create({
    data: {
      eventType,
      entityType,
      entityId,
      priority: priorityForEventType(eventType),
      expiresAt: expiresAtForEventType(eventType, now),
      platforms: [],
    },
  });

  return NextResponse.json({ ok: true, post });
}

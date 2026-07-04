import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { sendScheduledAnnouncement } from "@/lib/process-scheduled-announcements";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await req.json()) as { status?: string; action?: string };

  const row = await prisma.scheduledAnnouncement.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Aviso não encontrado." }, { status: 404 });

  if (body.action === "send_now") {
    const recipients = await sendScheduledAnnouncement(row);
    return NextResponse.json({ ok: true, recipients });
  }

  const status = body.status;
  if (!status || !["active", "paused", "completed"].includes(status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  await prisma.scheduledAnnouncement.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json({ ok: true, status });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  try {
    await prisma.scheduledAnnouncement.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Aviso não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import {
  getSupportAuth,
  serializeMessage,
  TICKET_USER_SELECT,
} from "@/lib/support-tickets";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await getSupportAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: ticketId } = await context.params;
  const body = (await req.json()) as { message?: string };
  const message = body.message?.trim();

  if (!message || message.length < 1) {
    return NextResponse.json({ error: "empty_message" }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: "message_too_long" }, { status: 400 });
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, userId: true, subject: true, status: true },
  });
  if (!ticket) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!auth.isStaff && ticket.userId !== auth.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (ticket.status === "CLOSED" && !auth.isStaff) {
    return NextResponse.json({ error: "ticket_closed" }, { status: 400 });
  }

  const isStaff = auth.isStaff;
  const [created] = await prisma.$transaction([
    prisma.supportTicketMessage.create({
      data: {
        ticketId,
        userId: auth.id,
        body: message,
        isStaff,
      },
      include: { user: { select: TICKET_USER_SELECT } },
    }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        updatedAt: new Date(),
        ...(isStaff && ticket.status === "OPEN" ? { status: "IN_PROGRESS" as const } : {}),
      },
    }),
  ]);

  const preview = message.length > 60 ? message.slice(0, 57) + "…" : message;
  if (isStaff && ticket.userId !== auth.id) {
    await createNotification({
      recipientId: ticket.userId,
      actorId: auth.id,
      type: "support_reply",
      text: `respondeu ao seu ticket "${ticket.subject.length > 40 ? ticket.subject.slice(0, 37) + "…" : ticket.subject}": "${preview}"`,
      targetUrl: `/support?ticket=${ticketId}`,
    });
  } else if (!isStaff) {
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "DEV"] } },
      select: { id: true },
      take: 20,
    });
    await Promise.all(
      admins.map((admin) =>
        createNotification({
          recipientId: admin.id,
          actorId: auth.id,
          type: "support_ticket",
          text: `respondeu no ticket "${ticket.subject.length > 40 ? ticket.subject.slice(0, 37) + "…" : ticket.subject}": "${preview}"`,
          targetUrl: `/admin/support?ticket=${ticketId}`,
        }),
      ),
    );
  }

  return NextResponse.json(serializeMessage(created), { status: 201 });
}

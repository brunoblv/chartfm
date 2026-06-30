import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import {
  getSupportAuth,
  serializeTicket,
  TICKET_USER_SELECT,
} from "@/lib/support-tickets";
import type { SupportTicketStatus, SupportTicketType } from "@prisma/client";

export const runtime = "nodejs";

const VALID_TYPES: SupportTicketType[] = ["BUG", "SUGGESTION"];
const VALID_STATUSES: SupportTicketStatus[] = ["OPEN", "IN_PROGRESS", "CLOSED"];

export async function GET(req: NextRequest) {
  const auth = await getSupportAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") as SupportTicketStatus | null;
  const where = auth.isStaff
    ? status && VALID_STATUSES.includes(status)
      ? { status }
      : {}
    : { userId: auth.id };

  const tickets = await prisma.supportTicket.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: auth.isStaff ? 200 : 100,
    include: {
      user: { select: TICKET_USER_SELECT },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json(tickets.map(serializeTicket));
}

export async function POST(req: NextRequest) {
  const auth = await getSupportAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    type?: SupportTicketType;
    subject?: string;
    message?: string;
  };

  const type = body.type;
  const subject = body.subject?.trim();
  const message = body.message?.trim();

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }
  if (!subject || subject.length < 3) {
    return NextResponse.json({ error: "invalid_subject" }, { status: 400 });
  }
  if (subject.length > 120) {
    return NextResponse.json({ error: "subject_too_long" }, { status: 400 });
  }
  if (!message || message.length < 10) {
    return NextResponse.json({ error: "invalid_message" }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: "message_too_long" }, { status: 400 });
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: auth.id,
      type,
      subject,
      messages: {
        create: {
          userId: auth.id,
          body: message,
          isStaff: false,
        },
      },
    },
    include: {
      user: { select: TICKET_USER_SELECT },
      _count: { select: { messages: true } },
    },
  });

  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "DEV"] } },
    select: { id: true },
    take: 20,
  });

  const typeLabel = type === "BUG" ? "bug" : "sugestão";
  await Promise.all(
    admins.map((admin) =>
      createNotification({
        recipientId: admin.id,
        actorId: auth.id,
        type: "support_ticket",
        text: `abriu um ticket de ${typeLabel}: "${subject.length > 50 ? subject.slice(0, 47) + "…" : subject}"`,
        targetUrl: `/admin/support?ticket=${ticket.id}`,
      }),
    ),
  );

  return NextResponse.json(serializeTicket(ticket), { status: 201 });
}

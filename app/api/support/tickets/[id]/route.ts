import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSupportAuth,
  serializeMessage,
  serializeTicket,
  TICKET_USER_SELECT,
} from "@/lib/support-tickets";
import type { SupportTicketStatus } from "@prisma/client";

export const runtime = "nodejs";

const VALID_STATUSES: SupportTicketStatus[] = ["OPEN", "IN_PROGRESS", "CLOSED"];

async function getTicketForAuth(ticketId: string, auth: { id: string; isStaff: boolean }) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: { select: TICKET_USER_SELECT },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: TICKET_USER_SELECT } },
      },
      _count: { select: { messages: true } },
    },
  });

  if (!ticket) return null;
  if (!auth.isStaff && ticket.userId !== auth.id) return null;
  return ticket;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await getSupportAuth();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const ticket = await getTicketForAuth(id, auth);
  if (!ticket) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({
    ...serializeTicket(ticket),
    messages: ticket.messages.map(serializeMessage),
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await getSupportAuth();
  if (!auth?.isStaff) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await context.params;
  const body = (await req.json()) as { status?: SupportTicketStatus };
  const status = body.status;

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const existing = await prisma.supportTicket.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const ticket = await prisma.supportTicket.update({
    where: { id },
    data: { status },
    include: {
      user: { select: TICKET_USER_SELECT },
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json(serializeTicket(ticket));
}

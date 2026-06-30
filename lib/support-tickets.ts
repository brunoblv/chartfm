import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import type { SupportTicketStatus, SupportTicketType } from "@prisma/client";

export type SupportAuth = {
  id: string;
  role: string;
  handle: string;
  name: string;
  isStaff: boolean;
};

export async function getSupportAuth(): Promise<SupportAuth | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, handle: true, name: true },
  });
  if (!user) return null;

  return {
    ...user,
    isStaff: isPrivilegedRole(user.role),
  };
}

export function serializeTicket(ticket: {
  id: string;
  type: SupportTicketType;
  subject: string;
  status: SupportTicketStatus;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; handle: string; name: string; avatarColor: string; image: string | null };
  messages?: { createdAt: Date }[];
  _count?: { messages: number };
}) {
  const lastMessageAt =
    ticket.messages?.[0]?.createdAt ?? ticket.updatedAt;

  return {
    id: ticket.id,
    type: ticket.type,
    subject: ticket.subject,
    status: ticket.status,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    lastMessageAt: lastMessageAt.toISOString(),
    messageCount: ticket._count?.messages ?? ticket.messages?.length ?? 0,
    user: {
      id: ticket.user.id,
      handle: ticket.user.handle,
      name: ticket.user.name,
      avatarColor: ticket.user.avatarColor,
      image: ticket.user.image,
    },
  };
}

export function serializeMessage(message: {
  id: string;
  body: string;
  isStaff: boolean;
  createdAt: Date;
  user: { id: string; handle: string; name: string; avatarColor: string; image: string | null };
}) {
  return {
    id: message.id,
    body: message.body,
    isStaff: message.isStaff,
    createdAt: message.createdAt.toISOString(),
    user: {
      id: message.user.id,
      handle: message.user.handle,
      name: message.user.name,
      avatarColor: message.user.avatarColor,
      image: message.user.image,
    },
  };
}

export const TICKET_USER_SELECT = {
  id: true,
  handle: true,
  name: true,
  avatarColor: true,
  image: true,
} as const;

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await prisma.notification.findMany({
    where: { recipientId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      actor: {
        select: {
          id: true,
          handle: true,
          name: true,
          avatarColor: true,
          image: true,
        },
      },
    },
  });

  return NextResponse.json(rows);
}

export async function PATCH() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await prisma.notification.updateMany({
    where: { recipientId: session.user.id, read: false },
    data: { read: true },
  });

  return NextResponse.json({ ok: true });
}

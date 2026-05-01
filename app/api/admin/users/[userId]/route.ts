import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { userId } = await context.params;
  const role = (await req.json()) as { role?: string };
  if (!role?.role || !["USER", "ADMIN", "DEV"].includes(role.role)) {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { role: role.role as "USER" | "ADMIN" | "DEV" },
    select: { id: true, handle: true, role: true },
  });
  return NextResponse.json({ user });
}

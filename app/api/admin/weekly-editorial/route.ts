import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidateTag } from "next/cache";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";

export const runtime = "nodejs";

async function ensurePrivilegedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, status: 401 };
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return { ok: false as const, status: 403 };
  return { ok: true as const };
}

export async function PUT(req: NextRequest) {
  const guard = await ensurePrivilegedUser();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.status === 401 ? "unauthorized" : "forbidden" }, { status: guard.status });
  }

  const body = (await req.json()) as { weekIndex?: unknown; body?: unknown };
  const weekIndex = typeof body.weekIndex === "number" ? body.weekIndex : Number(body.weekIndex);
  const text = typeof body.body === "string" ? body.body.trim() : "";

  if (!Number.isInteger(weekIndex) || weekIndex <= 0) {
    return NextResponse.json({ error: "invalid_week_index" }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: "body_required" }, { status: 400 });

  const editorial = await prisma.weeklyEditorial.upsert({
    where: { weekIndex },
    create: { weekIndex, body: text },
    update: { body: text },
    select: { weekIndex: true, body: true },
  });

  revalidateTag(`weekly-editorial-${weekIndex}`, "max");

  return NextResponse.json({ editorial });
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

const HANDLE_RE = /^[a-z0-9][a-z0-9_]{2,27}$/;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const h = searchParams.get("h")?.toLowerCase().trim();

  if (!h || !HANDLE_RE.test(h)) {
    return NextResponse.json({ available: false, reason: "invalid" });
  }

  const taken = await prisma.user.findUnique({ where: { handle: h } });
  return NextResponse.json({ available: !taken });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const handle: string = (body.handle ?? "").toLowerCase().trim();

  if (!HANDLE_RE.test(handle)) {
    return NextResponse.json({ error: "Handle inválido" }, { status: 400 });
  }

  const taken = await prisma.user.findFirst({
    where: { handle, NOT: { id: session.user.id } },
  });
  if (taken) {
    return NextResponse.json({ error: "Já em uso" }, { status: 409 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { handle, needsHandle: false },
  });

  return NextResponse.json({ ok: true });
}

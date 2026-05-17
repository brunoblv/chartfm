import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { paradaNome: true },
  });

  return NextResponse.json({ paradaNome: user?.paradaNome ?? null });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const paradaNome = typeof body.paradaNome === "string" ? body.paradaNome.trim() : null;

  if (!paradaNome || paradaNome.length < 2) {
    return NextResponse.json({ error: "Nome muito curto" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { paradaNome },
  });

  return NextResponse.json({ ok: true });
}

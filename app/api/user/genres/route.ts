import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const genres: string[] = Array.isArray(body.genres) ? body.genres : [];

  await prisma.user.update({
    where: { id: session.user.id },
    data: { genres },
  });

  return NextResponse.json({ ok: true });
}

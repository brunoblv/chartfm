import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { restoreParada } from "@/lib/paradas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { paradaId?: string };
  const paradaId = typeof body.paradaId === "string" ? body.paradaId.trim() : "";
  if (!paradaId) {
    return NextResponse.json({ error: "paradaId obrigatório" }, { status: 400 });
  }

  try {
    await restoreParada(prisma, session.user.id, paradaId, session.user.handle);
  } catch (e) {
    if (e instanceof Error && e.message === "parada_not_found") {
      return NextResponse.json({ error: "Parada não encontrada" }, { status: 404 });
    }
    if (e instanceof Error && e.message === "paradas_limit_reached") {
      return NextResponse.json(
        { error: "Limite de paradas atingido. Exclua outra parada antes de restaurar." },
        { status: 409 },
      );
    }
    throw e;
  }

  return NextResponse.json({ ok: true });
}

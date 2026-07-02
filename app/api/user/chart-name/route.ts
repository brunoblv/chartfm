import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { toApiCadence } from "@/lib/chart-cadence";
import { ensureUserParadas, syncUserPrimaryParadaFields } from "@/lib/paradas";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let paradas;
  try {
    paradas = await ensureUserParadas(prisma, session.user.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "user_not_found") {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }
    console.error("[GET /api/user/chart-name] ensureUserParadas", err);
    return NextResponse.json(
      { paradaNome: null, paradaId: null, paradas: [] },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  }
  const primary = paradas.find((p) => p.isPrimary) ?? paradas[0];

  return NextResponse.json(
    {
      paradaNome: primary?.name ?? null,
      paradaId: primary?.id ?? null,
      paradas: paradas.map((p) => ({
        id: p.id,
        name: p.name,
        isPrimary: p.isPrimary,
        chartSize: p.chartSize,
        cadence: toApiCadence(p.cadence),
      })),
    },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
  );
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const paradaNome = typeof body.paradaNome === "string" ? body.paradaNome.trim() : null;
  const paradaId = typeof body.paradaId === "string" ? body.paradaId.trim() : null;

  if (!paradaNome || paradaNome.length < 2) {
    return NextResponse.json({ error: "Nome muito curto" }, { status: 400 });
  }

  let paradas;
  try {
    paradas = await ensureUserParadas(prisma, session.user.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "user_not_found") {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }
    console.error("[PATCH /api/user/chart-name] ensureUserParadas", err);
    return NextResponse.json(
      { error: "Não foi possível preparar sua parada. Confira se as migrações do banco foram aplicadas." },
      { status: 503 },
    );
  }

  const primary = paradas.find((p) => p.isPrimary) ?? paradas[0];
  const targetId = paradaId ?? primary?.id;
  if (!targetId) {
    return NextResponse.json({ error: "Parada não encontrada" }, { status: 404 });
  }

  const owned = paradas.find((p) => p.id === targetId) ??
    (await prisma.parada.findFirst({
      where: { id: targetId, userId: session.user.id, deletedAt: null },
    }));
  if (!owned) {
    return NextResponse.json({ error: "Parada não encontrada" }, { status: 404 });
  }

  await prisma.parada.update({
    where: { id: targetId },
    data: { name: paradaNome },
  });

  if (owned.isPrimary) {
    await syncUserPrimaryParadaFields(prisma, session.user.id);
  }

  return NextResponse.json({ ok: true, paradaId: targetId });
}

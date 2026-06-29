import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import {
  canCreateAnotherParada,
  ensureUserParadas,
  setPrimaryParada,
  syncUserPrimaryParadaFields,
} from "@/lib/paradas";
import { maxParadasForUser } from "@/lib/mytrl-access";
import { parseCadenceInput, toApiCadence } from "@/lib/chart-cadence";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let paradas;
  try {
    paradas = await ensureUserParadas(prisma, session.user.id);
  } catch (e) {
    if (e instanceof Error && e.message === "user_not_found") {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }
    throw e;
  }
  const maxParadas = maxParadasForUser(session.user.handle);
  const canCreate = paradas.length < maxParadas;

  return NextResponse.json({
    paradas: paradas.map((p) => ({
      id: p.id,
      name: p.name,
      logo: p.logo,
      genres: p.genres,
      isPrimary: p.isPrimary,
      sortOrder: p.sortOrder,
      chartSize: p.chartSize,
      cadence: toApiCadence(p.cadence),
    })),
    canCreate,
    maxParadas,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    name?: string;
    genres?: string[];
    chartSize?: number | null;
    cadence?: unknown;
  };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2) {
    return NextResponse.json({ error: "Nome muito curto" }, { status: 400 });
  }

  const genres = Array.isArray(body.genres)
    ? body.genres.map((g) => String(g).trim()).filter(Boolean).slice(0, 15)
    : [];

  const chartSize =
    typeof body.chartSize === "number"
      ? Math.min(100, Math.max(1, Math.round(body.chartSize)))
      : null;

  if (!(await canCreateAnotherParada(prisma, session.user.id, session.user.handle))) {
    const limit = maxParadasForUser(session.user.handle);
    return NextResponse.json(
      { error: `Limite de ${limit} paradas atingido` },
      { status: 409 },
    );
  }

  const cadence = parseCadenceInput(body.cadence) ?? "WEEKLY";

  const sortOrder = await prisma.parada.count({ where: { userId: session.user.id } });
  const parada = await prisma.parada.create({
    data: {
      userId: session.user.id,
      name,
      genres,
      isPrimary: false,
      sortOrder,
      chartSize,
      cadence,
    },
  });

  return NextResponse.json({
    parada: {
      id: parada.id,
      name: parada.name,
      logo: parada.logo,
      genres: parada.genres,
      isPrimary: parada.isPrimary,
      sortOrder: parada.sortOrder,
      chartSize: parada.chartSize,
      cadence: toApiCadence(parada.cadence),
    },
  });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    paradaId?: string;
    name?: string;
    genres?: string[];
    logo?: string | null;
    setPrimary?: boolean;
    chartSize?: number | null;
    cadence?: unknown;
  };

  const paradaId = typeof body.paradaId === "string" ? body.paradaId.trim() : "";
  if (!paradaId) {
    return NextResponse.json({ error: "paradaId obrigatório" }, { status: 400 });
  }

  const owned = await prisma.parada.findFirst({
    where: { id: paradaId, userId: session.user.id },
  });
  if (!owned) {
    return NextResponse.json({ error: "Parada não encontrada" }, { status: 404 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const genres = Array.isArray(body.genres)
    ? body.genres.map((g) => String(g).trim()).filter(Boolean).slice(0, 15)
    : undefined;
  const logo =
    body.logo === null ? null : typeof body.logo === "string" ? body.logo.trim() || null : undefined;

  if (name !== undefined && name.length > 0 && name.length < 2) {
    return NextResponse.json({ error: "Nome muito curto" }, { status: 400 });
  }

  const patchChartSize =
    typeof body.chartSize === "number"
      ? Math.min(100, Math.max(1, Math.round(body.chartSize)))
      : body.chartSize === null
        ? null
        : undefined;

  const patchCadence = parseCadenceInput(body.cadence);
  if (patchCadence === "DAILY" && owned.isPrimary) {
    return NextResponse.json({ error: "A parada principal só pode ser semanal" }, { status: 400 });
  }

  if (body.setPrimary === true) {
    await setPrimaryParada(prisma, session.user.id, paradaId);
  }

  const updated = await prisma.parada.update({
    where: { id: paradaId },
    data: {
      ...(name !== undefined && name.length >= 2 ? { name } : {}),
      ...(genres !== undefined ? { genres } : {}),
      ...(logo !== undefined ? { logo } : {}),
      ...(patchChartSize !== undefined ? { chartSize: patchChartSize } : {}),
      ...(patchCadence !== null ? { cadence: patchCadence } : {}),
    },
  });

  if (updated.isPrimary) {
    await syncUserPrimaryParadaFields(prisma, session.user.id);
  }

  return NextResponse.json({
    parada: {
      id: updated.id,
      name: updated.name,
      logo: updated.logo,
      genres: updated.genres,
      isPrimary: updated.isPrimary,
      sortOrder: updated.sortOrder,
      chartSize: updated.chartSize,
      cadence: toApiCadence(updated.cadence),
    },
  });
}

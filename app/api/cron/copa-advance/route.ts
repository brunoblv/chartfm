import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { advanceCopaDay } from "@/lib/copa-day";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// Prazo de votação diário: fecha o lote Ao vivo de cada Copa em andamento e abre
// o próximo automaticamente. Agendado para 10h BRT (13h UTC) em vercel.json.
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const copas = await prisma.copaEdition.findMany({
    where: { status: { in: ["GROUP_STAGE", "KNOCKOUT"] } },
    select: { id: true, name: true },
  });

  const results = [];
  for (const c of copas) {
    const r = await advanceCopaDay(c.id);
    results.push({ copaId: c.id, name: c.name, ...r });
  }

  return NextResponse.json({ ok: true, copas: results.length, results });
}

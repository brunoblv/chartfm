import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncCopaToSchedule } from "@/lib/copa-day";
import { probeSpotifyApi } from "@/lib/spotify-server";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// Roda de hora em hora e reconcilia cada Copa agendada (com startsAt) ao seu
// calendário: abre/fecha os lotes no horário definido. Copas sem data marcada
// ficam no modo manual (botão Avançar Dia) e são ignoradas aqui.
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Sob rate limit, não insiste — a sincronização de playlist do dia é a parte que usa
  // Spotify; a próxima hora tenta de novo.
  const probe = await probeSpotifyApi();
  if (!probe.ok) {
    return NextResponse.json({ ok: true, skipped: true, error: probe.error });
  }

  const copas = await prisma.copaEdition.findMany({
    where: { status: { in: ["GROUP_STAGE", "KNOCKOUT"] }, startsAt: { not: null } },
    select: { id: true, name: true },
  });

  const results = [];
  for (const c of copas) {
    const r = await syncCopaToSchedule(c.id);
    if (r) results.push({ copaId: c.id, name: c.name, ...r });
  }

  return NextResponse.json({ ok: true, copas: results.length, results });
}

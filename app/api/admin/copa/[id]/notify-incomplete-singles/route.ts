import { NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  getCopaIncompleteSinglesRecipients,
  notifyCopaIncompleteSingles,
} from "@/lib/copa-incomplete-singles";

type RouteParams = { params: Promise<{ id: string }> };

// GET — lista inscritos com músicas/artistas incompletos
export async function GET(_req: Request, { params }: RouteParams) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const copa = await prisma.copaEdition.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!copa) return NextResponse.json({ error: "Copa não encontrada." }, { status: 404 });

  const recipients = await getCopaIncompleteSinglesRecipients(id);
  return NextResponse.json({ copa, count: recipients.length, recipients });
}

// POST — dispara aviso no sino para quem está incompleto
export async function POST(req: Request, { params }: RouteParams) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const copa = await prisma.copaEdition.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!copa) return NextResponse.json({ error: "Copa não encontrada." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text =
    body.text?.trim() ||
    `Faltam músicas no seu time da ${copa.name}! Acesse Meu Time e complete as 8 músicas de cada artista.`;

  const result = await notifyCopaIncompleteSingles(id, text, "/copa/meu-time");

  return NextResponse.json({
    ok: true,
    sent: result.sent,
    recipients: result.recipients,
    message:
      result.sent === 0
        ? "Todos os inscritos já completaram músicas e artistas."
        : `Aviso enviado para ${result.sent} participante(s).`,
  });
}

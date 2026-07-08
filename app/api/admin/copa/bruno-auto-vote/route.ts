import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { enqueueBrunoAutoVotes } from "@/lib/copa-bruno-auto-vote";

// POST /api/admin/copa/bruno-auto-vote — só @bruno. Enfileira os votos dos 22
// usuários para os jogos abertos; o cron /api/cron/copa-bruno-auto-vote drena
// a fila 1 voto a cada 10 minutos (para não caírem todos juntos).
export async function POST() {
  const session = await getServerSession(authOptions);
  if (session?.user?.handle !== "bruno") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await enqueueBrunoAutoVotes();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error.includes("ativa") ? 404 : 400 });
  }

  return NextResponse.json(result);
}

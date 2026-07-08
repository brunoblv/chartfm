import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { runBrunoAutoVote } from "@/lib/copa-bruno-auto-vote";

// POST /api/admin/copa/bruno-auto-vote — gatilho manual, só @bruno. O mesmo
// voto também roda sozinho a cada minuto via /api/cron/copa-bruno-auto-vote.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (session?.user?.handle !== "bruno") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await runBrunoAutoVote();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error.includes("ativa") ? 404 : 400 });
  }

  return NextResponse.json(result);
}

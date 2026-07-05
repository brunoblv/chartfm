import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getLatestWeeklyPollView } from "@/lib/weekly-spotlight-poll";

export const runtime = "nodejs";

// GET /api/weekly-poll — enquete mais recente (Melhor da Semana + Flashback) com votos do usuário
export async function GET() {
  const session = await getServerSession(authOptions);
  const poll = await getLatestWeeklyPollView(session?.user?.id ?? null);
  return NextResponse.json({ poll, loggedIn: Boolean(session?.user?.id) });
}

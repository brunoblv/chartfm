import { NextRequest, NextResponse } from "next/server";
import { authorizedCron } from "@/lib/cron-auth";
import { recordApiRequestStart, type ApiRequestLogSource } from "@/lib/api-request-log";

export const runtime = "nodejs";

// POST /api/internal/log-request — chamado pelo middleware (edge, sem Prisma) para
// registrar cada chamada de API vista em app/admin/logs. Não é uma rota pública:
// exige o mesmo Bearer CRON_SECRET usado pelos crons (ver lib/cron-auth.ts).
export async function POST(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    id?: string;
    method?: string;
    path?: string;
    source?: ApiRequestLogSource;
    userId?: string | null;
    userName?: string | null;
    userHandle?: string | null;
  } | null;

  if (!body?.id || !body.method || !body.path || !body.source) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    await recordApiRequestStart({
      id: body.id,
      method: body.method,
      path: body.path,
      source: body.source,
      userId: body.userId,
      userName: body.userName,
      userHandle: body.userHandle,
    });
  } catch {
    // Nunca deixar o log derrubar a requisição original — falha aqui é silenciosa.
  }

  return NextResponse.json({ ok: true });
}

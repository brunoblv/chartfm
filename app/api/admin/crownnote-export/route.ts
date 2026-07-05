import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { exportCrownnoteUser } from "@/lib/crownnote-export";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const NO_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

type Body = {
  username?: string;
  maxCharts?: number;
  stream?: boolean;
};

export async function POST(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403, headers: NO_CACHE });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers: NO_CACHE });
  }

  const username = body.username?.trim();
  if (!username) {
    return NextResponse.json({ error: "Informe o usuário do Crownnote." }, { status: 400, headers: NO_CACHE });
  }

  const maxCharts =
    typeof body.maxCharts === "number" && body.maxCharts > 0
      ? Math.min(Math.floor(body.maxCharts), 5000)
      : undefined;

  if (body.stream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: object) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        };

        try {
          const data = await exportCrownnoteUser(username, {
            maxCharts,
            onProgress: (progress) => send({ type: "progress", ...progress }),
          });
          send({ type: "done", data });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Erro ao exportar.";
          send({ type: "error", message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...NO_CACHE,
        "Content-Type": "application/x-ndjson; charset=utf-8",
      },
    });
  }

  try {
    const data = await exportCrownnoteUser(username, { maxCharts });
    return NextResponse.json({ ok: true, data }, { headers: NO_CACHE });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao exportar.";
    return NextResponse.json({ error: message }, { status: 400, headers: NO_CACHE });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import type { CrownnoteSongMatchRow } from "@/lib/crownnote-song-match";
import {
  rematchUnmatchedRows,
  resolveUnmatchedRowsViaSpotify,
} from "@/lib/crownnote-song-match";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const NO_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

type Body = {
  rows?: CrownnoteSongMatchRow[];
  mode?: "rematch" | "spotify";
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

  const rows = body.rows ?? [];
  const mode = body.mode ?? "rematch";
  if (!rows.length) {
    return NextResponse.json({ error: "Nenhuma música para processar." }, { status: 400, headers: NO_CACHE });
  }

  if (body.stream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: object) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        };

        try {
          if (mode === "spotify") {
            const result = await resolveUnmatchedRowsViaSpotify(rows, (progress) => {
              send({ type: "progress", ...progress });
            });
            send({ type: "done", ...result });
          } else {
            const result = await rematchUnmatchedRows(rows);
            send({ type: "done", ...result, failed: 0 });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Erro ao resolver.";
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
    if (mode === "spotify") {
      const result = await resolveUnmatchedRowsViaSpotify(rows);
      return NextResponse.json({ ok: true, ...result }, { headers: NO_CACHE });
    }
    const result = await rematchUnmatchedRows(rows);
    return NextResponse.json({ ok: true, ...result, failed: 0 }, { headers: NO_CACHE });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao resolver.";
    return NextResponse.json({ error: message }, { status: 400, headers: NO_CACHE });
  }
}

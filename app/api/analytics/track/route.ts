import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { logSystemError } from "@/lib/system-error-log";

export const runtime = "nodejs";

const VALID_TYPES = new Set(["pageview", "heartbeat"]);
const BOT_RE = /bot|crawler|spider|crawling|facebookexternalhit|preview/i;

// POST /api/analytics/track — registra pageview/heartbeat (usuário logado ou anônimo)
export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") ?? "";
    if (BOT_RE.test(ua)) return new NextResponse(null, { status: 204 });

    const body = await req.json().catch(() => null);
    if (!body) return new NextResponse(null, { status: 204 });

    const type = String(body.type ?? "");
    const path = String(body.path ?? "");
    const sessionId = String(body.sessionId ?? "");
    const referrer = body.referrer ? String(body.referrer).slice(0, 300) : null;
    const device = body.device === "mobile" || body.device === "desktop" ? body.device : null;

    if (!VALID_TYPES.has(type)) return new NextResponse(null, { status: 204 });
    if (!path.startsWith("/") || path.length > 300) return new NextResponse(null, { status: 204 });
    if (!/^[a-z0-9-]{10,64}$/i.test(sessionId)) return new NextResponse(null, { status: 204 });

    const session = await getServerSession(authOptions);

    await prisma.analyticsEvent.create({
      data: {
        sessionId,
        userId: session?.user?.id ?? null,
        type,
        path,
        referrer: type === "pageview" ? referrer : null,
        device,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[analytics/track]", err);
    void logSystemError({ scope: "POST /api/analytics/track", error: err });
    return new NextResponse(null, { status: 204 });
  }
}

import { NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/email-verification";
import { enforceIpRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const limited = enforceIpRateLimit(req, "verify-email", {
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  const result = await verifyEmailToken(token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

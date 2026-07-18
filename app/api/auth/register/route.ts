import { NextResponse } from "next/server";
import { createEmailUser } from "@/lib/email-user";
import { sendVerificationEmailForUser } from "@/lib/email-verification";
import { isPasswordStrongEnough } from "@/lib/password";
import { enforceIpRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const limited = enforceIpRateLimit(req, "register", {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  let body: { email?: string; password?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";
  const name = body.name?.trim();

  if (!email || !password) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  if (!isPasswordStrongEnough(password)) {
    return NextResponse.json({ error: "weak_password" }, { status: 400 });
  }

  const result = await createEmailUser({ email, password, name });

  if (!result.ok) {
    const status =
      result.error === "email_taken" || result.error === "google_account" ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  const origin = new URL(req.url).origin;
  const emailSent = await sendVerificationEmailForUser(result.userId, origin);

  return NextResponse.json({ ok: true, emailSent });
}

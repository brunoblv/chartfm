import { NextResponse } from "next/server";
import { createEmailUser } from "@/lib/email-user";
import { isPasswordStrongEnough } from "@/lib/password";

export async function POST(req: Request) {
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

  return NextResponse.json({ ok: true });
}

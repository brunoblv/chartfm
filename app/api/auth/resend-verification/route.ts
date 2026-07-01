import { NextResponse } from "next/server";
import { sendVerificationEmailByAddress } from "@/lib/email-verification";

export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const email = body.email?.toLowerCase().trim();
  if (!email) {
    return NextResponse.json({ error: "missing_email" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  await sendVerificationEmailByAddress(email, origin);

  return NextResponse.json({
    ok: true,
    message: "Se existir uma conta pendente com este email, enviaremos um novo link de confirmação.",
  });
}

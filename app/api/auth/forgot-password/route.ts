import { NextResponse } from "next/server";
import { appPathUrl } from "@/lib/app-url";
import { generateResetToken, hashResetToken } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { passwordResetEmail, sendEmail } from "@/lib/send-email";

const RESET_TTL_MS = 60 * 60 * 1000;

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

  const user = await prisma.user.findUnique({ where: { email } });

  if (user?.passwordHash) {
    const rawToken = generateResetToken();
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const resetUrl = appPathUrl(
      `/reset-password?token=${encodeURIComponent(rawToken)}`,
      new URL(req.url).origin,
    ).href;

    const { subject, text, html } = passwordResetEmail({
      resetUrl,
      name: user.name,
    });

    await sendEmail({ to: email, subject, text, html });
  }

  return NextResponse.json({
    ok: true,
    message: "Se existir uma conta com este email, enviaremos um link de recuperação.",
  });
}

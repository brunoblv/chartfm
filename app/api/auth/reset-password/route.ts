import { NextResponse } from "next/server";
import { hashPassword, hashResetToken, isPasswordStrongEnough } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  let body: { token?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const token = body.token?.trim();
  const password = body.password ?? "";

  if (!token || !password) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  if (!isPasswordStrongEnough(password)) {
    return NextResponse.json({ error: "weak_password" }, { status: 400 });
  }

  const tokenHash = hashResetToken(token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.expiresAt < new Date()) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.delete({ where: { id: record.id } }),
  ]);

  return NextResponse.json({ ok: true });
}

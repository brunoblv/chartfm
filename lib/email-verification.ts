import { appPathUrl } from "@/lib/app-url";
import { generateResetToken, hashResetToken } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { emailVerificationEmail, sendEmail } from "@/lib/send-email";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

export async function sendVerificationEmailForUser(
  userId: string,
  requestOrigin?: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.email || user.emailVerifiedAt || !user.passwordHash) return false;

  const rawToken = generateResetToken();
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + VERIFY_TTL_MS);

  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
  await prisma.emailVerificationToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  const verifyUrl = appPathUrl(
    `/verify-email?token=${encodeURIComponent(rawToken)}`,
    requestOrigin,
  ).href;

  const { subject, text, html } = emailVerificationEmail({
    verifyUrl,
    name: user.name,
  });

  return sendEmail({ to: user.email, subject, text, html });
}

export async function sendVerificationEmailByAddress(
  email: string,
  requestOrigin?: string,
): Promise<boolean> {
  const normalized = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user?.passwordHash || user.emailVerifiedAt) return false;
  return sendVerificationEmailForUser(user.id, requestOrigin);
}

export async function verifyEmailToken(
  token: string,
): Promise<{ ok: true } | { ok: false; error: "invalid_token" }> {
  const tokenHash = hashResetToken(token);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
  });

  if (!record || record.expiresAt < new Date()) {
    return { ok: false, error: "invalid_token" };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.emailVerificationToken.deleteMany({ where: { userId: record.userId } }),
  ]);

  return { ok: true };
}

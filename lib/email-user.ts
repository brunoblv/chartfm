import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

const ACCENTS = ["#FA243C", "#8338EC", "#3A86FF", "#06D6A0", "#FB5607", "#EF476F"];

function slugifyHandle(part: string) {
  const x = part
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 28);
  return x || "user";
}

async function allocateHandle(base: string): Promise<string> {
  for (let i = 0; i < 200; i++) {
    const h = i === 0 ? base : `${base}${i}`;
    const taken = await prisma.user.findUnique({ where: { handle: h } });
    if (!taken) return h;
  }
  return `${base}${Date.now().toString(36)}`;
}

export type CreateEmailUserResult =
  | { ok: true; isNew: true; userId: string }
  | { ok: false; error: "email_taken" | "google_account" | "invalid_email" | "weak_password" };

export async function createEmailUser(params: {
  email: string;
  password: string;
  name?: string;
}): Promise<CreateEmailUserResult> {
  const email = params.email.toLowerCase().trim();
  if (!email.includes("@")) {
    return { ok: false, error: "invalid_email" };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.googleId && !existing.passwordHash) {
      return { ok: false, error: "google_account" };
    }
    return { ok: false, error: "email_taken" };
  }

  const passwordHash = await hashPassword(params.password);
  const displayName = params.name?.trim() || email.split("@")[0] || "Usuário";
  const base = slugifyHandle(email.split("@")[0] ?? "user");
  const handle = await allocateHandle(base);
  const hash = [...email].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0);
  const avatarColor = ACCENTS[Math.abs(hash) % ACCENTS.length];

  const user = await prisma.user.create({
    data: {
      handle,
      name: displayName,
      email,
      passwordHash,
      avatarColor,
      needsHandle: true,
    },
  });

  return { ok: true, isNew: true, userId: user.id };
}

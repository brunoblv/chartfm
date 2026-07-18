import { prisma } from "@/lib/prisma";

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

function upgradeGooglePhoto(url: string | null | undefined): string | null {
  if (!url) return null;
  // Google photos have =sNN-c at the end — upgrade to 400px for sharper display
  return url.replace(/=s\d+-c(\?.*)?$/, "=s400-c$1");
}

function isCustomUploadedAvatar(url: string | null | undefined): boolean {
  return Boolean(url?.includes("/api/uploads/avatars/"));
}

function isGooglePhoto(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes("googleusercontent.com") || url.includes("ggpht.com");
}

export async function ensureGoogleUser(params: {
  email: string;
  name: string | null | undefined;
  image: string | null | undefined;
  googleId: string;
}) {
  const email = params.email.toLowerCase().trim();
  const displayName = params.name?.trim() || email.split("@")[0] || "Usuário";
  const googleId = params.googleId;
  const image = upgradeGooglePhoto(params.image);

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { googleId }] },
  });

  if (existing) {
    const data: {
      googleId: string;
      email: string;
      emailVerifiedAt: Date;
      image?: string | null;
    } = {
      googleId,
      email,
      emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
    };

    // Não sobrescreve nome/foto personalizados em logins subsequentes.
    if (!existing.image && image) {
      data.image = image;
    } else if (
      existing.image &&
      !isCustomUploadedAvatar(existing.image) &&
      isGooglePhoto(existing.image) &&
      image
    ) {
      data.image = image;
    }

    await prisma.user.update({
      where: { id: existing.id },
      data,
    });
    return { isNew: false, userId: existing.id };
  }

  const base = slugifyHandle(email.split("@")[0] ?? "user");
  const handle = await allocateHandle(base);
  const hash = [...email].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0);
  const avatarColor = ACCENTS[Math.abs(hash) % ACCENTS.length];

  const created = await prisma.user.create({
    data: {
      handle,
      name: displayName,
      email,
      image: image ?? null,
      googleId,
      avatarColor,
      needsHandle: true,
      emailVerifiedAt: new Date(),
    },
  });
  return { isNew: true, userId: created.id };
}

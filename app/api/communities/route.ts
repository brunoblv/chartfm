import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/music-routes";

const MAX_LOGO_DATA_URL_LENGTH = 1_400_000;

function baseSlugFromName(name: string): string {
  const s = slugify(name.trim());
  return s.length >= 2 ? s : "comunidade";
}

async function uniqueSlugForName(name: string): Promise<string> {
  let base = baseSlugFromName(name);
  let candidate = base;
  let n = 2;
  while (await prisma.community.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const tagline = typeof b.tagline === "string" ? b.tagline.trim() : "";
  const icon = typeof b.icon === "string" && b.icon.trim() ? b.icon.trim().slice(0, 8) : "🎵";
  const coverA = typeof b.coverA === "string" && /^#[0-9A-Fa-f]{6}$/.test(b.coverA) ? b.coverA : "#FA243C";
  const coverB = typeof b.coverB === "string" && /^#[0-9A-Fa-f]{6}$/.test(b.coverB) ? b.coverB : "#FF5858";
  const privacy = b.privacy === "private" ? "private" : "public";
  const logoUrl =
    typeof b.logoUrl === "string" && b.logoUrl.startsWith("data:image/") && b.logoUrl.includes("base64,")
      ? b.logoUrl
      : null;

  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: "Nome deve ter entre 2 e 80 caracteres." }, { status: 400 });
  }
  if (tagline.length < 3 || tagline.length > 80) {
    return NextResponse.json({ error: "Descrição curta deve ter entre 3 e 80 caracteres." }, { status: 400 });
  }
  if (logoUrl && logoUrl.length > MAX_LOGO_DATA_URL_LENGTH) {
    return NextResponse.json({ error: "Logo muito grande. Use uma imagem menor (até 1 MB)." }, { status: 400 });
  }

  const slug = await uniqueSlugForName(name);
  const founded = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
  const isPublic = privacy === "public";
  const baseCreateData = {
    slug,
    name,
    tagline,
    icon,
    coverA,
    coverB,
    founded,
    privacy,
    isPublic,
    members: 1,
    posts: 0,
    ownerId: userId,
  };

  try {
    const community = await prisma.$transaction(async (tx) => {
      let created;
      try {
        created = await tx.community.create({
          data: {
            ...baseCreateData,
            ...(logoUrl ? ({ logoUrl } as Record<string, unknown>) : {}),
          } as typeof baseCreateData,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        const unknownLogoArg = message.includes("Unknown argument `logoUrl`");
        if (!unknownLogoArg) throw err;
        created = await tx.community.create({ data: baseCreateData });
      }
      await tx.communityMember.create({
        data: {
          userId,
          communityId: created.id,
          role: "owner",
        },
      });
      return created;
    });

    return NextResponse.json({ slug: community.slug, id: community.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Não foi possível criar a comunidade." }, { status: 500 });
  }
}

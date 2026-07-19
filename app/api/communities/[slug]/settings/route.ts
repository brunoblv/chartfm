import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getCommunityBySlug, isCommunityAdmin } from "@/lib/community-auth";

const MAX_LOGO_DATA_URL_LENGTH = 1_400_000;
const MAX_COVER_DATA_URL_LENGTH = 2_800_000;
const CHART_SIZE_OPTIONS = [10, 15, 20, 25, 30, 40, 50, 75, 100] as const;

function parseCustomPoints(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const pts = raw
    .map((v) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0))
    .slice(0, 100);
  return pts.length ? pts : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const community = await getCommunityBySlug(slug);
  if (!community) {
    return NextResponse.json({ error: "Comunidade não encontrada." }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  const isAdmin = await isCommunityAdmin(community.id, session?.user?.id);

  const members = await prisma.communityMember.findMany({
    where: { communityId: community.id },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    include: {
      user: { select: { id: true, handle: true, name: true, avatarColor: true, image: true } },
    },
  });

  return NextResponse.json({
    id: community.id,
    slug: community.slug,
    name: community.name,
    tagline: community.tagline,
    icon: community.icon,
    logoUrl: community.logoUrl,
    coverA: community.coverA,
    coverB: community.coverB,
    coverImageUrl: community.coverImageUrl,
    privacy: community.privacy,
    isPublic: community.isPublic,
    paradaName: community.paradaName,
    maxSongs: community.maxSongs,
    memberPositionLimit: community.memberPositionLimit,
    pointsMode: community.pointsMode,
    customPoints: community.customPoints,
    isAdmin,
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      user: m.user,
    })),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const community = await getCommunityBySlug(slug);
  if (!community) {
    return NextResponse.json({ error: "Comunidade não encontrada." }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!(await isCommunityAdmin(community.id, userId))) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
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
  const data: Record<string, unknown> = {};

  if (typeof b.paradaName === "string") {
    const name = b.paradaName.trim();
    if (name.length < 2 || name.length > 60) {
      return NextResponse.json({ error: "Nome da parada deve ter entre 2 e 60 caracteres." }, { status: 400 });
    }
    data.paradaName = name;
  }

  if (typeof b.maxSongs === "number") {
    const size = Math.round(b.maxSongs);
    if (!CHART_SIZE_OPTIONS.includes(size as (typeof CHART_SIZE_OPTIONS)[number])) {
      return NextResponse.json({ error: "Tamanho da parada inválido." }, { status: 400 });
    }
    data.maxSongs = size;
  }

  if (b.memberPositionLimit === null) {
    data.memberPositionLimit = null;
  } else if (typeof b.memberPositionLimit === "number") {
    const limit = Math.round(b.memberPositionLimit);
    if (limit < 1 || limit > 100) {
      return NextResponse.json({ error: "Limite de posições deve ser entre 1 e 100." }, { status: 400 });
    }
    data.memberPositionLimit = limit;
  }

  if (b.pointsMode === "member" || b.pointsMode === "custom") {
    data.pointsMode = b.pointsMode;
  }

  if (b.customPoints !== undefined) {
    data.customPoints = parseCustomPoints(b.customPoints);
  }

  if (typeof b.name === "string") {
    const name = b.name.trim();
    if (name.length < 2 || name.length > 80) {
      return NextResponse.json({ error: "Nome da comunidade inválido." }, { status: 400 });
    }
    data.name = name;
  }

  if (typeof b.tagline === "string") {
    const tagline = b.tagline.trim();
    if (tagline.length < 3 || tagline.length > 80) {
      return NextResponse.json({ error: "Descrição inválida." }, { status: 400 });
    }
    data.tagline = tagline;
  }

  if (typeof b.logoUrl === "string") {
    if (b.logoUrl === "") {
      data.logoUrl = null;
    } else if (b.logoUrl.startsWith("data:image/") && b.logoUrl.includes("base64,")) {
      if (b.logoUrl.length > MAX_LOGO_DATA_URL_LENGTH) {
        return NextResponse.json({ error: "Logo muito grande." }, { status: 400 });
      }
      data.logoUrl = b.logoUrl;
    }
  }

  if (typeof b.coverImageUrl === "string") {
    if (b.coverImageUrl === "") {
      data.coverImageUrl = null;
    } else if (b.coverImageUrl.startsWith("data:image/") && b.coverImageUrl.includes("base64,")) {
      if (b.coverImageUrl.length > MAX_COVER_DATA_URL_LENGTH) {
        return NextResponse.json({ error: "Capa muito grande. Use uma imagem menor (até 2 MB)." }, { status: 400 });
      }
      data.coverImageUrl = b.coverImageUrl;
    }
  }

  if (typeof b.coverA === "string" && /^#[0-9A-Fa-f]{6}$/.test(b.coverA)) {
    data.coverA = b.coverA;
  }
  if (typeof b.coverB === "string" && /^#[0-9A-Fa-f]{6}$/.test(b.coverB)) {
    data.coverB = b.coverB;
  }

  if (typeof b.icon === "string" && b.icon.trim()) {
    data.icon = b.icon.trim().slice(0, 8);
  }

  if (b.privacy === "public" || b.privacy === "private") {
    data.privacy = b.privacy;
    data.isPublic = b.privacy === "public";
  }

  if (typeof b.promoteUserId === "string") {
    const targetId = b.promoteUserId;
    const member = await prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: targetId, communityId: community.id } },
    });
    if (!member) {
      return NextResponse.json({ error: "Membro não encontrado." }, { status: 404 });
    }
    if (member.role === "owner") {
      return NextResponse.json({ error: "O dono já tem permissão máxima." }, { status: 400 });
    }
    await prisma.communityMember.update({
      where: { id: member.id },
      data: { role: "admin" },
    });
  }

  if (typeof b.demoteUserId === "string") {
    const targetId = b.demoteUserId;
    const member = await prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: targetId, communityId: community.id } },
    });
    if (!member) {
      return NextResponse.json({ error: "Membro não encontrado." }, { status: 404 });
    }
    if (member.role === "owner") {
      return NextResponse.json({ error: "Não é possível rebaixar o dono." }, { status: 400 });
    }
    await prisma.communityMember.update({
      where: { id: member.id },
      data: { role: "member" },
    });
  }

  if (!Object.keys(data).length && !b.promoteUserId && !b.demoteUserId) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  try {
    const updated =
      Object.keys(data).length > 0
        ? await prisma.community.update({
            where: { id: community.id },
            data,
            select: {
              paradaName: true,
              maxSongs: true,
              memberPositionLimit: true,
              pointsMode: true,
              customPoints: true,
              coverImageUrl: true,
              name: true,
              tagline: true,
              logoUrl: true,
              coverA: true,
              coverB: true,
              icon: true,
              privacy: true,
              isPublic: true,
            },
          })
        : null;

    return NextResponse.json({ ok: true, ...(updated ?? {}) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
  }
}

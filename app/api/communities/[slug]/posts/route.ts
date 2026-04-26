import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function extractYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const direct = raw.match(/^[a-zA-Z0-9_-]{11}$/);
  if (direct) return direct[0];
  const m = raw.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  return m?.[1] ?? null;
}

function pickHex(seed: string, fallback: string): string {
  const clean = seed.replace("#", "");
  if (/^[0-9a-fA-F]{6}$/.test(clean)) return `#${clean.toUpperCase()}`;
  return fallback;
}

export async function GET(_req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const community = await prisma.community.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!community) return NextResponse.json({ error: "Comunidade não encontrada." }, { status: 404 });

  const rows = await prisma.post.findMany({
    where: { communityId: community.id },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, handle: true, name: true, avatarColor: true, image: true } },
      postReplies: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, handle: true, name: true, avatarColor: true, image: true } },
        },
      },
    },
  });

  const posts = rows.map((post) => ({
    id: post.id,
    kind: post.kind,
    text: post.text,
    imageUrl: post.imageUrl,
    imageCaption: post.imageCaption,
    youtubeId: post.youtubeId,
    ytTitle: post.ytTitle,
    ytChannel: post.ytChannel,
    ytThumbA: post.ytThumbA,
    ytThumbB: post.ytThumbB,
    likes: post.likes,
    replies: post.replies,
    shares: post.shares,
    createdAt: post.createdAt.toISOString(),
    user: {
      id: post.user.id,
      handle: post.user.handle,
      name: post.user.name,
      avatarColor: post.user.avatarColor,
      image: post.user.image,
    },
    repliesList: post.postReplies.map((reply) => ({
      id: reply.id,
      text: reply.text,
      likes: reply.likes,
      createdAt: reply.createdAt.toISOString(),
      user: {
        id: reply.user.id,
        handle: reply.user.handle,
        name: reply.user.name,
        avatarColor: reply.user.avatarColor,
        image: reply.user.image,
      },
    })),
  }));

  return NextResponse.json(posts);
}

export async function POST(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { slug } = await context.params;
  const community = await prisma.community.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!community) return NextResponse.json({ error: "Comunidade não encontrada." }, { status: 404 });

  const body = (await req.json()) as {
    kind?: "text" | "image" | "youtube";
    text?: string;
    imageUrl?: string | null;
    youtubeUrl?: string | null;
  };

  const kind = body?.kind ?? "text";
  const text = (body?.text ?? "").trim();
  if (!["text", "image", "youtube"].includes(kind)) return NextResponse.json({ error: "Tipo de post inválido." }, { status: 400 });
  if (!text) return NextResponse.json({ error: "Digite algo no post." }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: "Post muito longo (máx. 2000 caracteres)." }, { status: 400 });

  const imageUrl = kind === "image" && typeof body?.imageUrl === "string" ? body.imageUrl : null;
  const youtubeId = kind === "youtube" ? extractYouTubeId(String(body?.youtubeUrl ?? "")) : null;

  if (kind === "image") {
    if (!imageUrl || !imageUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "Envie uma imagem válida para o post." }, { status: 400 });
    }
    if (imageUrl.length > 1_400_000) {
      return NextResponse.json({ error: "Imagem muito grande (máx. 1 MB)." }, { status: 400 });
    }
  }
  if (kind === "youtube" && !youtubeId) {
    return NextResponse.json({ error: "Link do YouTube inválido." }, { status: 400 });
  }

  const thumbA = youtubeId ? pickHex(youtubeId.slice(0, 6), "#0A0A0A") : null;
  const thumbB = youtubeId ? pickHex(youtubeId.slice(5, 11), "#1A1A1A") : null;

  const [created] = await prisma.$transaction([
    prisma.post.create({
      data: {
        communityId: community.id,
        userId: session.user.id,
        kind,
        text,
        imageUrl: kind === "image" ? imageUrl : null,
        imageCaption: kind === "image" ? text.slice(0, 140) : null,
        youtubeId: kind === "youtube" ? youtubeId : null,
        ytTitle: kind === "youtube" ? "Vídeo do YouTube" : null,
        ytChannel: kind === "youtube" ? "YouTube" : null,
        ytThumbA: kind === "youtube" ? thumbA : null,
        ytThumbB: kind === "youtube" ? thumbB : null,
      },
      include: {
        user: { select: { id: true, handle: true, name: true, avatarColor: true, image: true } },
      },
    }),
    prisma.community.update({ where: { id: community.id }, data: { posts: { increment: 1 } } }),
  ]);

  return NextResponse.json(
    {
      id: created.id,
      kind: created.kind,
      text: created.text,
      imageUrl: created.imageUrl,
      imageCaption: created.imageCaption,
      youtubeId: created.youtubeId,
      ytTitle: created.ytTitle,
      ytChannel: created.ytChannel,
      ytThumbA: created.ytThumbA,
      ytThumbB: created.ytThumbB,
      likes: created.likes,
      replies: created.replies,
      shares: created.shares,
      createdAt: created.createdAt.toISOString(),
      user: {
        id: created.user.id,
        handle: created.user.handle,
        name: created.user.name,
        avatarColor: created.user.avatarColor,
        image: created.user.image,
      },
      repliesList: [],
    },
    { status: 201 },
  );
}

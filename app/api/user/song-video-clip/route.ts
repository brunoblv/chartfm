import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

export const runtime = "nodejs";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 700 * 1024;
const UPLOAD_DIR = join(process.cwd(), "uploads", "song-video-clips");

function ensureDir() {
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const songId = searchParams.get("songId");
  if (!songId) {
    return NextResponse.json({ error: "songId obrigatório" }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Formato inválido. Use JPG, PNG ou WebP." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande (máx. 700 KB)" }, { status: 400 });
  }

  const song = await prisma.song.findUnique({ where: { id: songId }, select: { id: true } });
  if (!song) {
    return NextResponse.json({ error: "Música não encontrada" }, { status: 404 });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const filename = `${session.user.id}_${songId}.${ext}`;
  const imageUrl = `/api/uploads/song-video-clips/${filename}`;

  ensureDir();
  const bytes = await file.arrayBuffer();
  await writeFile(join(UPLOAD_DIR, filename), Buffer.from(bytes));

  // Find existing choice so we can clean up the old clip if needed
  const existingChoice = await prisma.userSongVideoClipChoice.findUnique({
    where: { userId_songId: { userId: session.user.id, songId } },
    select: { clip: { select: { id: true, imageUrl: true, _count: { select: { choices: true } } } } },
  });

  const newClip = await prisma.songVideoClip.create({
    data: { songId, uploadedBy: session.user.id, imageUrl },
  });

  await prisma.userSongVideoClipChoice.upsert({
    where: { userId_songId: { userId: session.user.id, songId } },
    create: { userId: session.user.id, songId, clipId: newClip.id },
    update: { clipId: newClip.id },
  });

  // Remove old clip and file if no other user had chosen it
  if (existingChoice?.clip && existingChoice.clip._count.choices <= 1) {
    await prisma.songVideoClip.delete({ where: { id: existingChoice.clip.id } }).catch(() => null);
    const oldFilename = existingChoice.clip.imageUrl.split("/").pop();
    if (oldFilename) await unlink(join(UPLOAD_DIR, oldFilename)).catch(() => null);
  }

  return NextResponse.json({ url: imageUrl, id: newClip.id });
}

// PUT — escolher um clip existente (de outro usuário) como sua capa
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const songId = searchParams.get("songId");
  const clipId = searchParams.get("clipId");
  if (!songId || !clipId) {
    return NextResponse.json({ error: "songId e clipId obrigatórios" }, { status: 400 });
  }

  const clip = await prisma.songVideoClip.findUnique({
    where: { id: clipId },
    select: { id: true, songId: true },
  });
  if (!clip || clip.songId !== songId) {
    return NextResponse.json({ error: "Clip não encontrado" }, { status: 404 });
  }

  await prisma.userSongVideoClipChoice.upsert({
    where: { userId_songId: { userId: session.user.id, songId } },
    create: { userId: session.user.id, songId, clipId },
    update: { clipId },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const songId = searchParams.get("songId");
  if (!songId) {
    return NextResponse.json({ error: "songId obrigatório" }, { status: 400 });
  }

  const choice = await prisma.userSongVideoClipChoice.findUnique({
    where: { userId_songId: { userId: session.user.id, songId } },
    select: { clip: { select: { id: true, imageUrl: true, _count: { select: { choices: true } } } } },
  });

  if (!choice) {
    return NextResponse.json({ ok: true });
  }

  await prisma.userSongVideoClipChoice.delete({
    where: { userId_songId: { userId: session.user.id, songId } },
  });

  // Remove clip and file if no other user had chosen it
  if (choice.clip._count.choices <= 1) {
    await prisma.songVideoClip.delete({ where: { id: choice.clip.id } }).catch(() => null);
    const oldFilename = choice.clip.imageUrl.split("/").pop();
    if (oldFilename) await unlink(join(UPLOAD_DIR, oldFilename)).catch(() => null);
  }

  return NextResponse.json({ ok: true });
}

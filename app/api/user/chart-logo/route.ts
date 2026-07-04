import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { syncUserPrimaryParadaFields } from "@/lib/paradas";
import { writeFile, unlink, readdir } from "fs/promises";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

export const runtime = "nodejs";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const UPLOAD_DIR = join(process.cwd(), "uploads", "chart-logos");

function ensureDir() {
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
}

function logoFilePrefix(userId: string, paradaId?: string | null) {
  return paradaId ? `${userId}-${paradaId}` : userId;
}

async function deleteOldLogos(prefix: string) {
  try {
    const files = await readdir(UPLOAD_DIR);
    await Promise.all(
      files
        .filter((f) => f.startsWith(`${prefix}.`))
        .map((f) => unlink(join(UPLOAD_DIR, f)).catch(() => null)),
    );
  } catch {
    // dir may not exist yet
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paradaId = req.nextUrl.searchParams.get("paradaId")?.trim() || null;

  if (paradaId) {
    const owned = await prisma.parada.findFirst({
      where: { id: paradaId, userId: session.user.id, deletedAt: null, isCommunityOfficial: false },
      select: { id: true, isPrimary: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Parada não encontrada" }, { status: 404 });
    }
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
    return NextResponse.json({ error: "Arquivo muito grande (máx. 5 MB)" }, { status: 400 });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const prefix = logoFilePrefix(session.user.id, paradaId);
  const filename = `${prefix}.${ext}`;

  try {
    ensureDir();
    await deleteOldLogos(prefix);
    const bytes = await file.arrayBuffer();
    await writeFile(join(UPLOAD_DIR, filename), Buffer.from(bytes));
  } catch (e) {
    console.error("[chart-logo] Erro ao salvar arquivo:", e);
    return NextResponse.json({ error: "Erro ao salvar o arquivo no servidor." }, { status: 500 });
  }

  const url = `/api/uploads/chart-logos/${filename}?v=${Date.now()}`;

  try {
    if (paradaId) {
      const updated = await prisma.parada.update({
        where: { id: paradaId },
        data: { logo: url },
        select: { isPrimary: true },
      });
      if (updated.isPrimary) {
        await syncUserPrimaryParadaFields(prisma, session.user.id);
      }
    } else {
      await prisma.user.update({ where: { id: session.user.id }, data: { paradaLogo: url } });
    }
  } catch (e) {
    console.error("[chart-logo] Erro ao atualizar banco:", e);
    return NextResponse.json({ error: "Erro ao atualizar perfil." }, { status: 500 });
  }

  return NextResponse.json({ url, paradaId });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paradaId = req.nextUrl.searchParams.get("paradaId")?.trim() || null;

  if (paradaId) {
    const owned = await prisma.parada.findFirst({
      where: { id: paradaId, userId: session.user.id, deletedAt: null, isCommunityOfficial: false },
      select: { id: true, isPrimary: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Parada não encontrada" }, { status: 404 });
    }
  }

  const prefix = logoFilePrefix(session.user.id, paradaId);
  await deleteOldLogos(prefix);

  if (paradaId) {
    const updated = await prisma.parada.update({
      where: { id: paradaId },
      data: { logo: null },
      select: { isPrimary: true },
    });
    if (updated.isPrimary) {
      await syncUserPrimaryParadaFields(prisma, session.user.id);
    }
  } else {
    await prisma.user.update({ where: { id: session.user.id }, data: { paradaLogo: null } });
  }

  return NextResponse.json({ ok: true });
}

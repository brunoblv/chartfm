import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { resolveUploadImage } from "@/lib/image-upload";
import { writeFile, unlink, readdir } from "fs/promises";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const UPLOAD_DIR = join(process.cwd(), "uploads", "avatars");

function ensureDir() {
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o755 });
}

async function deleteOldAvatars(userId: string) {
  try {
    const files = await readdir(UPLOAD_DIR);
    await Promise.all(
      files
        .filter((f) => f.startsWith(`${userId}.`))
        .map((f) => unlink(join(UPLOAD_DIR, f)).catch(() => null))
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

  const resolved = resolveUploadImage(file);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande (máx. 5 MB)" }, { status: 400 });
  }

  const filename = `${session.user.id}.${resolved.ext}`;

  try {
    ensureDir();
    await deleteOldAvatars(session.user.id);
    const bytes = await file.arrayBuffer();
    await writeFile(join(UPLOAD_DIR, filename), Buffer.from(bytes));
  } catch (e) {
    console.error("[avatar] Erro ao salvar arquivo:", e);
    return NextResponse.json({ error: "Erro ao salvar o arquivo no servidor." }, { status: 500 });
  }

  const url = `/api/uploads/avatars/${filename}?v=${Date.now()}`;

  try {
    await prisma.user.update({ where: { id: session.user.id }, data: { image: url } });
  } catch (e) {
    console.error("[avatar] Erro ao atualizar banco:", e);
    return NextResponse.json({ error: "Erro ao atualizar perfil." }, { status: 500 });
  }

  return NextResponse.json({ url });
}

export async function DELETE(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteOldAvatars(session.user.id);
  await prisma.user.update({ where: { id: session.user.id }, data: { image: null } });

  return NextResponse.json({ ok: true });
}

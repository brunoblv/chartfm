import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { writeFile, unlink, readdir } from "fs/promises";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

export const runtime = "nodejs";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const UPLOAD_DIR = join(process.cwd(), "public", "uploads", "parada-logos");

function ensureDir() {
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
}

async function deleteOldLogos(userId: string) {
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
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Formato inválido. Use JPG, PNG ou WebP." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande (máx. 5 MB)" }, { status: 400 });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const filename = `${session.user.id}.${ext}`;

  ensureDir();
  await deleteOldLogos(session.user.id);

  const bytes = await file.arrayBuffer();
  await writeFile(join(UPLOAD_DIR, filename), Buffer.from(bytes));

  const url = `/uploads/parada-logos/${filename}?v=${Date.now()}`;
  await prisma.user.update({ where: { id: session.user.id }, data: { paradaLogo: url } });

  return NextResponse.json({ url });
}

export async function DELETE(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteOldLogos(session.user.id);
  await prisma.user.update({ where: { id: session.user.id }, data: { paradaLogo: null } });

  return NextResponse.json({ ok: true });
}

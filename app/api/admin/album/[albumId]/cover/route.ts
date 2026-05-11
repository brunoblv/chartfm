import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { writeFile, unlink, readdir } from "fs/promises";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

export const runtime = "nodejs";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const UPLOAD_DIR = join(process.cwd(), "public", "uploads", "covers");

function ensureDir() {
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
}

async function deleteOldCovers(albumId: number) {
  try {
    const files = await readdir(UPLOAD_DIR);
    await Promise.all(
      files
        .filter((f) => f.startsWith(`album-${albumId}.`))
        .map((f) => unlink(join(UPLOAD_DIR, f)).catch(() => null)),
    );
  } catch {
    // dir may not exist yet
  }
}

async function ensurePrivilegedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, status: 401 };
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return { ok: false as const, status: 403 };
  return { ok: true as const };
}

export async function POST(req: NextRequest, context: { params: Promise<{ albumId: string }> }) {
  const guard = await ensurePrivilegedUser();
  if (!guard.ok)
    return NextResponse.json(
      { error: guard.status === 401 ? "unauthorized" : "forbidden" },
      { status: guard.status },
    );

  const { albumId } = await context.params;
  const id = Number(albumId);
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ error: "invalid_album_id" }, { status: 400 });

  const album = await prisma.album.findUnique({ where: { id }, select: { id: true } });
  if (!album) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type))
    return NextResponse.json({ error: "Formato inválido. Use JPG, PNG ou WebP." }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "Arquivo muito grande (máx. 5 MB)" }, { status: 400 });

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const filename = `album-${id}.${ext}`;

  ensureDir();
  await deleteOldCovers(id);

  const bytes = await file.arrayBuffer();
  await writeFile(join(UPLOAD_DIR, filename), Buffer.from(bytes));

  const url = `/uploads/covers/${filename}?v=${Date.now()}`;
  await prisma.album.update({ where: { id }, data: { coverUrl: url } });

  return NextResponse.json({ url });
}

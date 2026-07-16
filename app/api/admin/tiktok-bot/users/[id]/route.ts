import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBruno } from "@/lib/require-bruno";

// Gestão de perfis do TikTok Growth Bot (só @bruno).

// PATCH /api/admin/tiktok-bot/users/[id] — { active?, banned?, tiktokUsername? }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireBruno())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (!Number.isFinite(userId)) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "payload inválido" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.active === "boolean") data.active = body.active;
  if (typeof body.banned === "boolean") {
    data.banned = body.banned;
    if (body.banned) data.active = false;
  }
  if (typeof body.tiktokUsername === "string") {
    const v = body.tiktokUsername.replace(/^@+/, "").toLowerCase().trim();
    if (!/^[a-z0-9._]{2,24}$/.test(v)) {
      return NextResponse.json({ error: "usuário do TikTok inválido" }, { status: 400 });
    }
    data.tiktokUsername = v;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "nada para atualizar" }, { status: 400 });
  }

  try {
    await prisma.tiktokBotUser.update({ where: { id: userId }, data });
  } catch {
    return NextResponse.json({ error: "usuário não encontrado ou TikTok já cadastrado" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/tiktok-bot/users/[id] — remove o cadastro (e o histórico, via cascade)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireBruno())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (!Number.isFinite(userId)) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  await prisma.tiktokBotUser.delete({ where: { id: userId } }).catch(() => null);
  return NextResponse.json({ ok: true });
}

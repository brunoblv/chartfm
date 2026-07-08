import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// PATCH { active } — pausa/reativa o monitoramento do artista
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as { active?: boolean } | null;
  if (typeof body?.active !== "boolean") {
    return NextResponse.json({ error: "active obrigatório" }, { status: 400 });
  }

  try {
    await prisma.artistReleaseWatch.update({ where: { id }, data: { active: body.active } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }
}

// DELETE — remove o artista do radar (histórico de avisos cascateia)
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const id = parseId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  try {
    await prisma.artistReleaseWatch.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }
}

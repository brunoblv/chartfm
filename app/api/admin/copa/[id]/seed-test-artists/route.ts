import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { seedCopaTestArtists } from "@/lib/copa-seed-test-artists";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "ADMIN" && user?.role !== "DEV") return null;
  return session.user.id;
}

/** POST /api/admin/copa/[id]/seed-test-artists — cadastra 7 artistas aleatórios para teste */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { ownerHandle, count } = body as { ownerHandle?: string; count?: number };

  try {
    const result = await seedCopaTestArtists(prisma, {
      copaId: id,
      ownerHandle,
      count,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao cadastrar artistas de teste";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

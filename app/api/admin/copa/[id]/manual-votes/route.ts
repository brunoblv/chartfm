import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { COPA_MANUAL_VOTE_HANDLES } from "@/lib/copa-manual-vote-users";

// Só o @bruno (e admin) pode registrar votos manuais em nome dos 22 usuários.
async function requireBruno() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, handle: true },
  });
  if (user?.role !== "ADMIN" && user?.role !== "DEV") return null;
  if (user.handle?.toLowerCase() !== "bruno") return null;
  return session.user.id;
}

// POST /api/admin/copa/[id]/manual-votes
// Body: { userId, votes: [{ fixtureId, side }] }
// Registra o voto de um dos 22 usuários em cada disputa aberta selecionada.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adminId = await requireBruno();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const userId = body?.userId as string | undefined;
  const votes = body?.votes as { fixtureId: string; side: "A" | "B" }[] | undefined;
  if (!userId || !Array.isArray(votes) || votes.length === 0) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  // O usuário-alvo precisa ser um dos 22 handles autorizados.
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { handle: true } });
  if (!target || !COPA_MANUAL_VOTE_HANDLES.some((h) => h.toLowerCase() === target.handle?.toLowerCase())) {
    return NextResponse.json({ error: "Usuário não autorizado" }, { status: 400 });
  }

  // Só disputas LIVE desta Copa aceitam voto.
  const fixtureIds = [...new Set(votes.map((v) => v.fixtureId))];
  const liveFixtures = await prisma.copaFixture.findMany({
    where: { id: { in: fixtureIds }, copaId: id, status: "LIVE" },
    select: { id: true },
  });
  const liveIds = new Set(liveFixtures.map((f) => f.id));

  let created = 0;
  let skipped = 0;
  for (const v of votes) {
    if ((v.side !== "A" && v.side !== "B") || !liveIds.has(v.fixtureId)) {
      skipped++;
      continue;
    }
    try {
      await prisma.copaVote.create({ data: { fixtureId: v.fixtureId, userId, side: v.side } });
      created++;
    } catch {
      // @@unique(fixtureId, userId) — já votou nessa disputa.
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, created, skipped });
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { advanceKnockout } from "@/lib/copa-knockout";
import { notifyCopaFixtureOpened } from "@/lib/copa-notifications";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "ADMIN" && user?.role !== "DEV") return null;
  return session.user.id;
}

// PATCH /api/admin/copa/[id]/fixtures/[fid] — set fixture status (LIVE / DONE)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; fid: string }> }) {
  const { id, fid } = await params;
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json();
  const { status } = body as { status: "UPCOMING" | "LIVE" | "DONE" };

  const fixture = await prisma.copaFixture.findUnique({ where: { id: fid } });
  if (!fixture || fixture.copaId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const wasLive = fixture.status === "LIVE";

  const updated = await prisma.copaFixture.update({
    where: { id: fid },
    data: {
      status,
      endedAt: status === "DONE" ? new Date() : undefined,
    },
  });

  if (status === "LIVE" && !wasLive) {
    await notifyCopaFixtureOpened(fid);
  }

  // Ao encerrar um jogo, tenta avançar o chaveamento (grupos → R32 → R16 → QF → SF →
  // Final/3º lugar). Idempotente: só gera a fase seguinte quando a atual termina.
  if (status === "DONE") {
    await advanceKnockout(id);
  }

  return NextResponse.json({ fixture: updated });
}

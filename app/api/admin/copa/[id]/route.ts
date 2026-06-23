import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { GROUP_PAIRS, COPA_GROUP_LETTERS } from "@/lib/copa";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "ADMIN" && user?.role !== "DEV") return null;
  return session.user.id;
}

// PATCH /api/admin/copa/[id] — update status or advance phase
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json();
  const { action } = body as { action: string };

  const copa = await prisma.copaEdition.findUnique({ where: { id } });
  if (!copa) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "start_group_stage") {
    // Create all group-stage fixtures from registered artists
    const artists = await prisma.copaArtist.findMany({
      where: { copaId: id },
      orderBy: [{ groupLetter: "asc" }, { slotInGroup: "asc" }],
    });

    const fixtureData: {
      copaId: string; phase: "GROUP"; groupLetter: string; round: number;
      matchIndex: number; artistAId: string; artistBId: string;
      singleAIdx: number; singleBIdx: number;
    }[] = [];

    let globalMatchIdx = 0;
    for (const letter of COPA_GROUP_LETTERS) {
      const group = artists.filter((a) => a.groupLetter === letter);
      if (group.length < 4) continue;
      GROUP_PAIRS.forEach(([i, j], pairIdx) => {
        const round = pairIdx < 2 ? 1 : pairIdx < 4 ? 2 : 3;
        const singleIdx = round - 1;
        fixtureData.push({
          copaId: id,
          phase: "GROUP",
          groupLetter: letter,
          round,
          matchIndex: globalMatchIdx++,
          artistAId: group[i].id,
          artistBId: group[j].id,
          singleAIdx: singleIdx,
          singleBIdx: singleIdx,
        });
      });
    }

    await prisma.$transaction([
      prisma.copaFixture.createMany({ data: fixtureData }),
      prisma.copaEdition.update({ where: { id }, data: { status: "GROUP_STAGE" } }),
    ]);

    return NextResponse.json({ ok: true, created: fixtureData.length });
  }

  if (action === "start_knockout") {
    await prisma.copaEdition.update({ where: { id }, data: { status: "KNOCKOUT" } });
    return NextResponse.json({ ok: true });
  }

  if (action === "finish") {
    await prisma.copaEdition.update({ where: { id }, data: { status: "FINISHED" } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

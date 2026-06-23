import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { computeStandings, COPA_GROUP_LETTERS } from "@/lib/copa";

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

  const updated = await prisma.copaFixture.update({
    where: { id: fid },
    data: {
      status,
      endedAt: status === "DONE" ? new Date() : undefined,
    },
  });

  // After all group fixtures for all groups are DONE, generate R16 automatically
  if (status === "DONE" && fixture.phase === "GROUP") {
    await maybeGenerateKnockout(id);
  }

  return NextResponse.json({ fixture: updated });
}

async function maybeGenerateKnockout(copaId: string) {
  const groupFixtures = await prisma.copaFixture.findMany({
    where: { copaId, phase: "GROUP" },
    include: { votes: true },
  });

  const allDone = groupFixtures.every((f) => f.status === "DONE");
  if (!allDone) return;

  // Check no R16 exists yet
  const r16Exists = await prisma.copaFixture.count({ where: { copaId, phase: "R16" } });
  if (r16Exists > 0) return;

  const artists = await prisma.copaArtist.findMany({ where: { copaId } });

  // Compute standings per group → top2
  const top2: Record<string, [string, string]> = {};
  for (const letter of COPA_GROUP_LETTERS) {
    const groupArtists = artists.filter((a) => a.groupLetter === letter).map((a) => a.id);
    const groupFixts = groupFixtures.filter((f) => f.groupLetter === letter);
    if (groupArtists.length < 4) continue;
    const standings = computeStandings(groupFixts, groupArtists);
    top2[letter] = [standings[0].artistId, standings[1].artistId];
  }

  // R16 pairing: 1st A vs 2nd B, 1st C vs 2nd D, ... (cross-pairing)
  const letters = COPA_GROUP_LETTERS;
  const r16Data: { copaId: string; phase: "R16"; matchIndex: number; artistAId: string; artistBId: string; singleAIdx: number; singleBIdx: number }[] = [];

  for (let i = 0; i < letters.length; i += 2) {
    const l1 = letters[i], l2 = letters[i + 1];
    if (!top2[l1] || !top2[l2]) continue;
    r16Data.push({ copaId, phase: "R16", matchIndex: i / 2, artistAId: top2[l1][0], artistBId: top2[l2][1], singleAIdx: 3, singleBIdx: 3 });
    r16Data.push({ copaId, phase: "R16", matchIndex: i / 2 + 1, artistAId: top2[l2][0], artistBId: top2[l1][1], singleAIdx: 3, singleBIdx: 3 });
  }

  if (r16Data.length > 0) {
    await prisma.copaFixture.createMany({ data: r16Data });
  }
}

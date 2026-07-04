import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { announceCopaRegistrationOpen } from "@/lib/game-announcements";
import { COPA_PARTICIPANT_OPTIONS, COPA_TOTAL_ARTISTS } from "@/lib/copa";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "ADMIN" && user?.role !== "DEV") return null;
  return session.user.id;
}

// GET /api/admin/copa — list all editions
export async function GET() {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const editions = await prisma.copaEdition.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      participants: { include: { user: { select: { id: true, name: true, handle: true } } } },
      _count: { select: { copaArtists: true, fixtures: true } },
    },
  });

  return NextResponse.json({ editions });
}

// POST /api/admin/copa — create new edition
export async function POST(req: Request) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json();
  const { name, year, maxParticipants } = body as {
    name: string;
    year: number;
    maxParticipants?: number;
  };

  if (!name || !year) {
    return NextResponse.json({ error: "name and year required" }, { status: 400 });
  }

  const resolvedMaxParticipants = maxParticipants ?? 8;
  if (!(COPA_PARTICIPANT_OPTIONS as readonly number[]).includes(resolvedMaxParticipants)) {
    return NextResponse.json(
      { error: `maxParticipants must be one of ${COPA_PARTICIPANT_OPTIONS.join(", ")}` },
      { status: 400 },
    );
  }

  // Editions open in REGISTRATION with no participants — users sign themselves up.
  const copa = await prisma.copaEdition.create({
    data: {
      name,
      year,
      status: "REGISTRATION",
      maxParticipants: resolvedMaxParticipants,
      artistsPerUser: COPA_TOTAL_ARTISTS / resolvedMaxParticipants,
    },
    include: { participants: true },
  });

  await announceCopaRegistrationOpen(copa);

  return NextResponse.json({ copa });
}

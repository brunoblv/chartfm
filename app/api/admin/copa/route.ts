import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

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
  const { name, year, participantUserIds } = body as {
    name: string;
    year: number;
    participantUserIds: string[];
  };

  if (!name || !year || !Array.isArray(participantUserIds) || participantUserIds.length === 0) {
    return NextResponse.json({ error: "name, year, and participantUserIds required" }, { status: 400 });
  }

  const copa = await prisma.copaEdition.create({
    data: {
      name,
      year,
      status: "REGISTRATION",
      maxParticipants: 8,
      artistsPerUser: 8,
      participants: {
        create: participantUserIds.map((uid) => ({ userId: uid })),
      },
    },
    include: { participants: true },
  });

  return NextResponse.json({ copa });
}

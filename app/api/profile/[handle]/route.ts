import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildPublicProfilePayload } from "@/lib/map-db-profile";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, context: { params: Promise<{ handle: string }> }) {
  const { handle: raw } = await context.params;
  const handle = decodeURIComponent(raw ?? "").trim();
  if (!handle) {
    return NextResponse.json({ error: "invalid_handle" }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { handle },
    include: {
      charts: {
        orderBy: { weekIndex: "desc" },
        include: {
          entries: {
            orderBy: { position: "asc" },
            include: { song: true },
          },
        },
      },
    },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(buildPublicProfilePayload(dbUser));
}

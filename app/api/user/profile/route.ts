import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

function normalizeHandle(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_]/g, "");
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      handle: true,
      name: true,
      bio: true,
      paradaNome: true,
      paradaLogo: true,
      genres: true,
      image: true,
      lastfmUser: true,
      twitterUser: true,
      instagramUser: true,
      chartSize: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    name?: string;
    handle?: string;
    bio?: string | null;
    paradaNome?: string | null;
    genres?: string[];
    lastfmUser?: string | null;
    twitterUser?: string | null;
    instagramUser?: string | null;
    chartSize?: number | null;
  };

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const handle = typeof body.handle === "string" ? normalizeHandle(body.handle) : "";
  const bio = typeof body.bio === "string" ? body.bio.trim() : "";
  const paradaNome = typeof body.paradaNome === "string" ? body.paradaNome.trim() : "";
  const lastfmUser = typeof body.lastfmUser === "string" ? body.lastfmUser.trim() : "";
  const twitterUser = typeof body.twitterUser === "string" ? body.twitterUser.trim().replace(/^@/, "") : "";
  const instagramUser = typeof body.instagramUser === "string" ? body.instagramUser.trim().replace(/^@/, "") : "";
  const rawChartSize = typeof body.chartSize === "number" ? Math.round(body.chartSize) : null;
  const chartSize = rawChartSize !== null && rawChartSize >= 1 && rawChartSize <= 100 ? rawChartSize : null;
  const genres = Array.isArray(body.genres)
    ? body.genres.map((g) => String(g).trim()).filter(Boolean).slice(0, 15)
    : [];

  if (name.length < 2) {
    return NextResponse.json({ error: "Nome muito curto" }, { status: 400 });
  }
  if (handle.length < 3) {
    return NextResponse.json({ error: "Handle muito curto" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { handle },
    select: { id: true },
  });
  if (existing && existing.id !== session.user.id) {
    return NextResponse.json({ error: "Handle já está em uso" }, { status: 409 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name,
      handle,
      bio: bio || null,
      paradaNome: paradaNome || null,
      genres,
      lastfmUser: lastfmUser || null,
      twitterUser: twitterUser || null,
      instagramUser: instagramUser || null,
      chartSize,
    },
  });

  return NextResponse.json({ ok: true });
}

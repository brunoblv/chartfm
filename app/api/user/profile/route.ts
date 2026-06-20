import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { ensureUserParadas, getPrimaryParada, syncUserPrimaryParadaFields } from "@/lib/paradas";

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
      spotifyRefreshToken: true,
      youtubeRefreshToken: true,
      youtubeChannelHandle: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const paradas = await ensureUserParadas(prisma, session.user.id);
  const { spotifyRefreshToken, youtubeRefreshToken, youtubeChannelHandle, ...userPublic } = user;

  return NextResponse.json({
    ...userPublic,
    spotifyConnected: Boolean(spotifyRefreshToken),
    youtubeConnected: Boolean(youtubeRefreshToken),
    youtubeChannelHandle: youtubeChannelHandle ?? null,
    paradas,
  });
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

  const update: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (name.length < 2) return NextResponse.json({ error: "Nome muito curto" }, { status: 400 });
    update.name = name;
  }

  if (typeof body.handle === "string") {
    const handle = normalizeHandle(body.handle);
    if (handle.length < 3) return NextResponse.json({ error: "Handle muito curto" }, { status: 400 });
    const existing = await prisma.user.findUnique({ where: { handle }, select: { id: true } });
    if (existing && existing.id !== session.user.id) {
      return NextResponse.json({ error: "Handle já está em uso" }, { status: 409 });
    }
    update.handle = handle;
  }

  if (typeof body.bio === "string") update.bio = body.bio.trim() || null;
  if (typeof body.lastfmUser === "string") update.lastfmUser = body.lastfmUser.trim() || null;
  if (typeof body.twitterUser === "string") update.twitterUser = body.twitterUser.trim().replace(/^@/, "") || null;
  if (typeof body.instagramUser === "string") update.instagramUser = body.instagramUser.trim().replace(/^@/, "") || null;

  const paradaNome = typeof body.paradaNome === "string" ? body.paradaNome.trim() : null;
  if (typeof body.paradaNome === "string") update.paradaNome = paradaNome || null;

  const genres = Array.isArray(body.genres)
    ? body.genres.map((g) => String(g).trim()).filter(Boolean).slice(0, 15)
    : null;
  if (genres !== null) update.genres = genres;

  if (typeof body.chartSize === "number") {
    const raw = Math.round(body.chartSize);
    update.chartSize = raw >= 1 && raw <= 100 ? raw : null;
  } else if (body.chartSize === null) {
    update.chartSize = null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true });
  }

  await prisma.user.update({ where: { id: session.user.id }, data: update });

  const primary = await getPrimaryParada(prisma, session.user.id);
  if (paradaNome || (genres !== null && genres.length > 0)) {
    await prisma.parada.update({
      where: { id: primary.id },
      data: {
        ...(paradaNome ? { name: paradaNome } : {}),
        ...(genres !== null && genres.length > 0 ? { genres } : {}),
      },
    });
    await syncUserPrimaryParadaFields(prisma, session.user.id);
  }

  return NextResponse.json({ ok: true });
}

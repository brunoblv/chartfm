import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { slugify } from "@/lib/music-routes";

export const runtime = "nodejs";

async function ensurePrivilegedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, status: 401 };
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return { ok: false as const, status: 403 };
  return { ok: true as const };
}

type PostBody = { title?: unknown; artistName?: unknown; romanization?: unknown; coverUrl?: unknown };

export async function POST(req: NextRequest) {
  const guard = await ensurePrivilegedUser();
  if (!guard.ok) return NextResponse.json({ error: guard.status === 401 ? "unauthorized" : "forbidden" }, { status: guard.status });

  const body = (await req.json()) as PostBody;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const artistName = typeof body.artistName === "string" ? body.artistName.trim() : "";
  const romanization = typeof body.romanization === "string" ? body.romanization.trim() : "";
  const coverUrl = typeof body.coverUrl === "string" ? body.coverUrl.trim() : "";

  if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });
  if (!artistName) return NextResponse.json({ error: "artist_required" }, { status: 400 });

  const existingArtist = await prisma.artist.findFirst({
    where: { name: { equals: artistName, mode: "insensitive" } },
    select: { spotifyId: true },
  });

  const artistSpotifyId = existingArtist?.spotifyId ?? `manual_${slugify(artistName)}`;

  if (!existingArtist) {
    await prisma.artist.upsert({
      where: { spotifyId: artistSpotifyId },
      update: { name: artistName },
      create: { spotifyId: artistSpotifyId, name: artistName },
    });
  }

  const albumSpotifyId = `manual_${slugify(artistName)}_${slugify(title)}`;

  const existing = await prisma.album.findUnique({ where: { spotifyId: albumSpotifyId } });
  if (existing) return NextResponse.json({ error: "album_already_exists" }, { status: 409 });

  const album = await prisma.album.create({
    data: {
      spotifyId: albumSpotifyId,
      title,
      exhibitionName: romanization || null,
      coverUrl: coverUrl || null,
      artistSpotifyId,
    },
    select: { id: true, title: true, exhibitionName: true, coverUrl: true, spotifyId: true, artist: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ album }, { status: 201 });
}

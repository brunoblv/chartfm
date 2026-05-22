import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { getSpotifyArtistById, searchSpotifyArtist } from "@/lib/spotify-server";

export const runtime = "nodejs";

async function ensurePrivilegedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, status: 401 };
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return { ok: false as const, status: 403 };
  return { ok: true as const };
}

export async function GET(_req: NextRequest, context: { params: Promise<{ artistId: string }> }) {
  const guard = await ensurePrivilegedUser();
  if (!guard.ok) return NextResponse.json({ error: guard.status === 401 ? "unauthorized" : "forbidden" }, { status: guard.status });

  const { artistId } = await context.params;
  const id = Number(artistId);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "invalid_artist_id" }, { status: 400 });

  const artist = await prisma.artist.findUnique({
    where: { id },
    select: { id: true, name: true, exhibitionName: true, imageUrl: true, spotifyId: true },
  });
  if (!artist) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ artist });
}

type PatchBody = { name?: unknown; spotifyId?: unknown; romanization?: unknown; imageUrl?: unknown };

export async function PATCH(req: NextRequest, context: { params: Promise<{ artistId: string }> }) {
  const guard = await ensurePrivilegedUser();
  if (!guard.ok) return NextResponse.json({ error: guard.status === 401 ? "unauthorized" : "forbidden" }, { status: guard.status });

  const { artistId } = await context.params;
  const id = Number(artistId);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "invalid_artist_id" }, { status: 400 });

  const body = (await req.json()) as PatchBody;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const spotifyId = typeof body.spotifyId === "string" ? body.spotifyId.trim() : "";
  const romanization = typeof body.romanization === "string" ? body.romanization.trim() : "";
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
  if (!spotifyId) return NextResponse.json({ error: "spotify_id_required" }, { status: 400 });

  const existing = await prisma.artist.findUnique({ where: { id }, select: { spotifyId: true } });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let artist;
  try {
    artist = await prisma.artist.update({
      where: { id },
      data: { name, spotifyId, exhibitionName: romanization || null, imageUrl: imageUrl || null },
      select: { id: true, name: true, exhibitionName: true, imageUrl: true, spotifyId: true },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "spotify_id_already_exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  await prisma.song.updateMany({
    where: { OR: [{ artistSpotifyId: existing.spotifyId }, { artistSpotifyId: spotifyId }] },
    data: { artist: name },
  });

  return NextResponse.json({ artist });
}

export async function POST(req: NextRequest, context: { params: Promise<{ artistId: string }> }) {
  const guard = await ensurePrivilegedUser();
  if (!guard.ok) return NextResponse.json({ error: guard.status === 401 ? "unauthorized" : "forbidden" }, { status: guard.status });

  const { artistId } = await context.params;
  const id = Number(artistId);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "invalid_artist_id" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { action?: unknown };
  if (body.action !== "refresh-image") return NextResponse.json({ error: "unknown_action" }, { status: 400 });

  const artist = await prisma.artist.findUnique({
    where: { id },
    select: { spotifyId: true, name: true },
  });
  if (!artist) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const result = artist.spotifyId
    ? (await getSpotifyArtistById(artist.spotifyId)) ?? (await searchSpotifyArtist(artist.name))
    : await searchSpotifyArtist(artist.name);

  if (!result?.imageUrl) return NextResponse.json({ error: "image_not_found" }, { status: 404 });

  const updated = await prisma.artist.update({
    where: { id },
    data: { imageUrl: result.imageUrl },
    select: { id: true, imageUrl: true },
  });

  return NextResponse.json({ imageUrl: updated.imageUrl });
}

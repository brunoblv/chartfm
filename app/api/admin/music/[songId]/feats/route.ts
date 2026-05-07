import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";

export const runtime = "nodejs";

async function ensurePrivilegedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, status: 401 };
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return { ok: false as const, status: 403 };
  return { ok: true as const };
}

async function getSongSpotifyId(songId: string) {
  const song = await prisma.song.findUnique({ where: { id: songId }, select: { spotifyId: true } });
  return song ?? null;
}

export async function GET(_req: NextRequest, context: { params: Promise<{ songId: string }> }) {
  const guard = await ensurePrivilegedUser();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: guard.status });

  const { songId } = await context.params;
  const song = await getSongSpotifyId(songId);
  if (!song) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!song.spotifyId) return NextResponse.json({ feats: [] });

  const feats = await prisma.songFeat.findMany({
    where: { songSpotifyId: song.spotifyId },
    select: { id: true, artistSpotifyId: true, artist: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ feats: feats.map((f) => ({ id: f.id, artistSpotifyId: f.artistSpotifyId, artistName: f.artist.name })) });
}

export async function POST(req: NextRequest, context: { params: Promise<{ songId: string }> }) {
  const guard = await ensurePrivilegedUser();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: guard.status });

  const { songId } = await context.params;
  const song = await getSongSpotifyId(songId);
  if (!song) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!song.spotifyId) return NextResponse.json({ error: "song_has_no_spotify_id" }, { status: 400 });

  const body = (await req.json()) as { artistSpotifyId?: unknown };
  const artistSpotifyId = typeof body.artistSpotifyId === "string" ? body.artistSpotifyId.trim() : "";
  if (!artistSpotifyId) return NextResponse.json({ error: "artist_spotify_id_required" }, { status: 400 });

  const artist = await prisma.artist.findUnique({ where: { spotifyId: artistSpotifyId }, select: { spotifyId: true, name: true } });
  if (!artist) return NextResponse.json({ error: "artist_not_found" }, { status: 404 });

  try {
    const feat = await prisma.songFeat.create({
      data: { songSpotifyId: song.spotifyId, artistSpotifyId: artist.spotifyId },
      select: { id: true, artistSpotifyId: true },
    });
    return NextResponse.json({ feat: { id: feat.id, artistSpotifyId: feat.artistSpotifyId, artistName: artist.name } }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unique constraint")) return NextResponse.json({ error: "feat_already_exists" }, { status: 409 });
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ songId: string }> }) {
  const guard = await ensurePrivilegedUser();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: guard.status });

  const { songId } = await context.params;
  const song = await getSongSpotifyId(songId);
  if (!song) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = (await req.json()) as { featId?: unknown };
  const featId = typeof body.featId === "number" ? body.featId : null;
  if (!featId) return NextResponse.json({ error: "feat_id_required" }, { status: 400 });

  try {
    await prisma.songFeat.delete({ where: { id: featId } });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

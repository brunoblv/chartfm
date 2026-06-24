import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { attachSpotifyTrackToAlbum } from "@/lib/attach-spotify-track-to-album";
import { songConflictBody } from "@/lib/duplicate-conflict-payload";

export const runtime = "nodejs";

async function ensurePrivilegedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, status: 401 };
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return { ok: false as const, status: 403 };
  return { ok: true as const };
}

export async function POST(req: NextRequest, context: { params: Promise<{ albumId: string }> }) {
  const guard = await ensurePrivilegedUser();
  if (!guard.ok) return NextResponse.json({ error: guard.status === 401 ? "unauthorized" : "forbidden" }, { status: guard.status });

  const { albumId } = await context.params;
  const id = Number(albumId);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "invalid_album_id" }, { status: 400 });

  const body = (await req.json()) as { trackSpotifyId?: unknown };
  const trackSpotifyId = typeof body.trackSpotifyId === "string" ? body.trackSpotifyId.trim() : "";
  if (!trackSpotifyId) return NextResponse.json({ error: "track_spotify_id_required" }, { status: 400 });

  const result = await attachSpotifyTrackToAlbum(id, trackSpotifyId);
  if (!result.ok) {
    if (result.conflict) {
      return NextResponse.json(songConflictBody(result.conflict), { status: result.status });
    }
    const msg =
      result.error === "track_not_from_this_album"
        ? "Esta faixa não pertence a este álbum no Spotify."
        : result.error === "spotify_metadata_failed"
          ? "Não foi possível obter os dados da faixa no Spotify."
          : result.error;
    return NextResponse.json({ error: result.error, message: msg }, { status: result.status });
  }

  return NextResponse.json({ song: result.song });
}

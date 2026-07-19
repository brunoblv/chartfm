import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { mergeSongs } from "@/lib/song-merge";
import { mergeAlbums } from "@/lib/merge-albums";
import { refreshSnapshotsForSong } from "@/lib/entity-page-snapshot/refresh-song";

export const runtime = "nodejs";

/**
 * Merge de duplicatas a partir de /admin/dados (conflitos SPT etc.).
 * Mantém `keepId` e apaga `dropId`, migrando referências.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    kind?: unknown;
    keepId?: unknown;
    dropId?: unknown;
  };

  const kind = body.kind;
  if (kind !== "music" && kind !== "albums" && kind !== "artists") {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }

  try {
    if (kind === "music") {
      const keepId = typeof body.keepId === "string" ? body.keepId.trim() : "";
      const dropId = typeof body.dropId === "string" ? body.dropId.trim() : "";
      if (!keepId || !dropId || keepId === dropId) {
        return NextResponse.json({ error: "invalid" }, { status: 400 });
      }
      await mergeSongs(keepId, dropId);
      void refreshSnapshotsForSong(keepId);
      return NextResponse.json({ ok: true, keepId });
    }

    if (kind === "albums") {
      const keepId = Number(body.keepId);
      const dropId = Number(body.dropId);
      if (!Number.isInteger(keepId) || !Number.isInteger(dropId) || keepId <= 0 || dropId <= 0 || keepId === dropId) {
        return NextResponse.json({ error: "invalid" }, { status: 400 });
      }
      await mergeAlbums(prisma, keepId, dropId);
      return NextResponse.json({ ok: true, keepId });
    }

    // artists — mesma lógica de /admin/duplicates/artists
    const keepId = Number(body.keepId);
    const dropId = Number(body.dropId);
    if (!Number.isInteger(keepId) || !Number.isInteger(dropId) || keepId <= 0 || dropId <= 0 || keepId === dropId) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const [keep, drop] = await Promise.all([
        tx.artist.findUnique({
          where: { id: keepId },
          select: { id: true, name: true, spotifyId: true, imageUrl: true },
        }),
        tx.artist.findUnique({
          where: { id: dropId },
          select: { id: true, name: true, spotifyId: true, imageUrl: true },
        }),
      ]);
      if (!keep || !drop) throw new Error("not_found");

      await tx.album.updateMany({
        where: { artistSpotifyId: drop.spotifyId },
        data: { artistSpotifyId: keep.spotifyId },
      });
      await tx.song.updateMany({
        where: { artistSpotifyId: drop.spotifyId },
        data: { artistSpotifyId: keep.spotifyId, artist: keep.name },
      });

      const movingFeats = await tx.songFeat.findMany({
        where: { artistSpotifyId: drop.spotifyId },
        select: { songSpotifyId: true },
      });
      for (const feat of movingFeats) {
        await tx.songFeat.upsert({
          where: {
            songSpotifyId_artistSpotifyId: {
              songSpotifyId: feat.songSpotifyId,
              artistSpotifyId: keep.spotifyId,
            },
          },
          update: {},
          create: { songSpotifyId: feat.songSpotifyId, artistSpotifyId: keep.spotifyId },
        });
      }
      await tx.songFeat.deleteMany({ where: { artistSpotifyId: drop.spotifyId } });

      await tx.artist.update({
        where: { id: keep.id },
        data: { imageUrl: keep.imageUrl ?? drop.imageUrl ?? null },
      });
      await tx.artist.delete({ where: { id: drop.id } });
    });

    return NextResponse.json({ ok: true, keepId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "merge_failed";
    if (msg === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { resolveSongReleaseDates } from "@/lib/song-release-dates-backfill";
import { buildSongPath } from "@/lib/music-routes";
import { minhasParadasWhere, semDatasBackfillWhere, withReleaseDatesNotFoundCleared } from "@/app/admin/dados/lib";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Backfill em lote das datas de single/clipe: Wikipedia primeiro (fonte de
 * confiança — datas divergentes sobrescrevem), MusicBrainz como fallback para
 * o que sobrar. Processa poucos por chamada; o cliente repete até acabar.
 */

const MAX_BATCH_SIZE = 2;

function fmtDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

type SongRow = {
  id: string;
  title: string;
  artist: string;
  spotifyId: string | null;
  recordingMbid: string | null;
  singleReleaseDate: Date | null;
  musicVideoReleaseDate: Date | null;
};

const sourceLabel: Record<"wikipedia" | "musicbrainz", string> = { wikipedia: "wiki", musicbrainz: "MB" };

async function processSong(song: SongRow): Promise<{ updated: boolean; summary: string }> {
  const { changes, sources, changedAnything } = await resolveSongReleaseDates(song);

  if (!changedAnything) {
    await prisma.song.update({ where: { id: song.id }, data: { releaseDatesNotFoundAt: new Date() } });
    return { updated: false, summary: "nada encontrado" };
  }

  const parts: string[] = [];
  if (changes.singleReleaseDate) {
    parts.push(`single ${fmtDate(changes.singleReleaseDate)} (${sourceLabel[sources.singleReleaseDate!]})`);
  }
  if (changes.musicVideoReleaseDate) {
    parts.push(`clipe ${fmtDate(changes.musicVideoReleaseDate)} (${sourceLabel[sources.musicVideoReleaseDate!]})`);
  }

  await prisma.song.update({ where: { id: song.id }, data: withReleaseDatesNotFoundCleared(changes) });
  return { updated: true, summary: parts.join(" · ") };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    limit?: unknown;
    scope?: unknown;
  };
  const limit = Math.min(
    MAX_BATCH_SIZE,
    Math.max(1, typeof body.limit === "number" ? Math.floor(body.limit) : MAX_BATCH_SIZE),
  );

  const scope: Prisma.SongWhereInput[] = [semDatasBackfillWhere];
  if (body.scope === "minhas") scope.push(minhasParadasWhere(session.user.id));

  const where: Prisma.SongWhereInput = { AND: scope };

  const songs = await prisma.song.findMany({
    where,
    select: {
      id: true,
      title: true,
      artist: true,
      spotifyId: true,
      recordingMbid: true,
      singleReleaseDate: true,
      musicVideoReleaseDate: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });

  let updated = 0;
  const log: string[] = [];
  const notFound: { id: string; label: string; href: string }[] = [];

  for (const song of songs) {
    const label = `${song.title} — ${song.artist}`;
    try {
      const result = await processSong(song);
      if (result.updated) {
        updated += 1;
        log.push(`✓ ${label}: ${result.summary}`);
      } else {
        notFound.push({
          id: song.id,
          label,
          href: buildSongPath({ id: song.id, title: song.title, artist: song.artist, spotifyId: song.spotifyId }),
        });
        log.push(`— ${label}: nada encontrado`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erro";
      await prisma.song
        .update({ where: { id: song.id }, data: { releaseDatesNotFoundAt: new Date() } })
        .catch(() => null);
      notFound.push({
        id: song.id,
        label,
        href: buildSongPath({ id: song.id, title: song.title, artist: song.artist, spotifyId: song.spotifyId }),
      });
      log.push(`✗ ${label}: ${msg}`);
    }
  }

  const remaining = await prisma.song.count({ where: { AND: scope } });

  return NextResponse.json({
    ok: true,
    processed: songs.length,
    updated,
    remaining,
    log,
    notFound,
  });
}

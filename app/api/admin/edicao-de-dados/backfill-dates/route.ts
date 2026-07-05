import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { getWikipediaSongInfo } from "@/lib/wikipedia";
import {
  findRecordingMbidBySpotifyTrackId,
  getMusicBrainzReleaseDates,
  searchRecordingMbid,
} from "@/lib/musicbrainz";
import { buildSongPath } from "@/lib/music-routes";
import { minhasParadasWhere, semDatasWhere } from "@/app/admin/dados/lib";

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

function sameDay(a: Date | null, b: Date): boolean {
  return a != null && a.getTime() === b.getTime();
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

async function processSong(song: SongRow): Promise<{ updated: boolean; summary: string }> {
  const parts: string[] = [];
  const data: Record<string, unknown> = {};
  let single = song.singleReleaseDate;
  let mv = song.musicVideoReleaseDate;

  // 1) Wikipedia — quando divergente, vale a da Wikipedia
  const wiki = await getWikipediaSongInfo(song.title, song.artist).catch(() => null);
  if (wiki?.singleReleaseDate && !sameDay(single, wiki.singleReleaseDate)) {
    data.singleReleaseDate = wiki.singleReleaseDate;
    parts.push(`single ${fmtDate(wiki.singleReleaseDate)} (wiki)`);
    single = wiki.singleReleaseDate;
  }
  if (wiki?.musicVideoReleaseDate && !sameDay(mv, wiki.musicVideoReleaseDate)) {
    data.musicVideoReleaseDate = wiki.musicVideoReleaseDate;
    parts.push(`clipe ${fmtDate(wiki.musicVideoReleaseDate)} (wiki)`);
    mv = wiki.musicVideoReleaseDate;
  }

  // 2) MusicBrainz — só para o que ainda estiver faltando
  if (!single || !mv) {
    let mbid = song.recordingMbid?.trim() || null;
    if (!mbid && song.spotifyId) {
      mbid = await findRecordingMbidBySpotifyTrackId(song.spotifyId).catch(() => null);
    }
    if (!mbid) mbid = await searchRecordingMbid(song.title, song.artist).catch(() => null);

    if (mbid) {
      if (!song.recordingMbid?.trim()) data.recordingMbid = mbid;
      const dates = await getMusicBrainzReleaseDates(mbid, {
        title: song.title,
        artist: song.artist,
      }).catch(() => ({ singleReleaseDate: null, musicVideoReleaseDate: null }));
      if (!single && dates.singleReleaseDate) {
        data.singleReleaseDate = dates.singleReleaseDate;
        parts.push(`single ${fmtDate(dates.singleReleaseDate)} (MB)`);
      }
      if (!mv && dates.musicVideoReleaseDate) {
        data.musicVideoReleaseDate = dates.musicVideoReleaseDate;
        parts.push(`clipe ${fmtDate(dates.musicVideoReleaseDate)} (MB)`);
      }
    }
  }

  if (Object.keys(data).length > 0) {
    await prisma.song.update({ where: { id: song.id }, data });
    return { updated: true, summary: parts.join(" · ") };
  }
  return { updated: false, summary: "nada encontrado" };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    limit?: unknown;
    scope?: unknown;
    exclude?: unknown;
  };
  const limit = Math.min(
    MAX_BATCH_SIZE,
    Math.max(1, typeof body.limit === "number" ? Math.floor(body.limit) : MAX_BATCH_SIZE),
  );
  const excluded = Array.isArray(body.exclude)
    ? body.exclude.filter((id): id is string => typeof id === "string")
    : [];

  const scope: Prisma.SongWhereInput[] = [semDatasWhere];
  if (body.scope === "minhas") scope.push(minhasParadasWhere(session.user.id));

  const where: Prisma.SongWhereInput = {
    AND: [...scope, ...(excluded.length ? [{ id: { notIn: excluded } }] : [])],
  };

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
    orderBy: [{ artist: "asc" }, { title: "asc" }],
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
      notFound.push({
        id: song.id,
        label,
        href: buildSongPath({ id: song.id, title: song.title, artist: song.artist, spotifyId: song.spotifyId }),
      });
      log.push(`✗ ${label}: ${msg}`);
    }
  }

  const stillExcluded = [...excluded, ...notFound.map((n) => n.id)];
  const remaining = await prisma.song.count({
    where: {
      AND: [...scope, ...(stillExcluded.length ? [{ id: { notIn: stillExcluded } }] : [])],
    },
  });

  return NextResponse.json({
    ok: true,
    processed: songs.length,
    updated,
    remaining,
    log,
    notFound,
  });
}

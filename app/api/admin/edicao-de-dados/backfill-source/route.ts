import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { buildAlbumPath, buildSongPath } from "@/lib/music-routes";
import {
  albumPendenciasWhere,
  artistPendenciasComBioWhere,
  songProblemasWhere,
} from "@/app/admin/dados/lib";
import { ALL_SOURCES, fetchForAlbum, fetchForArtist, fetchForSong, type Source } from "@/lib/edicao-de-dados-source-fetch";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Backfill em lote por tipo de item (música/álbum/artista), rodando UMA fonte
 * ou TODAS as fontes juntas (sequencialmente, com pausa entre chamadas — ver
 * regra de espaçamento de APIs externas). Complementa o SourceFetchButtons
 * (uma fonte, um registro): aqui é uma fonte (ou todas), muitos registros.
 * Cada registro tentado nesta chamada entra em `attemptedIds` — o cliente
 * exclui e não tenta de novo na mesma rodada, mesmo se ainda faltar campo
 * que esta fonte não cobre (evita loop infinito).
 */

type Kind = "music" | "albums" | "artists";

const MAX_BATCH_ALL_SOURCES = 3;
const MAX_BATCH_SINGLE_SOURCE = 8;
const INTER_CALL_DELAY_MS = 200;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Item = { id: string | number; label: string; href: string };

async function loadBatch(kind: Kind, exclude: (string | number)[], limit: number): Promise<Item[]> {
  if (kind === "music") {
    const excludeIds = exclude.filter((id): id is string => typeof id === "string");
    const where = excludeIds.length ? { AND: [songProblemasWhere, { id: { notIn: excludeIds } }] } : songProblemasWhere;
    const rows = await prisma.song.findMany({
      where,
      select: { id: true, title: true, artist: true, spotifyId: true },
      orderBy: [{ artist: "asc" }, { title: "asc" }],
      take: limit,
    });
    return rows.map((s) => ({
      id: s.id,
      label: `${s.artist} — ${s.title}`,
      href: `${buildSongPath({ id: s.id, title: s.title, artist: s.artist, spotifyId: s.spotifyId })}/edit`,
    }));
  }

  if (kind === "albums") {
    const excludeIds = exclude.filter((id): id is number => typeof id === "number");
    const where = excludeIds.length ? { AND: [albumPendenciasWhere, { id: { notIn: excludeIds } }] } : albumPendenciasWhere;
    const rows = await prisma.album.findMany({
      where,
      select: { id: true, title: true, artist: { select: { id: true, name: true } } },
      orderBy: [{ title: "asc" }],
      take: limit,
    });
    return rows.map((a) => ({
      id: a.id,
      label: `${a.artist.name} — ${a.title}`,
      href: `${buildAlbumPath(a.title, a.artist.name, { artistId: a.artist.id, albumId: a.id })}/edit`,
    }));
  }

  const excludeIds = exclude.filter((id): id is number => typeof id === "number");
  const where = excludeIds.length
    ? { AND: [artistPendenciasComBioWhere, { id: { notIn: excludeIds } }] }
    : artistPendenciasComBioWhere;
  const rows = await prisma.artist.findMany({
    where,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: limit,
  });
  return rows.map((a) => ({ id: a.id, label: a.name, href: `/artist/${a.id}/edit` }));
}

async function runSource(kind: Kind, id: string | number, source: Source, force: boolean) {
  if (kind === "music") return fetchForSong(id as string, source, { force });
  if (kind === "albums") return fetchForAlbum(id as number, source, { force });
  return fetchForArtist(id as number, source, { force });
}

async function countRemaining(kind: Kind): Promise<number> {
  if (kind === "music") return prisma.song.count({ where: songProblemasWhere });
  if (kind === "albums") return prisma.album.count({ where: albumPendenciasWhere });
  return prisma.artist.count({ where: artistPendenciasComBioWhere });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    kind?: unknown;
    source?: unknown;
    limit?: unknown;
    exclude?: unknown;
    force?: unknown;
  };

  const kind = body.kind;
  if (kind !== "music" && kind !== "albums" && kind !== "artists") {
    return NextResponse.json({ ok: false, error: "invalid_kind" }, { status: 400 });
  }

  const source = body.source;
  const runAll = source === "all";
  if (!runAll && source !== "lastfm" && source !== "spotify" && source !== "musicbrainz" && source !== "wikipedia" && source !== "bugs") {
    return NextResponse.json({ ok: false, error: "invalid_source" }, { status: 400 });
  }

  const force = body.force === true;
  const maxBatch = runAll ? MAX_BATCH_ALL_SOURCES : MAX_BATCH_SINGLE_SOURCE;
  const limit = Math.min(maxBatch, Math.max(1, typeof body.limit === "number" ? Math.floor(body.limit) : maxBatch));
  const exclude = Array.isArray(body.exclude)
    ? body.exclude.filter((id): id is string | number => typeof id === "string" || typeof id === "number")
    : [];

  const batch = await loadBatch(kind, exclude, limit);
  if (batch.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, updated: 0, remaining: 0, log: [], attemptedIds: [], failedItems: [] });
  }

  const sources: Source[] = runAll ? ALL_SOURCES : [source as Source];
  let updated = 0;
  const log: string[] = [];
  const failedItems: (Item & { reason: string })[] = [];
  const attemptedIds: (string | number)[] = [];

  for (const item of batch) {
    attemptedIds.push(item.id);
    const appliedForItem: string[] = [];
    let hadError = false;

    for (const src of sources) {
      try {
        const result = await runSource(kind, item.id, src, force);
        if ("error" in result) {
          if (result.error !== "spotify_nao_configurado") hadError = true;
          continue;
        }
        if (result.applied.length > 0) appliedForItem.push(...result.applied);
      } catch (err) {
        hadError = true;
        const msg = err instanceof Error ? err.message : String(err);
        log.push(`✗ ${item.label} (${src}): ${msg}`);
      }
      if (sources.length > 1) await sleep(INTER_CALL_DELAY_MS);
    }

    if (appliedForItem.length > 0) {
      updated += 1;
      log.push(`✓ ${item.label}: ${appliedForItem.join(", ")}`);
    } else {
      log.push(`— ${item.label}: nada encontrado`);
      failedItems.push({ ...item, reason: hadError ? "erro na consulta" : "nada encontrado" });
    }
  }

  const remaining = await countRemaining(kind);

  return NextResponse.json({
    ok: true,
    processed: batch.length,
    updated,
    remaining,
    log,
    attemptedIds,
    failedItems,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { isInstrumentalTitle } from "@/lib/is-instrumental-title";
import {
  getBackupLimitedUntil,
  getPrimaryLimitedUntil,
  spotifyConfigured,
  searchSpotifyTracks,
} from "@/lib/spotify-server";
import { runWithSpotifyUserChartsPool } from "@/lib/spotify-user-charts-pool";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache", Expires: "0" };

type TrackResult = {
  spotifyId: string;
  title: string;
  artist: string;
  album: string;
  imageUrl: string | null;
  previewUrl: string | null;
  externalUrl: string | null;
};

async function searchLocalCatalog(q: string, limit: number, artist?: string): Promise<TrackResult[]> {
  const rows = await prisma.song.findMany({
    where: {
      spotifyId: { not: null },
      // Com filtro de artista, o q é buscado só no título — o artista já está fixo.
      ...(artist
        ? {
            artist: { contains: artist, mode: "insensitive" },
            title: { contains: q, mode: "insensitive" },
          }
        : {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { artist: { contains: q, mode: "insensitive" } },
            ],
          }),
    },
    select: {
      title: true,
      artist: true,
      album: true,
      spotifyId: true,
      previewUrl: true,
      spotifyUrl: true,
      albumRef: { select: { coverUrl: true } },
    },
    take: limit,
    orderBy: { title: "asc" },
  });

  return rows
    .filter((r) => !isInstrumentalTitle(r.title))
    .map((r) => ({
      spotifyId: r.spotifyId!,
      title: r.title,
      artist: r.artist,
      album: r.album ?? "",
      imageUrl: r.albumRef?.coverUrl ?? null,
      previewUrl: r.previewUrl ?? null,
      externalUrl: r.spotifyUrl ?? null,
    }));
}

/**
 * Busca de músicas: catálogo local + Spotify pelo SERVIDOR (cache de 30 dias +
 * dedup de chamadas em voo no spotify-server). O browser não recebe mais tokens
 * nem fala com api.spotify.com — todo acesso passa pelo backend.
 *
 * Pool user-charts: se principal + BACKUP estiverem fora, usa BACKUP2 (paradas).
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 200) ?? "";
  const artist = req.nextUrl.searchParams.get("artist")?.trim().slice(0, 120) || undefined;
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(50, Math.max(1, Number(limitRaw) || 12));

  const configured = spotifyConfigured();

  if (q.length < 1) {
    return NextResponse.json({ tracks: [], configured }, { headers: NO_CACHE });
  }

  const dbTracks = await searchLocalCatalog(q, limit, artist);

  // Catálogo cheio (ou filtro por artista com resultados) → não bate no Spotify.
  if (!configured || dbTracks.length >= limit || (artist && dbTracks.length > 0)) {
    return NextResponse.json({ tracks: dbTracks.slice(0, limit), configured }, { headers: NO_CACHE });
  }

  const spotifyQuery = artist ? `${q} artist:"${artist}"` : q;
  const bothLimited =
    Date.now() < getPrimaryLimitedUntil() && Date.now() < getBackupLimitedUntil();

  // Complementa com Spotify no pool de paradas (principal → backup → BACKUP2).
  // maxAttempts 1 + prazo curto: evita 504 no nginx quando a API está em 429.
  const spotifyTracks = await runWithSpotifyUserChartsPool(() =>
    searchSpotifyTracks(spotifyQuery, limit, "BR", req.signal, {
      maxAttempts: 1,
      deadlineAt: Date.now() + 8_000,
    }),
  );

  const seen = new Set(dbTracks.map((t) => t.spotifyId));
  const merged: TrackResult[] = [...dbTracks];
  for (const t of spotifyTracks) {
    if (seen.has(t.spotifyId) || isInstrumentalTitle(t.title)) continue;
    seen.add(t.spotifyId);
    merged.push({
      spotifyId: t.spotifyId,
      title: t.title,
      artist: t.artist,
      album: t.album,
      imageUrl: t.imageUrl,
      previewUrl: t.previewUrl,
      externalUrl: t.externalUrl,
    });
    if (merged.length >= limit) break;
  }

  return NextResponse.json(
    {
      tracks: merged,
      configured,
      ...(merged.length === 0 && bothLimited
        ? { unavailable: true, error: "Spotify em rate limit. Tente de novo em alguns minutos." }
        : {}),
    },
    { headers: NO_CACHE },
  );
}

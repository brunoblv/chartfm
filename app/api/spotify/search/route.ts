import { NextRequest, NextResponse } from "next/server";
import { searchSpotifyTracks, spotifyConfigured } from "@/lib/spotify-server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type TrackResult = {
  spotifyId: string;
  title: string;
  artist: string;
  album: string;
  imageUrl: string | null;
  previewUrl: string | null;
  externalUrl: string | null;
};

async function searchLocalCatalog(q: string, limit: number): Promise<TrackResult[]> {
  const rows = await prisma.song.findMany({
    where: {
      spotifyId: { not: null },
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { artist: { contains: q, mode: "insensitive" } },
      ],
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

  return rows.map((r) => ({
    spotifyId: r.spotifyId!,
    title: r.title,
    artist: r.artist,
    album: r.album ?? "",
    imageUrl: r.albumRef?.coverUrl ?? null,
    previewUrl: r.previewUrl ?? null,
    externalUrl: r.spotifyUrl ?? null,
  }));
}

function spotifyWithTimeout(q: string, limit: number, ms: number): Promise<TrackResult[] | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    searchSpotifyTracks(q, limit)
      .then((tracks) => {
        clearTimeout(timer);
        resolve(
          tracks.map((t) => ({
            spotifyId: t.spotifyId,
            title: t.title,
            artist: t.artist,
            album: t.album,
            imageUrl: t.imageUrl ?? null,
            previewUrl: t.previewUrl ?? null,
            externalUrl: t.externalUrl,
          })),
        );
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
  });
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 200) ?? "";
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(50, Math.max(1, Number(limitRaw) || 12));

  if (q.length < 1) {
    return NextResponse.json({ tracks: [], configured: spotifyConfigured() });
  }

  // DB search (sempre rápido) e Spotify em paralelo com cap de 5s
  const [dbTracks, spotifyTracks] = await Promise.all([
    searchLocalCatalog(q, limit),
    spotifyWithTimeout(q, limit, 5000),
  ]);

  // Merge: DB primeiro, depois resultados Spotify não presentes no DB
  const seen = new Set(dbTracks.map((t) => t.spotifyId));
  const merged: TrackResult[] = [...dbTracks];

  if (spotifyTracks) {
    for (const t of spotifyTracks) {
      if (seen.has(t.spotifyId)) continue;
      seen.add(t.spotifyId);
      merged.push(t);
      if (merged.length >= limit) break;
    }
  }

  return NextResponse.json({ tracks: merged.slice(0, limit), configured: spotifyConfigured() });
}

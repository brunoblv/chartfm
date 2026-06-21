import { NextRequest, NextResponse } from "next/server";
import { spotifyConfigured, getAccessToken } from "@/lib/spotify-server";
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

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 200) ?? "";
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(50, Math.max(1, Number(limitRaw) || 12));

  const configured = spotifyConfigured();

  if (q.length < 1) {
    return NextResponse.json({ tracks: [], configured, accessToken: null });
  }

  // DB search + token fetch em paralelo (ambos rápidos)
  const [dbTracks, accessToken] = await Promise.all([
    searchLocalCatalog(q, limit),
    configured ? getAccessToken() : Promise.resolve(null),
  ]);

  return NextResponse.json({
    tracks: dbTracks.slice(0, limit),
    configured,
    // Token de curta duração — o browser usa para chamar a API do Spotify diretamente,
    // evitando a latência do servidor para api.spotify.com
    accessToken: accessToken ?? null,
  });
}

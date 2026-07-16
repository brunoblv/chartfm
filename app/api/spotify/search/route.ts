import { NextRequest, NextResponse } from "next/server";
import { isInstrumentalTitle } from "@/lib/is-instrumental-title";
import { spotifyConfigured, getAccessToken, getBackupAccessToken } from "@/lib/spotify-server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 200) ?? "";
  const artist = req.nextUrl.searchParams.get("artist")?.trim().slice(0, 120) || undefined;
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(50, Math.max(1, Number(limitRaw) || 12));

  const configured = spotifyConfigured();

  if (q.length < 1) {
    return NextResponse.json({ tracks: [], configured, accessToken: null }, { headers: NO_CACHE });
  }

  // DB search + tokens em paralelo (ambos rápidos)
  const [dbTracks, accessToken, accessTokenBackup] = await Promise.all([
    searchLocalCatalog(q, limit, artist),
    configured ? getAccessToken() : Promise.resolve(null),
    configured ? getBackupAccessToken() : Promise.resolve(null),
  ]);

  return NextResponse.json(
    {
      tracks: dbTracks.slice(0, limit),
      configured,
      // Tokens de curta duração — o browser usa para chamar a API do Spotify diretamente,
      // evitando a latência do servidor; o backup entra quando o principal responde 429.
      accessToken: accessToken ?? null,
      accessTokenBackup: accessTokenBackup ?? null,
    },
    { headers: NO_CACHE },
  );
}

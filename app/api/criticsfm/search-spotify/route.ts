import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchSpotifyAlbums, getSpotifyAlbumDetails, getSpotifyArtistById } from "@/lib/spotify-server";
import { AlbumType } from "@prisma/client";
import { findConflictingAlbum } from "@/lib/duplicate-registration-guards";

function mapAlbumType(raw: string | null): AlbumType | undefined {
  if (!raw) return undefined;
  const v = raw.toUpperCase();
  if (v === "SINGLE" || v === "EP" || v === "ALBUM" || v === "COMPILATION") return v as AlbumType;
  return undefined;
}

// GET /api/criticsfm/search-spotify?q=...
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ results: [] });

  const spotifyResults = await searchSpotifyAlbums(q, 8);
  if (!spotifyResults.length) return NextResponse.json({ results: [] });

  const spotifyIds = spotifyResults.map((r) => r.spotifyId);
  const existing = await prisma.album.findMany({
    where: { spotifyId: { in: spotifyIds } },
    select: { id: true, spotifyId: true },
  });
  const dbMap = new Map(existing.map((a) => [a.spotifyId, a.id]));

  const results = spotifyResults.map((r) => ({
    ...r,
    dbId: dbMap.get(r.spotifyId) ?? null,
    inDb: dbMap.has(r.spotifyId),
  }));

  return NextResponse.json({ results });
}

// POST /api/criticsfm/search-spotify  { spotifyAlbumId }
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { spotifyAlbumId?: string };
  const spotifyAlbumId = body.spotifyAlbumId?.trim();
  if (!spotifyAlbumId) return NextResponse.json({ error: "missing_spotify_album_id" }, { status: 400 });

  // Se já existe no BD, retorna direto
  const existing = await prisma.album.findUnique({
    where: { spotifyId: spotifyAlbumId },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ id: existing.id });

  // Busca detalhes completos do álbum no Spotify (inclui artistSpotifyId)
  const details = await getSpotifyAlbumDetails(spotifyAlbumId);
  if (!details) return NextResponse.json({ error: "not_found_on_spotify" }, { status: 404 });

  const artistSpotifyId = details.artistSpotifyId;
  if (!artistSpotifyId) return NextResponse.json({ error: "artist_not_resolved" }, { status: 422 });

  // Upsert artista
  const artistProfile = await getSpotifyArtistById(artistSpotifyId);
  await prisma.artist.upsert({
    where: { spotifyId: artistSpotifyId },
    update: {
      name: artistProfile?.name ?? details.artistName ?? "Artista",
      genres: artistProfile?.genres ?? [],
      ...(artistProfile?.spotifyUrl ? { spotifyUrl: artistProfile.spotifyUrl } : {}),
      ...(artistProfile?.imageUrl ? { imageUrl: artistProfile.imageUrl } : {}),
    },
    create: {
      spotifyId: artistSpotifyId,
      name: artistProfile?.name ?? details.artistName ?? "Artista",
      genres: artistProfile?.genres ?? [],
      spotifyUrl: artistProfile?.spotifyUrl ?? null,
      imageUrl: artistProfile?.imageUrl ?? null,
    },
  });

  // Já existe um álbum do mesmo artista com o mesmo nome (spotifyId diferente, ex.: outra edição)?
  const conflicting = await findConflictingAlbum(prisma, {
    artistSpotifyId,
    titles: [details.title],
  });
  if (conflicting) return NextResponse.json({ id: conflicting.id });

  // Upsert álbum
  const album = await prisma.album.upsert({
    where: { spotifyId: spotifyAlbumId },
    update: {},
    create: {
      spotifyId: spotifyAlbumId,
      title: details.title,
      artistSpotifyId,
      albumType: mapAlbumType(details.albumType),
      releaseDate: details.releaseDate ? new Date(`${details.releaseDate}T00:00:00.000Z`) : null,
      coverUrl: details.coverUrl ?? null,
      spotifyUrl: details.spotifyUrl ?? null,
      totalTracks: details.totalTracks ?? null,
      label: details.label ?? null,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: album.id });
}

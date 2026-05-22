import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface LookupItem {
  artist: string;
  title: string;
}

// POST /api/albums/batch-lookup
// Body: { albums: { artist: string, title: string }[] }
// Returns: { [key: "artist - title"]: { albumType, releaseDate, coverUrl } }
export async function POST(req: NextRequest) {
  let body: { albums?: LookupItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const albums = body.albums;
  if (!Array.isArray(albums) || albums.length === 0) {
    return NextResponse.json({});
  }

  const limited = albums.slice(0, 500);

  const rows = await prisma.album.findMany({
    where: {
      OR: limited.map(({ artist, title }) => ({
        AND: [
          {
            OR: [
              { title: { contains: title, mode: "insensitive" } },
              { exhibitionName: { contains: title, mode: "insensitive" } },
            ],
          },
          {
            artist: { name: { contains: artist, mode: "insensitive" } },
          },
        ],
      })),
    },
    select: {
      title: true,
      exhibitionName: true,
      albumType: true,
      releaseDate: true,
      coverUrl: true,
      artist: { select: { name: true } },
    },
  });

  // Build response map keyed by "artist - title" (lowercase, normalized)
  const result: Record<string, { albumType: string | null; releaseDate: string | null; coverUrl: string | null }> = {};

  for (const row of rows) {
    // Match against every requested lookup to find which key it answers
    for (const { artist, title } of limited) {
      const dbTitle = (row.exhibitionName ?? row.title).toLowerCase();
      const dbArtist = row.artist.name.toLowerCase();
      const reqTitle = title.toLowerCase();
      const reqArtist = artist.toLowerCase();

      if (
        (dbTitle.includes(reqTitle) || reqTitle.includes(dbTitle)) &&
        (dbArtist.includes(reqArtist) || reqArtist.includes(dbArtist))
      ) {
        const key = `${reqArtist} - ${reqTitle}`;
        if (!result[key]) {
          result[key] = {
            albumType: row.albumType ?? null,
            releaseDate: row.releaseDate
              ? row.releaseDate.toISOString().split("T")[0]
              : null,
            coverUrl: row.coverUrl ?? null,
          };
        }
      }
    }
  }

  return NextResponse.json(result);
}

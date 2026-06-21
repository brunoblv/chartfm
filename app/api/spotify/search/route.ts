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

type SpotifyOutcome =
  | { status: "ok"; tracks: TrackResult[] }
  | { status: "timeout" }
  | { status: "error"; reason: string };

function spotifyWithTimeout(q: string, limit: number, ms: number): Promise<SpotifyOutcome> {
  return new Promise((resolve) => {
    const ac = new AbortController();
    const timer = setTimeout(() => {
      ac.abort();
      console.error(`[spotify/search] timeout after ${ms}ms for query="${q}"`);
      resolve({ status: "timeout" });
    }, ms);
    searchSpotifyTracks(q, limit, "BR", ac.signal)
      .then((tracks) => {
        clearTimeout(timer);
        resolve({
          status: "ok",
          tracks: tracks.map((t) => ({
            spotifyId: t.spotifyId,
            title: t.title,
            artist: t.artist,
            album: t.album,
            imageUrl: t.imageUrl ?? null,
            previewUrl: t.previewUrl ?? null,
            externalUrl: t.externalUrl,
          })),
        });
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        const reason = err instanceof Error ? err.message : String(err);
        console.error(`[spotify/search] error for query="${q}": ${reason}`);
        resolve({ status: "error", reason });
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

  const configured = spotifyConfigured();
  if (!configured) {
    console.error("[spotify/search] SPOTIFY_CLIENT_ID ou SPOTIFY_CLIENT_SECRET não configurados");
  }

  // DB search (sempre rápido) e Spotify em paralelo com cap de 9s
  const [dbTracks, spotifyOutcome] = await Promise.all([
    searchLocalCatalog(q, limit),
    spotifyWithTimeout(q, limit, 9000),
  ]);

  if (spotifyOutcome.status !== "ok") {
    console.error(`[spotify/search] spotify_status="${spotifyOutcome.status}" query="${q}" db_count=${dbTracks.length}`);
  } else if (spotifyOutcome.tracks.length === 0) {
    console.warn(`[spotify/search] spotify retornou 0 tracks para query="${q}"`);
  }

  // Merge: DB primeiro, depois resultados Spotify não presentes no DB
  const seen = new Set(dbTracks.map((t) => t.spotifyId));
  const merged: TrackResult[] = [...dbTracks];

  if (spotifyOutcome.status === "ok") {
    for (const t of spotifyOutcome.tracks) {
      if (seen.has(t.spotifyId)) continue;
      seen.add(t.spotifyId);
      merged.push(t);
      if (merged.length >= limit) break;
    }
  }

  const _debug = {
    spotifyStatus: spotifyOutcome.status,
    dbCount: dbTracks.length,
    spotifyCount: spotifyOutcome.status === "ok" ? spotifyOutcome.tracks.length : 0,
    mergedCount: merged.length,
  };

  return NextResponse.json({ tracks: merged.slice(0, limit), configured, _debug });
}

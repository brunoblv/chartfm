import { NextRequest, NextResponse } from "next/server";
import { searchSpotifyTracks, spotifyConfigured } from "@/lib/spotify-server";

export const runtime = "nodejs";
const SPOTIFY_SEARCH_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("spotify_search_timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 200) ?? "";
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(50, Math.max(1, Number(limitRaw) || 12));

  if (q.length < 1) {
    return NextResponse.json({ tracks: [], configured: spotifyConfigured() });
  }

  if (!spotifyConfigured()) {
    return NextResponse.json({
      tracks: [],
      configured: false,
      message: "Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env",
    });
  }

  try {
    const tracks = await withTimeout(searchSpotifyTracks(q, limit), SPOTIFY_SEARCH_TIMEOUT_MS);
    return NextResponse.json({ tracks, configured: true });
  } catch (err) {
    const isTimeout = err instanceof Error && err.message === "spotify_search_timeout";
    return NextResponse.json(
      { tracks: [], configured: true, error: isTimeout ? "spotify_request_timeout" : "spotify_request_failed" },
      { status: isTimeout ? 504 : 502 }
    );
  }
}

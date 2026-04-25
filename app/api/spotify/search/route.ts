import { NextRequest, NextResponse } from "next/server";
import { searchSpotifyTracks, spotifyConfigured } from "@/lib/spotify-server";

export const runtime = "nodejs";

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
    const tracks = await searchSpotifyTracks(q, limit);
    return NextResponse.json({ tracks, configured: true });
  } catch {
    return NextResponse.json(
      { tracks: [], configured: true, error: "spotify_request_failed" },
      { status: 502 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { lastfmSearchApiConfigured, searchLastfmTracks } from "@/lib/lastfm-search";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 200) ?? "";
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(20, Math.max(1, Number(limitRaw) || 12));
  const coverFallback =
    req.nextUrl.searchParams.get("coverFallback") === "1" ||
    req.nextUrl.searchParams.get("coverFallback") === "true";

  if (q.length < 1) {
    return NextResponse.json({ tracks: [], configured: lastfmSearchApiConfigured() });
  }

  if (!lastfmSearchApiConfigured()) {
    return NextResponse.json({
      tracks: [],
      configured: false,
      message: "Defina API_KEY (Last.fm) no arquivo .env",
    });
  }

  try {
    const tracks = await searchLastfmTracks(q, limit, { coverFallback });
    return NextResponse.json({ tracks, configured: true });
  } catch (err) {
    return NextResponse.json(
      { tracks: [], configured: true, error: String(err) },
      { status: 502 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { lastfmSearchApiConfigured, searchLastfmTracks } from "@/lib/lastfm-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache", Expires: "0" };

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 200) ?? "";
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(20, Math.max(1, Number(limitRaw) || 12));

  if (q.length < 1) {
    return NextResponse.json({ tracks: [], configured: lastfmSearchApiConfigured() }, { headers: NO_CACHE });
  }

  if (!lastfmSearchApiConfigured()) {
    return NextResponse.json(
      { tracks: [], configured: false, message: "Defina API_KEY (Last.fm) no arquivo .env" },
      { headers: NO_CACHE },
    );
  }

  try {
    const tracks = await searchLastfmTracks(q, limit);
    return NextResponse.json({ tracks, configured: true }, { headers: NO_CACHE });
  } catch (err) {
    return NextResponse.json(
      { tracks: [], configured: true, error: String(err) },
      { status: 502, headers: NO_CACHE },
    );
  }
}

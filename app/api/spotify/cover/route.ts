import { NextRequest, NextResponse } from "next/server";
import { resolveCoverImageUrl, spotifyConfigured } from "@/lib/spotify-server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title")?.trim().slice(0, 200) ?? "";
  const artist = req.nextUrl.searchParams.get("artist")?.trim().slice(0, 200) ?? "";

  if (!title || !artist) {
    return NextResponse.json({ url: null, configured: spotifyConfigured() });
  }

  if (!spotifyConfigured()) {
    return NextResponse.json({ url: null, configured: false });
  }

  try {
    const url = await resolveCoverImageUrl(artist, title);
    return NextResponse.json({ url, configured: true });
  } catch {
    return NextResponse.json({ url: null, configured: true, error: "lookup_failed" }, { status: 502 });
  }
}

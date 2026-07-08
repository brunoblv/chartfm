import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { searchSpotifyArtists } from "@/lib/spotify-server";

export const runtime = "nodejs";

// GET /api/admin/release-radar/search?q= — busca artistas no Spotify para adicionar ao radar
export async function GET(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ artists: [] });

  const artists = await searchSpotifyArtists(q, 8, "BR");
  return NextResponse.json({ artists });
}

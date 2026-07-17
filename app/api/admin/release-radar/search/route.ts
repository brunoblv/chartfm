import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { searchSpotifyArtists, spotifyConfigured } from "@/lib/spotify-server";

export const runtime = "nodejs";
export const maxDuration = 20;

// GET /api/admin/release-radar/search?q= — busca artistas no Spotify para adicionar ao radar
export async function GET(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ artists: [] });

  if (!spotifyConfigured()) {
    return NextResponse.json({ error: "Spotify não configurado", artists: [] }, { status: 503 });
  }

  try {
    // maxAttempts 1 + prazo curto: sob 429 o spotifyFetch não dorme minutos e o nginx não devolve 504 HTML.
    const artists = await searchSpotifyArtists(q, 8, "BR", {
      maxAttempts: 1,
      deadlineAt: Date.now() + 8_000,
    });
    if (artists.length === 0) {
      return NextResponse.json({
        artists: [],
        error: "Nenhum artista encontrado (ou Spotify temporariamente indisponível / rate limit).",
      });
    }
    return NextResponse.json({ artists });
  } catch (err) {
    console.error("[admin/release-radar/search]", err);
    return NextResponse.json(
      { error: "Falha ao buscar no Spotify", artists: [] },
      { status: 502 },
    );
  }
}

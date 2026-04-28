import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { fetchRecentTracks } from "@/lib/lastfm";
import { scoreLastfmTracks } from "@/lib/lastfm-chart-engine";
import { searchSpotifyTracks, spotifyConfigured } from "@/lib/spotify-server";

export const runtime = "nodejs";
export const maxDuration = 60;

type EnrichedSong = {
  title: string;
  artist: string;
  album: string;
  spotifyId: string | null;
  imageUrl: string | null;
};

async function enrichBatch(
  items: Array<{ track: string; artist: string; album: string }>,
): Promise<EnrichedSong[]> {
  return Promise.all(
    items.map(async (item) => {
      const matches = await searchSpotifyTracks(`${item.track} ${item.artist}`, 1);
      const m = matches[0];
      if (m) {
        return { title: m.title, artist: m.artist, album: m.album, spotifyId: m.spotifyId, imageUrl: m.imageUrl ?? null };
      }
      return { title: item.track, artist: item.artist, album: item.album, spotifyId: null, imageUrl: null };
    }),
  );
}

// POST /api/lastfm/import — exclusivo para @bruno
// Busca Last.fm (28 dias), pontua, enriquece com Spotify em paralelo (batches de 8), retorna top 100.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.handle || session.user.handle !== "bruno") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!spotifyConfigured()) {
    return NextResponse.json({ error: "Spotify não configurado" }, { status: 503 });
  }

  try {
    const trackPlays = await fetchRecentTracks(28);
    const top200 = scoreLastfmTracks(trackPlays, new Date(), 200);

    const BATCH = 8;
    const enriched: EnrichedSong[] = [];
    for (let i = 0; i < top200.length; i += BATCH) {
      const batch = await enrichBatch(top200.slice(i, i + BATCH));
      enriched.push(...batch);
    }

    const songs = enriched.slice(0, 200);
    return NextResponse.json({ songs, total: top200.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

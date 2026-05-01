import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { chartWeekUnixRangeFromAnchor, getChartWeekRange, parseChartWeekPickerDate } from "@/lib/chart-week";
import { fetchRecentTracks, fetchTracksBetweenUnix } from "@/lib/lastfm";
import { scoreLastfmTracks } from "@/lib/lastfm-chart-engine";
import { searchSpotifyTracks, spotifyConfigured } from "@/lib/spotify-server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

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
// Body: { weekDate?: "YYYY-MM-DD" } — semana (seg–dom) dessa data; sem weekDate = últimos 28 dias.
// As duas rotas usam scoreLastfmTracks: (últimos 7d ×5)+(8–14d ×3)+(15–21d ×2)+(22–28d ×1) em relação à âncora.
// Na semana escolhida, a âncora é o domingo fim da parada (blocos de 7 dias vs. essa data).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.handle || session.user.handle !== "bruno") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!spotifyConfigured()) {
    return NextResponse.json({ error: "Spotify não configurado" }, { status: 503 });
  }

  let body: { weekDate?: unknown; recentDays?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const weekDateStr = typeof body.weekDate === "string" ? body.weekDate.trim() : "";
  const useWeek = /^\d{4}-\d{2}-\d{2}$/.test(weekDateStr);

  try {
    let top200: Array<{ track: string; artist: string; album: string; score: number }>;

    if (useWeek) {
      const anchor = parseChartWeekPickerDate(weekDateStr);
      if (!anchor) {
        return NextResponse.json({ error: "Data da semana inválida" }, { status: 400 });
      }
      if (anchor.getTime() > Date.now()) {
        return NextResponse.json({ error: "Não é possível importar semana futura" }, { status: 400 });
      }
      const { from, toExclusive } = chartWeekUnixRangeFromAnchor(anchor);
      const weekPlays = await fetchTracksBetweenUnix(from, toExclusive);
      const { end: weekEnd } = getChartWeekRange(anchor);
      const scoreAnchor = new Date(Date.UTC(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate()));
      top200 = scoreLastfmTracks(weekPlays, scoreAnchor, 200);
    } else {
      const days = typeof body.recentDays === "number" && body.recentDays > 0 && body.recentDays <= 90 ? body.recentDays : 28;
      const recentPlays = await fetchRecentTracks(days);
      top200 = scoreLastfmTracks(recentPlays, new Date(), 200);
    }

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

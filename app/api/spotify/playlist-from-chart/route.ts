import { NextRequest, NextResponse } from "next/server";
import { requireSpotifySession } from "@/lib/mytrl-access-server";
import { prisma } from "@/lib/prisma";
import {
  addTracksToSpotifyPlaylist,
  createSpotifyPlaylist,
  getSpotifyUserAccessToken,
} from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

// POST /api/spotify/playlist-from-chart
// Body: { chartId: string; isPublic?: boolean }
export async function POST(req: NextRequest) {
  const session = await requireSpotifySession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403, headers: NO_CACHE });
  }

  let body: { chartId?: unknown; isPublic?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400, headers: NO_CACHE });
  }

  const chartId = typeof body.chartId === "string" ? body.chartId.trim() : "";
  if (!chartId) {
    return NextResponse.json({ error: "chartId obrigatório" }, { status: 400, headers: NO_CACHE });
  }
  const isPublic = body.isPublic === true;

  const chart = await prisma.chart.findUnique({
    where: { id: chartId },
    select: {
      id: true,
      userId: true,
      weekLabel: true,
      dateRange: true,
      user: { select: { handle: true } },
      parada: { select: { name: true } },
      entries: {
        orderBy: { position: "asc" },
        select: {
          songSpotifyId: true,
          song: { select: { spotifyId: true } },
        },
      },
    },
  });

  if (!chart) {
    return NextResponse.json({ error: "Parada não encontrada" }, { status: 404, headers: NO_CACHE });
  }
  if (chart.userId !== session.user.id) {
    return NextResponse.json(
      { error: "Só o dono da parada pode exportá-la para o Spotify." },
      { status: 403, headers: NO_CACHE },
    );
  }

  const trackIds: string[] = [];
  const seen = new Set<string>();
  for (const entry of chart.entries) {
    const id = entry.songSpotifyId?.trim() || entry.song.spotifyId?.trim() || null;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    trackIds.push(id);
  }

  if (trackIds.length === 0) {
    return NextResponse.json(
      {
        error:
          "Nenhuma música desta parada tem link com o Spotify. Edite a parada e adicione faixas com ID do Spotify.",
      },
      { status: 400, headers: NO_CACHE },
    );
  }

  const token = await getSpotifyUserAccessToken(session.user.id);
  if (!token) {
    return NextResponse.json(
      {
        error: "Conta Spotify não conectada. Conecte nas configurações de perfil.",
        needsReconnect: true,
      },
      { status: 400, headers: NO_CACHE },
    );
  }

  const paradaName = chart.parada.name.trim() || "Parada";
  const playlistName = `ChartFM · ${paradaName} · ${chart.weekLabel}`.slice(0, 100);
  const description =
    `Parada publicada no ChartFM por @${chart.user.handle} · ${chart.dateRange}`.slice(0, 300);

  const created = await createSpotifyPlaylist(token, playlistName, description, isPublic);
  if (!created.ok) {
    return NextResponse.json(
      { error: created.message, needsReconnect: created.needsReconnect === true },
      { status: created.needsReconnect ? 400 : 502, headers: NO_CACHE },
    );
  }

  const uris = trackIds.map((id) => `spotify:track:${id}`);
  const added = await addTracksToSpotifyPlaylist(token, created.id, uris);
  if (!added.ok) {
    return NextResponse.json(
      { error: added.message, needsReconnect: added.needsReconnect === true },
      { status: added.needsReconnect ? 400 : 502, headers: NO_CACHE },
    );
  }

  const skipped = chart.entries.length - trackIds.length;

  return NextResponse.json(
    {
      playlistId: created.id,
      playlistUrl: created.url,
      trackCount: trackIds.length,
      skippedCount: skipped > 0 ? skipped : 0,
    },
    { headers: NO_CACHE },
  );
}

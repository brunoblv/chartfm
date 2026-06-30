import { NextRequest, NextResponse } from "next/server";
import { requireSpotifySession } from "@/lib/mytrl-access-server";
import { isGlobalGenreChartSlug } from "@/lib/global-genre-charts";
import {
  resolveGlobalPlaylistTrackIds,
  type GlobalPlaylistKind,
  type GlobalPlaylistPeriod,
} from "@/lib/global-playlist-tracks";
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

const VALID_KINDS = new Set<GlobalPlaylistKind>(["global100", "genre", "airplay", "albums"]);
const VALID_PERIODS = new Set<GlobalPlaylistPeriod>(["weekly", "overall"]);

// POST /api/spotify/playlist-from-global
// Body: { kind, weekIndex, genreSlug?, period?, isPublic? }
export async function POST(req: NextRequest) {
  const session = await requireSpotifySession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403, headers: NO_CACHE });
  }

  let body: {
    kind?: unknown;
    weekIndex?: unknown;
    genreSlug?: unknown;
    period?: unknown;
    isPublic?: unknown;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400, headers: NO_CACHE });
  }

  const kind = typeof body.kind === "string" ? body.kind.trim() : "";
  if (!VALID_KINDS.has(kind as GlobalPlaylistKind)) {
    return NextResponse.json({ error: "kind inválido" }, { status: 400, headers: NO_CACHE });
  }

  const weekIndex = typeof body.weekIndex === "number" ? body.weekIndex : Number(body.weekIndex);
  if (!Number.isFinite(weekIndex) || weekIndex < 0) {
    return NextResponse.json({ error: "weekIndex inválido" }, { status: 400, headers: NO_CACHE });
  }

  const genreSlug = typeof body.genreSlug === "string" ? body.genreSlug.trim() : "";
  if (kind === "genre" && !isGlobalGenreChartSlug(genreSlug)) {
    return NextResponse.json({ error: "genreSlug obrigatório" }, { status: 400, headers: NO_CACHE });
  }

  const periodRaw = typeof body.period === "string" ? body.period.trim() : "weekly";
  const period = VALID_PERIODS.has(periodRaw as GlobalPlaylistPeriod)
    ? (periodRaw as GlobalPlaylistPeriod)
    : "weekly";

  if ((kind === "airplay" || kind === "albums") && period !== "weekly") {
    return NextResponse.json({ error: "period inválido para esta parada" }, { status: 400, headers: NO_CACHE });
  }

  const isPublic = body.isPublic === true;

  let resolved: Awaited<ReturnType<typeof resolveGlobalPlaylistTrackIds>>;
  try {
    resolved = await resolveGlobalPlaylistTrackIds({
      kind: kind as GlobalPlaylistKind,
      weekIndex,
      genreSlug: genreSlug || undefined,
      period,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parada não encontrada.";
    return NextResponse.json({ error: message }, { status: 404, headers: NO_CACHE });
  }

  const { trackIds, totalEntries, chartName, weekLabel, dateRange } = resolved;

  if (trackIds.length === 0) {
    return NextResponse.json(
      {
        error:
          "Nenhuma música desta parada tem link com o Spotify. Tente outra semana ou outro ranking.",
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

  const playlistName = `ChartFM · ${chartName} · ${weekLabel}`.slice(0, 100);
  const description = `Parada global do ChartFM · ${chartName} · ${dateRange}`.slice(0, 300);

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

  const skipped = totalEntries - trackIds.length;

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

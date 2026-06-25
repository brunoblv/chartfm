import { NextRequest, NextResponse } from "next/server";
import { requireMyTrlSession } from "@/lib/mytrl-access-server";
import {
  addTracksToSpotifyPlaylist,
  createSpotifyPlaylist,
  getMyTrlOwnerUser,
  getSpotifyUserAccessToken,
  spotifyUserOAuthConfigured,
} from "@/lib/spotify-user";
import { fetchTracksBetweenUnix, type TrackPlays } from "@/lib/lastfm";
import { searchSpotifyTracks } from "@/lib/spotify-server";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const NO_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const BRT_OFFSET_HOURS = 3; // BRT = UTC-3 (sem horário de verão no Brasil)

/** 00:00:00 BRT do dia 1 do mês, em segundos UNIX. */
function brtMonthStartUnix(year: number, monthIdx0: number): number {
  return Math.floor(Date.UTC(year, monthIdx0, 1, BRT_OFFSET_HOURS, 0, 0) / 1000);
}

function totalPlays(t: TrackPlays): number {
  return t.dayPlays.reduce((sum, d) => sum + d.plays, 0);
}

/** Resolve faixas (track/artist) para track IDs do Spotify com concorrência limitada. */
async function resolveSpotifyIds(
  tracks: { track: string; artist: string }[],
): Promise<{ ids: string[]; misses: { track: string; artist: string }[] }> {
  const ids: string[] = [];
  const misses: { track: string; artist: string }[] = [];
  const seen = new Set<string>();

  const CONCURRENCY = 5;
  let index = 0;

  async function worker() {
    while (index < tracks.length) {
      const i = index++;
      const t = tracks[i]!;
      const artistMain = t.artist.replace(/\s+(feat\.?|ft\.?|featuring)\s+.+$/i, "").trim();
      const results = await searchSpotifyTracks(`${t.track} ${artistMain}`, 1, "BR");
      const hit = results[0];
      if (hit?.spotifyId) {
        if (!seen.has(hit.spotifyId)) {
          seen.add(hit.spotifyId);
          ids[i] = hit.spotifyId;
        }
      } else {
        misses.push({ track: t.track, artist: t.artist });
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  // Remove buracos (índices não preenchidos) preservando a ordem por playcount.
  const ordered = ids.filter(Boolean);
  return { ids: ordered, misses };
}

/** GET — status da conexão e meses disponíveis em 2026. */
export async function GET() {
  const session = await requireMyTrlSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403, headers: NO_CACHE });
  }

  const owner = await getMyTrlOwnerUser();
  const token = await getSpotifyUserAccessToken(session.user.id);

  const now = new Date();
  const year = 2026;
  const months: { month: number; name: string }[] = [];
  for (let m = 0; m < 12; m++) {
    if (brtMonthStartUnix(year, m) > Math.floor(now.getTime() / 1000)) break;
    months.push({ month: m + 1, name: MONTH_NAMES[m]! });
  }

  return NextResponse.json(
    {
      configured: spotifyUserOAuthConfigured(),
      spotifyConnected: Boolean(token && owner?.spotifyRefreshToken),
      lastfmUser: owner?.lastfmUser ?? process.env.LASTFM_USERNAME ?? null,
      year,
      months,
    },
    { headers: NO_CACHE },
  );
}

/** POST — gera a playlist do mês: top N do Last.fm → Spotify. */
export async function POST(req: NextRequest) {
  const session = await requireMyTrlSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403, headers: NO_CACHE });
  }

  let body: { year?: unknown; month?: unknown; limit?: unknown; isPublic?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400, headers: NO_CACHE });
  }

  const year = Number(body.year) || 2026;
  const month = Number(body.month);
  const limit = Math.min(500, Math.max(1, Number(body.limit) || 300));
  const isPublic = body.isPublic === true;

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "month deve ser 1–12" }, { status: 400, headers: NO_CACHE });
  }

  const monthIdx0 = month - 1;
  const from = brtMonthStartUnix(year, monthIdx0);
  const nowUnix = Math.floor(Date.now() / 1000);
  if (from > nowUnix) {
    return NextResponse.json({ error: "Mês no futuro" }, { status: 400, headers: NO_CACHE });
  }
  const toExclusive = Math.min(brtMonthStartUnix(year, monthIdx0 + 1), nowUnix);

  const owner = await getMyTrlOwnerUser();
  const lastfmUser = owner?.lastfmUser ?? process.env.LASTFM_USERNAME ?? undefined;
  if (!lastfmUser) {
    return NextResponse.json(
      { error: "Usuário Last.fm não configurado." },
      { status: 400, headers: NO_CACHE },
    );
  }

  const token = await getSpotifyUserAccessToken(session.user.id);
  if (!token) {
    return NextResponse.json(
      { error: "Conta Spotify não conectada. Conecte nas configurações de perfil.", needsReconnect: true },
      { status: 400, headers: NO_CACHE },
    );
  }

  // 1. Agrega scrobbles do mês e ordena por playcount.
  let grouped: TrackPlays[];
  try {
    grouped = await fetchTracksBetweenUnix(from, toExclusive, lastfmUser);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao buscar dados do Last.fm" },
      { status: 502, headers: NO_CACHE },
    );
  }

  const ranked = grouped
    .map((t) => ({ track: t.track, artist: t.artist, plays: totalPlays(t) }))
    .sort((a, b) => b.plays - a.plays)
    .slice(0, limit);

  if (ranked.length === 0) {
    return NextResponse.json(
      { error: `Nenhum scrobble encontrado em ${MONTH_NAMES[monthIdx0]}/${year}.` },
      { status: 400, headers: NO_CACHE },
    );
  }

  // 2. Resolve para track IDs do Spotify.
  const { ids, misses } = await resolveSpotifyIds(ranked);
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Nenhuma faixa pôde ser encontrada no Spotify." },
      { status: 502, headers: NO_CACHE },
    );
  }

  // 3. Cria a playlist na conta do dono e adiciona as faixas.
  const playlistName = `Mais ouvidas — ${MONTH_NAMES[monthIdx0]} ${year}`.slice(0, 100);
  const description =
    `Top ${ids.length} faixas mais ouvidas em ${MONTH_NAMES[monthIdx0]}/${year} (Last.fm @${lastfmUser}).`.slice(0, 300);

  const created = await createSpotifyPlaylist(token, playlistName, description, isPublic);
  if (!created.ok) {
    return NextResponse.json(
      { error: created.message, needsReconnect: created.needsReconnect === true },
      { status: created.needsReconnect ? 400 : 502, headers: NO_CACHE },
    );
  }

  const uris = ids.map((id) => `spotify:track:${id}`);
  const added = await addTracksToSpotifyPlaylist(token, created.id, uris);
  if (!added.ok) {
    return NextResponse.json(
      { error: added.message, needsReconnect: added.needsReconnect === true },
      { status: added.needsReconnect ? 400 : 502, headers: NO_CACHE },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      month,
      monthName: MONTH_NAMES[monthIdx0],
      year,
      playlistId: created.id,
      playlistUrl: created.url,
      requested: ranked.length,
      added: ids.length,
      missing: misses.length,
      scrobbles: grouped.reduce((s, t) => s + totalPlays(t), 0),
      misses: misses.slice(0, 20),
    },
    { headers: NO_CACHE },
  );
}

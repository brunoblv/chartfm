import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { chartWeekUnixRangeFromAnchor, getChartWeekRange, parseChartWeekPickerDate } from "@/lib/chart-week";
import { fetchRecentTracks, fetchTracksBetweenUnix } from "@/lib/lastfm";
import { scoreLastfmTracks } from "@/lib/lastfm-chart-engine";
import { searchSpotifyTracks, spotifyConfigured } from "@/lib/spotify-server";
import { prisma } from "@/lib/prisma";

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

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlapScore(a: string, b: string): number {
  const ta = new Set(a.split(" ").filter((w) => w.length > 1));
  const tb = new Set(b.split(" ").filter((w) => w.length > 1));
  if (!ta.size || !tb.size) return 0;
  let n = 0;
  for (const w of ta) if (tb.has(w)) n += 1;
  return Math.round((n / Math.max(ta.size, tb.size)) * 50);
}

function scoreTrackMatch(wantTitle: string, wantArtist: string, gotTitle: string, gotArtist: string): number {
  const wt = normalizeKey(wantTitle);
  const waRaw = normalizeKey(wantArtist.split(",")[0] ?? wantArtist);
  const wa = waRaw.split(" feat ")[0] ?? waRaw;
  const ct = normalizeKey(gotTitle);
  const ca = normalizeKey(gotArtist.split(",")[0] ?? gotArtist);
  let s = 0;
  if (ct === wt) s += 100;
  else if (ct.includes(wt) || wt.includes(ct)) s += 58;
  else s += tokenOverlapScore(wt, ct);
  if (ca === wa) s += 90;
  else if (ca.includes(wa) || wa.includes(ca)) s += 48;
  else s += tokenOverlapScore(wa, ca) * 0.6;
  return Math.round(s);
}

function pickBestTrackMatch(
  item: { track: string; artist: string },
  matches: Array<{ title: string; artist: string; album: string; spotifyId: string; imageUrl: string | null }>,
) {
  if (!matches.length) return null;
  let best: (typeof matches)[number] | null = null;
  let bestScore = -1;
  for (const m of matches) {
    const sc = scoreTrackMatch(item.track, item.artist, m.title, m.artist);
    if (sc > bestScore) {
      best = m;
      bestScore = sc;
    }
  }
  // Evita casar músicas com artista/título muito diferentes (ex.: karaokê/covers).
  if (bestScore < 120) return null;
  return best;
}

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

async function enrichBatch(
  items: Array<{ track: string; artist: string; album: string }>,
): Promise<EnrichedSong[]> {
  return Promise.all(
    items.map(async (item) => {
      const matches = await searchSpotifyTracks(`${item.track} ${item.artist}`, 8);
      const m = pickBestTrackMatch(item, matches);
      if (m) {
        return { title: m.title, artist: m.artist, album: m.album, spotifyId: m.spotifyId, imageUrl: m.imageUrl ?? null };
      }
      return { title: item.track, artist: item.artist, album: item.album, spotifyId: null, imageUrl: null };
    }),
  );
}

function buildSongIdentityKey(song: EnrichedSong): string {
  if (song.spotifyId) return `sp:${song.spotifyId}`;
  return `na:${normalizeKey(song.title)}|||${normalizeKey(song.artist.split(",")[0] ?? song.artist)}`;
}

async function preferExistingSongs(items: EnrichedSong[]): Promise<EnrichedSong[]> {
  const out: EnrichedSong[] = [];
  const seen = new Set<string>();
  const cache = new Map<string, EnrichedSong>();

  for (const item of items) {
    const cacheKey = buildSongIdentityKey(item);
    let resolved = cache.get(cacheKey);

    if (!cache.has(cacheKey)) {
      const primaryArtist = item.artist.split(",")[0]?.trim() || item.artist.trim();
      const bySpotify = item.spotifyId
        ? await prisma.song.findUnique({
            where: { spotifyId: item.spotifyId },
            select: {
              title: true,
              artist: true,
              album: true,
              spotifyId: true,
              albumRef: { select: { coverUrl: true } },
            },
          })
        : null;

      const byText = bySpotify
        ? null
        : await prisma.song.findFirst({
            where: {
              title: { equals: item.title, mode: "insensitive" },
              artist: { equals: primaryArtist, mode: "insensitive" },
            },
            select: {
              title: true,
              artist: true,
              album: true,
              spotifyId: true,
              albumRef: { select: { coverUrl: true } },
            },
          });

      const dbSong = bySpotify ?? byText;
      resolved = dbSong
        ? {
            title: dbSong.title,
            artist: dbSong.artist,
            album: dbSong.album ?? item.album,
            spotifyId: dbSong.spotifyId ?? item.spotifyId,
            imageUrl: dbSong.albumRef?.coverUrl ?? null,
          }
        : item;

      cache.set(cacheKey, resolved);
    }

    if (!resolved) continue;
    const dedupeKey = buildSongIdentityKey(resolved);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(resolved);
  }

  return out;
}

// POST /api/lastfm/import
// Body: { weekDate?: "YYYY-MM-DD", limit?: number } — semana (seg–dom) dessa data; sem weekDate = últimos 28 dias.
// Usa o lastfmUser do perfil do usuário autenticado para buscar os scrobbles.
// As duas rotas usam scoreLastfmTracks: (últimos 7d ×5)+(8–14d ×3)+(15–21d ×2)+(22–28d ×1) em relação à âncora.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_CACHE_HEADERS });
  }

  const userRecord = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { lastfmUser: true },
  });

  if (!userRecord?.lastfmUser) {
    return NextResponse.json(
      { error: "Configure seu usuário do Last.fm nas configurações de perfil para usar esta função." },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  if (!spotifyConfigured()) {
    return NextResponse.json({ error: "Spotify não configurado" }, { status: 503, headers: NO_CACHE_HEADERS });
  }

  let body: { weekDate?: unknown; recentDays?: unknown; limit?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const weekDateStr = typeof body.weekDate === "string" ? body.weekDate.trim() : "";
  const useWeek = /^\d{4}-\d{2}-\d{2}$/.test(weekDateStr);
  const limit = typeof body.limit === "number" && body.limit > 0 && body.limit <= 200 ? Math.round(body.limit) : 200;
  const lastfmUsername = userRecord.lastfmUser;

  try {
    let topTracks: Array<{ track: string; artist: string; album: string; score: number }>;

    if (useWeek) {
      const anchor = parseChartWeekPickerDate(weekDateStr);
      if (!anchor) {
        return NextResponse.json({ error: "Data da semana inválida" }, { status: 400, headers: NO_CACHE_HEADERS });
      }
      if (anchor.getTime() > Date.now()) {
        return NextResponse.json({ error: "Não é possível importar semana futura" }, { status: 400, headers: NO_CACHE_HEADERS });
      }
      const { from, toExclusive } = chartWeekUnixRangeFromAnchor(anchor);
      const weekPlays = await fetchTracksBetweenUnix(from, toExclusive, lastfmUsername);
      const { end: weekEnd } = getChartWeekRange(anchor);
      const scoreAnchor = new Date(Date.UTC(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate()));
      topTracks = scoreLastfmTracks(weekPlays, scoreAnchor, limit);
    } else {
      const days = typeof body.recentDays === "number" && body.recentDays > 0 && body.recentDays <= 90 ? body.recentDays : 28;
      const recentPlays = await fetchRecentTracks(days, lastfmUsername);
      topTracks = scoreLastfmTracks(recentPlays, new Date(), limit);
    }

    const BATCH = 8;
    const enriched: EnrichedSong[] = [];
    for (let i = 0; i < topTracks.length; i += BATCH) {
      const batch = await enrichBatch(topTracks.slice(i, i + BATCH));
      enriched.push(...batch);
    }

    const songs = (await preferExistingSongs(enriched)).slice(0, limit);
    return NextResponse.json({ songs, total: topTracks.length }, { headers: NO_CACHE_HEADERS });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

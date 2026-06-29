import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { resolveLastfmImportTracks, resolveBrunoNewHitsImportTracks } from "@/lib/lastfm-import";
import { isMyTrlOwner } from "@/lib/mytrl-access";
import { searchSpotifyTracks, spotifyConfigured } from "@/lib/spotify-server";
import { getNamedNewHitsPlaylistTracks } from "@/lib/spotify-user";
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
  const SELECT = { title: true, artist: true, album: true, spotifyId: true, albumRef: { select: { coverUrl: true } } } as const;

  // Batch query 1: por spotifyId
  const spotifyIds = [...new Set(items.map((i) => i.spotifyId).filter(Boolean) as string[])];
  const bySpotifyId = new Map<string, EnrichedSong>();
  if (spotifyIds.length > 0) {
    const rows = await prisma.song.findMany({ where: { spotifyId: { in: spotifyIds } }, select: SELECT });
    for (const r of rows) {
      if (r.spotifyId) {
        bySpotifyId.set(r.spotifyId, { title: r.title, artist: r.artist, album: r.album ?? "", spotifyId: r.spotifyId, imageUrl: r.albumRef?.coverUrl ?? null });
      }
    }
  }

  // Itens não resolvidos por spotifyId → batch query 2 por título (filtragem de artista no cliente)
  const needText = items.filter((i) => !i.spotifyId || !bySpotifyId.has(i.spotifyId));
  const byTextKey = new Map<string, EnrichedSong>();
  if (needText.length > 0) {
    const titles = [...new Set(needText.map((i) => i.title))];
    const rows = await prisma.song.findMany({ where: { title: { in: titles, mode: "insensitive" } }, select: SELECT });
    for (const r of rows) {
      const primaryArtist = (r.artist.split(",")[0] ?? r.artist).trim().toLowerCase();
      const key = `${r.title.toLowerCase()}|||${primaryArtist}`;
      if (!byTextKey.has(key)) {
        byTextKey.set(key, { title: r.title, artist: r.artist, album: r.album ?? "", spotifyId: r.spotifyId ?? null, imageUrl: r.albumRef?.coverUrl ?? null });
      }
    }
  }

  const out: EnrichedSong[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    let resolved: EnrichedSong | undefined;

    if (item.spotifyId) {
      resolved = bySpotifyId.get(item.spotifyId);
    }
    if (!resolved) {
      const primaryArtist = (item.artist.split(",")[0] ?? item.artist).trim().toLowerCase();
      resolved = byTextKey.get(`${item.title.toLowerCase()}|||${primaryArtist}`);
    }
    resolved ??= item;

    const dedupeKey = buildSongIdentityKey(resolved);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(resolved);
  }

  return out;
}

// POST /api/lastfm/import
// Body: { limit?: number; weekDate?: string } — semana atual: top tracks `1month`;
// outras semanas: mês civil anterior à data da parada (YYYY-MM-DD).
// Usa o lastfmUser do perfil do usuário autenticado.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_CACHE_HEADERS });
  }

  const filterNewHits = isMyTrlOwner(session.user.handle);

  const userRecord = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      lastfmUser: true,
      spotifyRefreshToken: true,
    },
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

  let playlistTracks: Awaited<ReturnType<typeof getNamedNewHitsPlaylistTracks>> = null;
  if (filterNewHits) {
    if (!userRecord.spotifyRefreshToken) {
      return NextResponse.json(
        { error: "Conecte o Spotify para importar do Last.fm." },
        { status: 400, headers: NO_CACHE_HEADERS },
      );
    }
    playlistTracks = await getNamedNewHitsPlaylistTracks(session.user.id);
    if (!playlistTracks?.tracks.length) {
      return NextResponse.json(
        { error: "Playlist Spotify \"new hits\" não encontrada ou vazia." },
        { status: 400, headers: NO_CACHE_HEADERS },
      );
    }
  }

  let body: { limit?: unknown; weekDate?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const limit = typeof body.limit === "number" && body.limit > 0 && body.limit <= 200 ? Math.round(body.limit) : 200;
  const lastfmUsername = userRecord.lastfmUser;

  try {
    if (filterNewHits && playlistTracks) {
      const { tracks: newHitsTracks, periodLabel } = await resolveBrunoNewHitsImportTracks(
        body.weekDate,
        lastfmUsername,
        playlistTracks.tracks,
      );
      const enriched: EnrichedSong[] = newHitsTracks.map((t) => ({
        title: t.track,
        artist: t.artist,
        album: t.album,
        spotifyId: t.spotifyId,
        imageUrl: t.imageUrl,
      }));
      const songs = (await preferExistingSongs(enriched)).slice(0, limit);
      return NextResponse.json(
        { songs, total: newHitsTracks.length, periodLabel, filteredNewHits: true },
        { headers: NO_CACHE_HEADERS },
      );
    }

    const { tracks: topTracks, periodLabel } = await resolveLastfmImportTracks(body.weekDate, limit, lastfmUsername);

    const BATCH = 20;
    const enriched: EnrichedSong[] = [];
    for (let i = 0; i < topTracks.length; i += BATCH) {
      const slice = topTracks.slice(i, i + BATCH).map((t) => ({ track: t.track, artist: t.artist, album: t.album }));
      const batch = await enrichBatch(slice);
      enriched.push(...batch);
    }

    const songs = (await preferExistingSongs(enriched)).slice(0, limit);
    return NextResponse.json(
      { songs, total: topTracks.length, periodLabel, filteredNewHits: false },
      { headers: NO_CACHE_HEADERS },
    );
  } catch (err) {
    const msg = String(err);
    const isUserError = msg.includes("não encontrado") || msg.includes("not found") || msg.includes("HTTP 404");
    return NextResponse.json(
      { error: isUserError ? "Usuário Last.fm não encontrado. Verifique o nome de usuário nas configurações." : msg },
      { status: isUserError ? 400 : 500, headers: NO_CACHE_HEADERS },
    );
  }
}

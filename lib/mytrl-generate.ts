import { prisma } from "@/lib/prisma";
import { fetchTracksBetweenUnix } from "@/lib/lastfm";
import { searchSpotifyTracks } from "@/lib/spotify-server";
import {
  brtDateKey,
  brtWeekday,
  buildMyTrlPeriod,
  computeMyTrlChart,
  myTrlFetchWindow,
  myTrlSnapshotKey,
  type MyTrlHistory,
  type MyTrlSnapshotPayload,
} from "@/lib/mytrl-chart-engine";
import { getMyTrlOwnerUser, getNewHitsSpotifyIds, getNewHitsTracksForUser } from "@/lib/spotify-user";
import { recomputeAllMyTrlSnapshots } from "@/lib/mytrl-recompute";
import type { TrackPlays } from "@/lib/lastfm";

function brtDateKeyFromUnix(uts: number): string {
  return brtDateKey(new Date(uts * 1000));
}
function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreTrackMatch(wantTitle: string, wantArtist: string, gotTitle: string, gotArtist: string): number {
  const wt = normalizeKey(wantTitle);
  const wa = normalizeKey(wantArtist.split(",")[0] ?? wantArtist);
  const ct = normalizeKey(gotTitle);
  const ca = normalizeKey(gotArtist.split(",")[0] ?? gotArtist);
  let s = 0;
  if (ct === wt) s += 100;
  else if (ct.includes(wt) || wt.includes(ct)) s += 58;
  if (ca === wa) s += 90;
  else if (ca.includes(wa) || wa.includes(ca)) s += 48;
  return s;
}

async function enrichWithSpotify(
  trackPlays: TrackPlays[],
  allowedIds: Set<string>,
  playlistTracks: Array<{ spotifyId: string; title: string; artist: string; imageUrl: string | null }>,
): Promise<Array<TrackPlays & { spotifyId: string | null; imageUrl: string | null }>> {
  const CONCURRENCY = 8;

  async function enrichOne(
    tp: TrackPlays,
  ): Promise<(TrackPlays & { spotifyId: string; imageUrl: string | null }) | null> {
    let best: (typeof playlistTracks)[number] | null = null;
    let bestScore = -1;

    for (const pl of playlistTracks) {
      const sc = scoreTrackMatch(tp.track, tp.artist, pl.title, pl.artist);
      if (sc > bestScore && sc >= 120) {
        bestScore = sc;
        best = pl;
      }
    }

    if (!best) {
      const matches = await searchSpotifyTracks(`${tp.track} ${tp.artist}`, 8);
      for (const m of matches) {
        if (!allowedIds.has(m.spotifyId)) continue;
        const sc = scoreTrackMatch(tp.track, tp.artist, m.title, m.artist);
        if (sc > bestScore && sc >= 120) {
          bestScore = sc;
          best = { spotifyId: m.spotifyId, title: m.title, artist: m.artist, imageUrl: m.imageUrl };
        }
      }
    }

    if (best && allowedIds.has(best.spotifyId)) {
      return { ...tp, spotifyId: best.spotifyId, imageUrl: best.imageUrl };
    }
    return null;
  }

  const out: Array<TrackPlays & { spotifyId: string | null; imageUrl: string | null }> = [];
  for (let i = 0; i < trackPlays.length; i += CONCURRENCY) {
    const batch = await Promise.all(trackPlays.slice(i, i + CONCURRENCY).map(enrichOne));
    for (const r of batch) {
      if (r) out.push(r);
    }
  }
  return out;
}

async function loadHistory(): Promise<MyTrlHistory> {
  const rows = await prisma.myTrlSnapshot.findMany({
    orderBy: [{ weekday: "asc" }, { weekIndex: "desc" }],
  });

  const history: MyTrlHistory = {};
  for (const row of rows) {
    history[myTrlSnapshotKey(row.weekday, row.weekIndex)] = {
      computedAt: row.computedAt.toISOString(),
      entries: row.entries as unknown as MyTrlSnapshotPayload["entries"],
    };
  }
  return history;
}

export type MyTrlGenerateResult =
  | {
      ok: true;
      weekday: number;
      weekIndex: number;
      count: number;
      totalTracks: number;
      referenceDate: string;
      weekLabel: string;
      dateRange: string;
      skipped?: false;
    }
  | { ok: false; error: string; skipped?: boolean };
export async function generateMyTrlSnapshot(referenceDay: Date = new Date()): Promise<MyTrlGenerateResult> {
  const weekday = brtWeekday(referenceDay);
  if (weekday === 0) {
    return { ok: false, error: "Fim de semana — MyTRL só roda de segunda a sexta.", skipped: true };
  }

  const owner = await getMyTrlOwnerUser();
  if (!owner) {
    return { ok: false, error: "Usuário @bruno não encontrado." };
  }

  if (!owner.spotifyNewHitsPlaylistId || !owner.spotifyRefreshToken) {
    return { ok: false, error: "Spotify não conectado ou playlist new hits não encontrada." };
  }

  const lastfmUser = owner.lastfmUser ?? process.env.LASTFM_USERNAME;
  if (!lastfmUser) {
    return { ok: false, error: "Last.fm não configurado." };
  }

  const allowedIds = await getNewHitsSpotifyIds(owner.id);
  if (allowedIds.size === 0) {
    return { ok: false, error: "Playlist new hits vazia ou inacessível." };
  }

  const playlistTracks = await getNewHitsTracksForUser(owner.id);

  const { fromUnix, toUnix } = myTrlFetchWindow(referenceDay);
  const rawPlays = await fetchTracksBetweenUnix(fromUnix, toUnix, lastfmUser, brtDateKeyFromUnix);
  const enriched = await enrichWithSpotify(rawPlays, allowedIds, playlistTracks);

  const history = await loadHistory();
  const { weekIndex, weekLabel, dateRange } = buildMyTrlPeriod(referenceDay);
  const entries = computeMyTrlChart(enriched, allowedIds, history, weekday, weekIndex, referenceDay);

  const entriesJson = JSON.parse(JSON.stringify(entries));

  await prisma.myTrlSnapshot.upsert({
    where: {
      weekday_weekIndex: { weekday, weekIndex },
    },
    create: {
      weekday,
      weekIndex,
      weekLabel,
      dateRange,
      entries: entriesJson,
      computedAt: referenceDay,
    },
    update: {
      weekLabel,
      dateRange,
      entries: entriesJson,
      computedAt: referenceDay,
    },
  });

  await recomputeAllMyTrlSnapshots();

  return {
    ok: true,
    weekday,
    weekIndex,
    count: entries.filter((e) => e.position != null).length,
    totalTracks: entries.length,
    referenceDate: brtDateKey(referenceDay),
    weekLabel,
    dateRange,
  };}

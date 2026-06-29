import { existsSync, readFileSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

import { prisma } from "../lib/prisma";
import { fetchTracksBetweenUnix } from "../lib/lastfm";
import {
  brtDateKey,
  brtWeekday,
  buildMyTrlPeriod,
  buildMyTrlScoringWindow,
  computeMyTrlChart,
  formatMyTrlEditionDisplay,
  myTrlFetchWindow,
  myTrlSnapshotKey,
  myTrlTopEntries,
  type MyTrlHistory,
} from "../lib/mytrl-chart-engine";
import { getMyTrlOwnerUser, getNewHitsSpotifyIds, getNewHitsTracksForUser } from "../lib/spotify-user";
import { searchSpotifyTracks } from "../lib/spotify-server";
import type { TrackPlays } from "../lib/lastfm";

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
      entries: row.entries as MyTrlHistory[string]["entries"],
    };
  }
  return history;
}

async function main() {
  const referenceDay = new Date();
  const weekday = brtWeekday(referenceDay);
  const refKey = brtDateKey(referenceDay);
  const edition = formatMyTrlEditionDisplay(referenceDay);

  console.log("=== Teste parada DIÁRIA MyTRL (dry-run, sem gravar) ===\n");
  console.log(`Edição: ${refKey} (${edition.fullLabel})`);
  console.log(`Janela rolling (últimos 7 dias, exclui hoje): ${buildMyTrlScoringWindow(refKey)}`);
  console.log(`Pesos por idade do play: ontem×25 · 2d×15 · 3d×14 · 4d×13 · 5d×12 · 6d×11 · 7d×10`);
  console.log("(Não é parada semanal — sem somar seg–sex da semana ISO)\n");

  if (weekday === 0) {
    console.error("Hoje é fim de semana — MyTRL só roda seg–sex.");
    process.exit(1);
  }

  const owner = await getMyTrlOwnerUser();
  if (!owner) {
    console.error("Usuário @bruno não encontrado.");
    process.exit(1);
  }

  const playlistId = owner.spotifyNewHitsPlaylistId;
  if (!playlistId || !owner.spotifyRefreshToken) {
    console.error("Spotify não conectado ou playlist do mês não configurada.");
    process.exit(1);
  }

  const lastfmUser = owner.lastfmUser ?? process.env.LASTFM_USERNAME;
  if (!lastfmUser) {
    console.error("Last.fm não configurado.");
    process.exit(1);
  }

  console.log(`Last.fm: ${lastfmUser}`);
  console.log(`Playlist: ${playlistId}\n`);

  const allowedIds = await getNewHitsSpotifyIds(owner.id, playlistId);
  const playlistTracks = await getNewHitsTracksForUser(owner.id, playlistId);
  console.log(`Faixas na playlist: ${allowedIds.size}`);

  const { fromUnix, toUnix } = myTrlFetchWindow(referenceDay);
  console.log("Buscando plays no Last.fm...");
  const rawPlays = await fetchTracksBetweenUnix(fromUnix, toUnix, lastfmUser, brtDateKeyFromUnix);
  console.log(`Plays brutos: ${rawPlays.length}`);

  console.log("Enriquecendo com Spotify...");
  const enriched = await enrichWithSpotify(rawPlays, allowedIds, playlistTracks);
  console.log(`Faixas elegíveis: ${enriched.length}\n`);

  const history = await loadHistory();
  const { weekIndex } = buildMyTrlPeriod(referenceDay);
  const entries = computeMyTrlChart(enriched, allowedIds, history, weekday, weekIndex, referenceDay);
  const top = myTrlTopEntries(entries, 10);

  console.log(`Top ${top.length} (ranking por score dos últimos 7 dias):\n`);

  for (const e of top) {
    const dayBreakdown = (e.dayPlays ?? [])
      .map((d) => `${d.date.slice(5)}:${d.plays}`)
      .join(" · ");
    const move =
      e.status === "new"
        ? "NEW"
        : e.status === "return"
          ? "RE"
          : e.delta === 0
            ? "="
            : e.status === "up"
              ? `▲${e.delta}`
              : `▼${e.delta}`;
    console.log(
      `#${e.position}  ${e.score.toFixed(2).padStart(8)} pts  ${move.padEnd(4)}  ${e.artist} — ${e.track}`,
    );
    if (dayBreakdown) console.log(`       plays: ${dayBreakdown}`);
  }

  const outside = entries.filter((e) => e.position == null && e.score > 0).length;
  console.log(`\nFora do top 10 com pontos: ${outside}`);
  console.log("\n(dry-run — nada foi salvo no banco)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

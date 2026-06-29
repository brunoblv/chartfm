/**
 * Testa importação Last.fm @bruno: 30 dias ponderados + filtro "new hits".
 * Uso: npx tsx scripts/test-bruno-lastfm-import.ts
 */
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

import { fetchTracksBetweenUnix } from "../lib/lastfm";
import { resolveBrunoLastfmImportTracks } from "../lib/lastfm-import";
import { searchSpotifyTracks } from "../lib/spotify-server";
import { getMyTrlOwnerUser, getNewHitsSpotifyIds, getNewHitsTracksForUser, type NewHitsTrack } from "../lib/spotify-user";

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
  const waRaw = normalizeKey(wantArtist.split(",")[0] ?? wantArtist);
  const wa = waRaw.split(" feat ")[0] ?? waRaw;
  const ct = normalizeKey(gotTitle);
  const ca = normalizeKey(gotArtist.split(",")[0] ?? gotArtist);
  let s = 0;
  if (ct === wt) s += 100;
  else if (ct.includes(wt) || wt.includes(ct)) s += 58;
  if (ca === wa) s += 90;
  else if (ca.includes(wa) || wa.includes(ca)) s += 48;
  return s;
}

async function matchNewHits(
  item: { track: string; artist: string },
  allowedIds: Set<string>,
  playlistTracks: NewHitsTrack[],
) {
  let best: NewHitsTrack | null = null;
  let bestScore = -1;

  for (const pl of playlistTracks) {
    const sc = scoreTrackMatch(item.track, item.artist, pl.title, pl.artist);
    if (sc > bestScore && sc >= 120) {
      bestScore = sc;
      best = pl;
    }
  }

  if (!best) {
    const matches = await searchSpotifyTracks(`${item.track} ${item.artist}`, 8);
    for (const m of matches) {
      if (!allowedIds.has(m.spotifyId)) continue;
      const sc = scoreTrackMatch(item.track, item.artist, m.title, m.artist);
      if (sc > bestScore && sc >= 120) {
        bestScore = sc;
        best = { spotifyId: m.spotifyId, title: m.title, artist: m.artist, album: m.album, imageUrl: m.imageUrl };
      }
    }
  }

  return best && allowedIds.has(best.spotifyId) ? best : null;
}

function scoreAll30d(trackPlays: Awaited<ReturnType<typeof fetchTracksBetweenUnix>>, anchor: Date) {
  const refMs = Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate());
  return trackPlays
    .map((tp) => {
      let score = 0;
      for (const { date, plays } of tp.dayPlays) {
        const diffDays = Math.round((refMs - new Date(`${date}T00:00:00Z`).getTime()) / 86_400_000);
        const w = diffDays < 0 || diffDays >= 30 ? 0 : diffDays < 7 ? 20 : 10;
        score += plays * w;
      }
      return { track: tp.track, artist: tp.artist, album: tp.album, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
}

async function main() {
  const owner = await getMyTrlOwnerUser();
  if (!owner) {
    console.error("Usuário @bruno não encontrado.");
    process.exit(1);
  }

  const playlistId = owner.spotifyNewHitsPlaylistId;
  if (!playlistId || !owner.spotifyRefreshToken) {
    console.error("Spotify não conectado ou playlist não configurada.");
    process.exit(1);
  }

  const lastfmUser = owner.lastfmUser ?? process.env.LASTFM_USERNAME;
  if (!lastfmUser) {
    console.error("Last.fm não configurado.");
    process.exit(1);
  }

  const allowedIds = await getNewHitsSpotifyIds(owner.id, playlistId);
  const playlistTracks = await getNewHitsTracksForUser(owner.id, playlistId);
  const anchor = new Date();

  console.log("=== Teste import Last.fm @bruno ===\n");
  console.log(`Last.fm: ${lastfmUser}`);
  console.log(`Playlist new hits: ${allowedIds.size} faixas\n`);

  const { tracks: top200 } = await resolveBrunoLastfmImportTracks(undefined, 200, lastfmUser);
  console.log(`Ranqueadas (top 200 por score): ${top200.length}`);

  let matchedFrom200 = 0;
  for (const t of top200) {
    const m = await matchNewHits(t, allowedIds, playlistTracks);
    if (m) matchedFrom200++;
  }
  console.log(`Com match na new hits (só top 200): ${matchedFrom200} ← comportamento atual da API\n`);

  const toExclusive = Math.floor(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate() + 1) / 1000,
  );
  const from = toExclusive - 30 * 86400;
  console.log("Buscando todos os scrobbles dos últimos 30 dias...");
  const allPlays = await fetchTracksBetweenUnix(from, toExclusive, lastfmUser);
  const scored = scoreAll30d(allPlays, anchor);
  console.log(`Faixas com pontuação > 0: ${scored.length}\n`);

  let allMatched = 0;
  for (const t of scored) {
    const m = await matchNewHits(t, allowedIds, playlistTracks);
    if (m) allMatched++;
  }
  console.log(`Com match na new hits (todas pontuadas): ${allMatched}\n`);

  console.log("=== TOP 10 MAIS PONTUADAS (new hits) ===\n");
  const top10: Array<{ rank: number; track: string; artist: string; score: number; spotifyTitle: string }> = [];
  for (const t of scored) {
    if (top10.length >= 10) break;
    const m = await matchNewHits(t, allowedIds, playlistTracks);
    if (m) {
      top10.push({
        rank: top10.length + 1,
        track: t.track,
        artist: t.artist,
        score: t.score,
        spotifyTitle: m.title,
      });
    }
  }

  if (top10.length === 0) {
    console.log("(nenhuma faixa elegível)");
  } else {
    for (const r of top10) {
      console.log(
        `${String(r.rank).padStart(2)}. ${r.track} — ${r.artist} | ${r.score} pts | spotify: ${r.spotifyTitle}`,
      );
    }
  }

  if (matchedFrom200 < 10 && allMatched >= 10) {
    console.log(
      `\n[DIAGNÓSTICO] A API corta em top 200 antes do filtro new hits — só ${matchedFrom200} passam, mas há ${allMatched} elegíveis no total.`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

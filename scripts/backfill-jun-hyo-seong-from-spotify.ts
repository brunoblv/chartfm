/**
 * Liga músicas de Jun Hyo Seong ao `Artist` e preenche campos Spotify em falta
 * (`spotify_id`, `album_spotify_id`, URLs, duração, capa, feats, `ChartEntry`).
 *
 * - Considera músicas com `artist_spotify_id` dela OU texto `artist` igual a
 *   "Jun Hyo Seong" ou começando por "Jun Hyo Seong," (feat).
 * - Se já tiver tudo preenchido e `artist_spotify_id` correcto, ignora.
 *
 * Uso:
 *   npx tsx scripts/backfill-jun-hyo-seong-from-spotify.ts --dry-run
 *   npx tsx scripts/backfill-jun-hyo-seong-from-spotify.ts --apply
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { prisma } from "../lib/prisma";
import {
  getSpotifyArtistById,
  getSpotifyArtistTopTracks,
  getSpotifyTrackMetadataById,
  mapTrackToResult,
  searchSpotifyTracks,
  spotifyConfigured,
} from "../lib/spotify-server";

const SPOTIFY_ARTIST_ID = "73RRzEpK7IQexOhC0CuTRZ";
const PRIMARY_NAME = "Jun Hyo Seong";
const DEFAULT_DELAY_MS = 750;
const MARKETS = ["KR", "US", "BR", "JP"];

function loadEnvFile() {
  const p = path.join(process.cwd(), ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile();

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
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

function sanitizeQueryPart(s: string): string {
  return s.replace(/"/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function stripParenSuffixes(title: string, maxRounds = 4): string {
  let s = title.trim();
  for (let i = 0; i < maxRounds; i++) {
    const m = s.match(/^(.+?)\s*\([^)]*\)\s*$/);
    if (m && m[1].trim().length >= 2) s = m[1].trim();
    else break;
  }
  return s.trim() || title.trim();
}

function mainArtistFrom(artist: string): string {
  return (
    artist
      .split(",")[0]
      ?.trim()
      .split(/\s+feat\.?\s+/i)[0]
      ?.trim()
      .split(/\s+&\s+/)[0]
      ?.trim() ?? artist
  );
}

type TrackHit = { spotifyId: string; title: string; artist: string };

function tokenOverlapScore(a: string, b: string): number {
  const ta = new Set(a.split(" ").filter((w) => w.length > 1));
  const tb = new Set(b.split(" ").filter((w) => w.length > 1));
  if (!ta.size || !tb.size) return 0;
  let n = 0;
  for (const w of ta) if (tb.has(w)) n += 1;
  return Math.round((n / Math.max(ta.size, tb.size)) * 50);
}

function scoreTrackMatch(wantTitle: string, wantArtist: string, h: TrackHit): number {
  const wt = normalizeKey(wantTitle);
  const waRaw = normalizeKey(wantArtist.split(",")[0] ?? wantArtist);
  const wa = waRaw.split(" feat ")[0] ?? waRaw;
  const ct = normalizeKey(h.title);
  const ca = normalizeKey(h.artist.split(",")[0] ?? h.artist);
  let s = 0;
  if (ct === wt) s += 100;
  else if (ct.includes(wt) || wt.includes(ct)) s += 58;
  else s += tokenOverlapScore(wt, ct);
  if (ca === wa) s += 90;
  else if (ca.includes(wa) || wa.includes(ca)) s += 48;
  else s += tokenOverlapScore(wa, ca) * 0.6;
  return Math.round(s);
}

function pickBestTrackId(wantTitle: string, wantArtist: string, hits: TrackHit[]): string | null {
  if (!hits.length) return null;
  let bestId: string | null = null;
  let bestScore = -1;
  for (const h of hits) {
    const sc = scoreTrackMatch(wantTitle, wantArtist, h);
    if (sc > bestScore) {
      bestScore = sc;
      bestId = h.spotifyId;
    }
  }
  if (bestScore >= 35) return bestId;
  if (bestScore >= 28 && hits.length <= 8) return bestId;
  if (bestScore >= 26 && hits.length === 1) return bestId;
  return null;
}

function buildTrackQueries(title: string, mainArtist: string, fullArtist: string): string[] {
  const t0 = sanitizeQueryPart(title);
  const t1 = sanitizeQueryPart(stripParenSuffixes(title));
  const ma = sanitizeQueryPart(mainArtist);
  const fa = sanitizeQueryPart(fullArtist);
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (q: string) => {
    if (q.length < 3) return;
    if (seen.has(q)) return;
    seen.add(q);
    out.push(q);
  };
  if (t0 && ma) {
    push(`track:"${t0}" artist:"${ma}"`);
    push(`${t0} ${ma}`);
    if (fa && fa !== ma) push(`${t0} ${fa}`);
  }
  if (t1 && ma && t1 !== t0) {
    push(`track:"${t1}" artist:"${ma}"`);
    push(`${t1} ${ma}`);
  }
  return out;
}

async function mergeSearchHits(
  title: string,
  artist: string,
  markets: string[],
  perQueryLimit: number,
  delayMs: number,
): Promise<TrackHit[]> {
  const main = mainArtistFrom(artist);
  const queries = buildTrackQueries(title, main, artist);
  const byId = new Map<string, TrackHit>();
  for (const market of markets) {
    for (const q of queries) {
      const batch = await searchSpotifyTracks(q, perQueryLimit, market);
      for (const h of batch) {
        if (!byId.has(h.spotifyId)) byId.set(h.spotifyId, h);
      }
      await sleep(delayMs);
    }
  }
  return [...byId.values()];
}

async function mergeHerTopTracks(markets: string[], delayMs: number): Promise<TrackHit[]> {
  const byId = new Map<string, TrackHit>();
  for (const market of markets) {
    const tops = await getSpotifyArtistTopTracks(SPOTIFY_ARTIST_ID, market);
    for (const t of tops) {
      const row = mapTrackToResult(t);
      if (!byId.has(row.spotifyId)) byId.set(row.spotifyId, { spotifyId: row.spotifyId, title: row.title, artist: row.artist });
    }
    await sleep(delayMs);
  }
  return [...byId.values()];
}

async function searchTrackCandidates(title: string, artist: string, markets: string[], delayMs: number) {
  const searchHits = await mergeSearchHits(title, artist, markets, 15, delayMs);
  let merged = [...searchHits];
  const bestIdEarly = pickBestTrackId(title, artist, merged);
  const hitEarly = bestIdEarly ? merged.find((h) => h.spotifyId === bestIdEarly) : undefined;
  const earlyScore = hitEarly ? scoreTrackMatch(title, artist, hitEarly) : 0;
  if (!bestIdEarly || earlyScore < 42) {
    const extra = await mergeHerTopTracks(markets.slice(0, 4), delayMs);
    const map = new Map<string, TrackHit>();
    for (const h of merged) map.set(h.spotifyId, h);
    for (const h of extra) map.set(h.spotifyId, h);
    merged = [...map.values()];
  }
  return { hits: merged, market: markets[0] ?? "KR" } as const;
}

type SongRow = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  spotifyId: string | null;
  artistSpotifyId: string | null;
  albumSpotifyId: string | null;
  spotifyUrl: string | null;
  durationMs: number | null;
  albumRef: { coverUrl: string | null } | null;
};

function needsBackfill(s: SongRow): boolean {
  if ((s.artistSpotifyId?.trim() || "") !== SPOTIFY_ARTIST_ID) return true;
  if (!s.spotifyId?.trim()) return true;
  if (!s.albumSpotifyId?.trim()) return true;
  if (!s.spotifyUrl?.trim()) return true;
  if (s.durationMs == null) return true;
  if (!s.album?.trim()) return true;
  if (s.albumSpotifyId?.trim() && !s.albumRef?.coverUrl?.trim()) return true;
  return false;
}

function localMainIsHer(artist: string): boolean {
  const m = mainArtistFrom(artist);
  return normalizeKey(m) === normalizeKey(PRIMARY_NAME);
}

function metaAcceptable(meta: NonNullable<Awaited<ReturnType<typeof getSpotifyTrackMetadataById>>>, song: SongRow): boolean {
  if (localMainIsHer(song.artist)) return meta.primaryArtist?.spotifyId === SPOTIFY_ARTIST_ID;
  return meta.artists.some((a) => a.spotifyId === SPOTIFY_ARTIST_ID);
}

async function fetchMetaFromSearch(song: SongRow, delayMs: number): Promise<{ meta: NonNullable<Awaited<ReturnType<typeof getSpotifyTrackMetadataById>>>; market: string } | null> {
  const { hits, market } = await searchTrackCandidates(song.title, song.artist, MARKETS, delayMs);
  const trackId = pickBestTrackId(song.title, song.artist, hits);
  await sleep(delayMs);
  if (!trackId) return null;
  for (const m of [market, ...MARKETS.filter((x) => x !== market)]) {
    const meta = await getSpotifyTrackMetadataById(trackId, m);
    await sleep(delayMs);
    if (!meta || !metaAcceptable(meta, song)) continue;
    return { meta, market: m };
  }
  return null;
}

async function fetchMetaForSong(song: SongRow, delayMs: number): Promise<{ meta: NonNullable<Awaited<ReturnType<typeof getSpotifyTrackMetadataById>>>; market: string } | null> {
  const tid = song.spotifyId?.trim();
  if (tid) {
    for (const m of MARKETS) {
      const meta = await getSpotifyTrackMetadataById(tid, m);
      await sleep(delayMs);
      if (!meta || !metaAcceptable(meta, song)) continue;
      return { meta, market: m };
    }
  }
  return fetchMetaFromSearch(song, delayMs);
}

async function ensureArtistProfile(delayMs: number) {
  const profile = await getSpotifyArtistById(SPOTIFY_ARTIST_ID);
  await sleep(delayMs);
  if (!profile) throw new Error("Spotify: artista não encontrado " + SPOTIFY_ARTIST_ID);
  await prisma.artist.upsert({
    where: { spotifyId: SPOTIFY_ARTIST_ID },
    create: {
      spotifyId: profile.spotifyId,
      name: profile.name,
      genres: profile.genres,
      spotifyUrl: profile.spotifyUrl ?? null,
      imageUrl: profile.imageUrl ?? null,
    },
    update: {
      name: profile.name,
      genres: profile.genres,
      spotifyUrl: profile.spotifyUrl ?? undefined,
      ...(profile.imageUrl ? { imageUrl: profile.imageUrl } : {}),
    },
  });
  return profile;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");
  if ((!dryRun && !apply) || (dryRun && apply)) {
    console.error("Use exatamente um de: --dry-run | --apply");
    process.exit(1);
  }

  const delayMs = (() => {
    const a = process.argv.find((x) => x.startsWith("--delay-ms="));
    if (!a) return DEFAULT_DELAY_MS;
    const n = parseInt(a.split("=")[1] ?? "", 10);
    return Number.isFinite(n) ? Math.min(4000, Math.max(120, n)) : DEFAULT_DELAY_MS;
  })();

  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  await ensureArtistProfile(delayMs);

  const whereHers: Prisma.SongWhereInput = {
    OR: [
      { artistSpotifyId: SPOTIFY_ARTIST_ID },
      { artist: { equals: PRIMARY_NAME, mode: Prisma.QueryMode.insensitive } },
      { artist: { startsWith: `${PRIMARY_NAME},`, mode: Prisma.QueryMode.insensitive } },
    ],
  };

  const candidates = await prisma.song.findMany({
    where: whereHers,
    select: {
      id: true,
      title: true,
      artist: true,
      album: true,
      spotifyId: true,
      artistSpotifyId: true,
      albumSpotifyId: true,
      spotifyUrl: true,
      durationMs: true,
      albumRef: { select: { coverUrl: true } },
    },
    orderBy: { title: "asc" },
  });

  const toProcess = candidates.filter(needsBackfill);
  console.log(JSON.stringify({ totalMatched: candidates.length, needBackfill: toProcess.length, dryRun, delayMs }, null, 2));

  let ok = 0;
  let noMeta = 0;
  let fail = 0;
  const skippedComplete = candidates.length - toProcess.length;

  for (const s of toProcess) {
    const fetched = await fetchMetaForSong(s, delayMs);
    if (!fetched?.meta) {
      console.log(`SKIP sem_meta "${s.title}" — ${s.artist}`);
      noMeta += 1;
      await sleep(delayMs);
      continue;
    }

    const res = await applySpotifyMetadataToSong(s.id, fetched.meta, dryRun);
    if (!res.ok) {
      console.log(`FAIL "${s.title}" — ${s.artist} :: ${res.reason}`);
      fail += 1;
    } else if (dryRun) {
      console.log(`DRY  "${s.title}" — ${s.artist} -> ${fetched.meta.spotifyId}`);
      ok += 1;
    } else {
      console.log(`OK   "${s.title}" — ${s.artist} -> ${fetched.meta.spotifyId}`);
      ok += 1;
    }
    await sleep(delayMs);
  }

  console.log(JSON.stringify({ ok, fail, semMetaSpotify: noMeta, skippedAlreadyComplete: skippedComplete, dryRun }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

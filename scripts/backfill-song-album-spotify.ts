/**
 * Procura no Spotify álbum (catálogo) para músicas sem albumSpotifyId.
 *
 * - Com spotify_id: GET /tracks + applySpotifyMetadataToSong (rápido).
 * - Sem spotify_id: busca de faixa + melhor match + metadata + apply (mais chamadas à API).
 *
 * Pacing “tempo mínimo seguro”: --delay-ms entre músicas (padrão 850) + --jitter-ms aleatório;
 * entre queries de busca na mesma música usa max(120, delayMs/5).
 *
 * Uso (raiz chartify):
 *   npx tsx scripts/backfill-song-album-spotify.ts --dry-run --limit=10
 *   npx tsx scripts/backfill-song-album-spotify.ts --delay-ms=850 --jitter-ms=200 --limit=200
 *   npx tsx scripts/backfill-song-album-spotify.ts --market=BR --fallback-markets=JP,US,KR
 *
 * Requer .env: DATABASE_URL ou DIRECT_URL, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { prisma } from "../lib/prisma";
import {
  getSpotifyArtistTopTracks,
  getSpotifyTrackMetadataById,
  mapTrackToResult,
  searchSpotifyArtists,
  searchSpotifyTracks,
  spotifyConfigured,
} from "../lib/spotify-server";

function loadEnvFile() {
  const p = path.join(process.cwd(), ".env");
  if (!existsSync(p)) return;
  const txt = readFileSync(p, "utf8");
  for (const line of txt.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile();

function parseArg(flag: string, def: string | null): string | null {
  const nf = flag.replace(/^--/, "");
  const argv = process.argv.slice(2);
  const a = argv.find((x) => x.startsWith(`--${nf}=`));
  if (!a) return def;
  const eq = a.indexOf("=");
  if (eq <= 0) return def;
  const v = a.slice(eq + 1).trim();
  return v || def;
}

function parseIntArg(flag: string, def: number): number {
  const v = parseArg(flag, String(def));
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : def;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function sleepWithJitter(baseMs: number, jitterMaxMs: number) {
  const j = jitterMaxMs > 0 ? Math.floor(Math.random() * (jitterMaxMs + 1)) : 0;
  await sleep(baseMs + j);
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
  let out = title.trim();
  for (let i = 0; i < maxRounds; i++) {
    const m = out.match(/^(.+?)\s*\([^)]*\)\s*$/);
    if (m && m[1].trim().length >= 2) out = m[1].trim();
    else break;
  }
  return out.trim() || title.trim();
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
  innerDelayMs: number,
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
      await sleep(innerDelayMs);
    }
  }
  return [...byId.values()];
}

async function mergeTopTrackHits(
  artist: string,
  markets: string[],
  artistSearchLimit: number,
  innerDelayMs: number,
): Promise<TrackHit[]> {
  const main = mainArtistFrom(artist);
  const byId = new Map<string, TrackHit>();
  for (const market of markets) {
    const profiles = await searchSpotifyArtists(main, artistSearchLimit, market);
    await sleep(innerDelayMs);
    for (const ar of profiles) {
      const tops = await getSpotifyArtistTopTracks(ar.spotifyId, market);
      await sleep(innerDelayMs);
      for (const t of tops) {
        const row = mapTrackToResult(t);
        const h: TrackHit = { spotifyId: row.spotifyId, title: row.title, artist: row.artist };
        if (!byId.has(h.spotifyId)) byId.set(h.spotifyId, h);
      }
    }
  }
  return [...byId.values()];
}

async function searchTrackCandidates(
  title: string,
  artist: string,
  markets: string[],
  innerDelayMs: number,
) {
  const searchHits = await mergeSearchHits(title, artist, markets, 15, innerDelayMs);
  let merged = [...searchHits];
  const bestIdEarly = pickBestTrackId(title, artist, merged);
  const hitEarly = bestIdEarly ? merged.find((h) => h.spotifyId === bestIdEarly) : undefined;
  const earlyScore = hitEarly ? scoreTrackMatch(title, artist, hitEarly) : 0;
  if (!bestIdEarly || earlyScore < 42) {
    const extra = await mergeTopTrackHits(artist, markets.slice(0, 4), 5, innerDelayMs);
    const map = new Map<string, TrackHit>();
    for (const h of merged) map.set(h.spotifyId, h);
    for (const h of extra) map.set(h.spotifyId, h);
    merged = [...map.values()];
  }
  const metaMarket = markets[0] ?? "US";
  return { hits: merged, market: metaMarket } as const;
}

async function fetchTrackMetaAcrossMarkets(
  trackId: string,
  primaryMarket: string,
  fallbacks: string[],
  delayBetweenMarketsMs: number,
) {
  const tried = new Set<string>();
  const order = [primaryMarket, ...fallbacks].filter(Boolean);
  for (let i = 0; i < order.length; i += 1) {
    const m = order[i]!;
    if (tried.has(m)) continue;
    tried.add(m);
    const meta = await getSpotifyTrackMetadataById(trackId, m);
    if (meta) return { meta, market: m } as const;
    if (i + 1 < order.length && delayBetweenMarketsMs > 0) await sleep(delayBetweenMarketsMs);
  }
  return { meta: null, market: primaryMarket } as const;
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");

  const limit = Math.max(1, parseIntArg("limit", 2000));
  const offset = Math.max(0, parseIntArg("offset", 0));
  const delayMs = Math.max(80, parseIntArg("delay-ms", 850));
  const jitterMs = Math.max(0, parseIntArg("jitter-ms", 200));
  const innerDelayMs = Math.max(120, Math.floor(delayMs / 5));
  const primaryMarket = (parseArg("market", "BR") ?? "BR").trim() || "BR";
  const fbRaw = parseArg("fallback-markets", "JP,US,KR") ?? "JP,US,KR";
  const fallbacks = fbRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const markets = [primaryMarket, ...fallbacks.filter((m) => m !== primaryMarket)];
  const onlyEmptyTextAlbum = argv.includes("--only-empty-text-album");

  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  const where = onlyEmptyTextAlbum
    ? {
        albumSpotifyId: null,
        OR: [{ album: null }, { album: "" }],
      }
    : { albumSpotifyId: null };

  const songs = await prisma.song.findMany({
    where,
    select: { id: true, title: true, artist: true, spotifyId: true, album: true },
    orderBy: [{ id: "asc" }],
    skip: offset,
    take: limit,
  });

  console.log(
    JSON.stringify({
      candidatas: songs.length,
      offset,
      limit,
      dry_run: dryRun,
      delay_ms: delayMs,
      jitter_ms: jitterMs,
      inner_delay_ms: innerDelayMs,
      only_empty_text_album: onlyEmptyTextAlbum,
      markets,
    }),
  );

  let ok = 0;
  let skip = 0;
  let fail = 0;
  let via_track_id = 0;
  let via_search = 0;

  for (const s of songs) {
    let meta: Awaited<ReturnType<typeof getSpotifyTrackMetadataById>> = null;
    let marketUsed = primaryMarket;

    const tid = s.spotifyId?.trim() ?? "";

    if (tid) {
      const r = await fetchTrackMetaAcrossMarkets(tid, primaryMarket, fallbacks, delayMs);
      meta = r.meta;
      marketUsed = r.market;
      if (!meta) {
        console.log(`SKIP no_meta_by_id tid=${tid} "${s.title}" — ${s.artist}`);
        skip += 1;
        await sleepWithJitter(delayMs, jitterMs);
        continue;
      }
      if (meta.spotifyId !== tid) {
        console.log(`SKIP id_mismatch esperado=${tid} veio=${meta.spotifyId} "${s.title}"`);
        skip += 1;
        await sleepWithJitter(delayMs, jitterMs);
        continue;
      }
    } else {
      const { hits, market } = await searchTrackCandidates(s.title, s.artist, markets, innerDelayMs);
      const trackId = pickBestTrackId(s.title, s.artist, hits);
      if (!trackId) {
        console.log(`SKIP no_search_hit "${s.title}" — ${s.artist}`);
        skip += 1;
        await sleepWithJitter(delayMs, jitterMs);
        continue;
      }
      meta = await getSpotifyTrackMetadataById(trackId, market);
      if (!meta) {
        console.log(`SKIP no_meta_after_search tid=${trackId} "${s.title}"`);
        skip += 1;
        await sleepWithJitter(delayMs, jitterMs);
        continue;
      }
      marketUsed = market;
    }

    if (!meta.album.spotifyId) {
      console.log(`SKIP spotify_sem_album_id "${s.title}" — ${s.artist}`);
      skip += 1;
      await sleepWithJitter(delayMs, jitterMs);
      continue;
    }

    const res = await applySpotifyMetadataToSong(s.id, meta, dryRun);
    if (!res.ok) {
      console.log(`FAIL "${s.title}" — ${s.artist} :: ${"reason" in res ? res.reason : ""}`);
      fail += 1;
    } else if (dryRun) {
      console.log(`DRY ok ${tid ? "id" : "search"} market=${marketUsed} "${s.title}" — ${s.artist}`);
      ok += 1;
      if (tid) via_track_id += 1;
      else via_search += 1;
    } else {
      console.log(`OK  ${tid ? "id" : "search"} market=${marketUsed} "${s.title}" — ${s.artist}`);
      ok += 1;
      if (tid) via_track_id += 1;
      else via_search += 1;
    }

    await sleepWithJitter(delayMs, jitterMs);
  }

  console.log(JSON.stringify({ ok, skip, fail, dryRun, via_track_id, via_search }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * Pesquisa no Spotify e aplica metadados só em `Song` que já existem no banco (match exato
 * title+artist do JSON). Não cria linhas novas.
 *
 * Lista por omissão: `scripts/data/spotify-update-batch.json`. Sufixo `(hex32)` no fim do
 * título é ignorado na busca Spotify (mantém-se no match com o Prisma).
 *
 * Uso (raiz do projeto):
 *   npx tsx scripts/update-catalog-spotify-from-json.ts --dry-run
 *   npx tsx scripts/update-catalog-spotify-from-json.ts --file=scripts/data/outro.json --delay-ms=550
 *   npx tsx scripts/update-catalog-spotify-from-json.ts --refresh
 *
 * Por omissão só processa músicas sem `spotify_id`. Com `--refresh`, re-baixa metadados
 * mesmo quando já há id.
 *
 * Requer .env: DATABASE_URL, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET.
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

type Row = { title: string; artist: string };

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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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

/** Remove sufixos tipo " - Remastered 2011" para ampliar o match na busca. */
function stripEditionDashSuffix(title: string): string {
  const t = title.trim();
  const m = t.match(/^(.+?)\s+-\s+.+$/);
  if (m && m[1].trim().length >= 2) return m[1].trim();
  return t;
}

/** Id interno no fim do título — removido só para query no Spotify. */
function titleForSpotifySearch(title: string): string {
  return title.replace(/\s*\([a-f0-9]{32}\)\s*$/i, "").trim();
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

function buildSearchQueries(title: string, mainArtist: string, fullArtist: string): string[] {
  const base = titleForSpotifySearch(title);
  const t0 = sanitizeQueryPart(base);
  const t1 = sanitizeQueryPart(stripParenSuffixes(base));
  const t2 = sanitizeQueryPart(stripEditionDashSuffix(stripParenSuffixes(base)));
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
  if (t2 && ma && t2 !== t1 && t2 !== t0) {
    push(`track:"${t2}" artist:"${ma}"`);
    push(`${t2} ${ma}`);
  }
  return out;
}

async function collectSearchHits(
  title: string,
  artist: string,
  markets: string[],
  perQueryLimit: number,
  delayMs: number,
): Promise<TrackHit[]> {
  const main = mainArtistFrom(artist);
  const queries = buildSearchQueries(title, main, artist);
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

async function collectTopTrackHits(
  artist: string,
  markets: string[],
  delayMs: number,
): Promise<TrackHit[]> {
  const main = mainArtistFrom(artist);
  const byId = new Map<string, TrackHit>();
  for (const market of markets) {
    const profiles = await searchSpotifyArtists(main, 5, market);
    await sleep(delayMs);
    for (const ar of profiles) {
      const tops = await getSpotifyArtistTopTracks(ar.spotifyId, market);
      await sleep(delayMs);
      for (const t of tops) {
        const row = mapTrackToResult(t);
        const h: TrackHit = { spotifyId: row.spotifyId, title: row.title, artist: row.artist };
        if (!byId.has(h.spotifyId)) byId.set(h.spotifyId, h);
      }
    }
  }
  return [...byId.values()];
}

async function resolveTrackId(
  title: string,
  artist: string,
  markets: string[],
  delayMs: number,
): Promise<{ trackId: string | null; hits: TrackHit[] }> {
  const matchTitle = titleForSpotifySearch(title);
  let merged = await collectSearchHits(title, artist, markets, 12, delayMs);
  let bestId = pickBestTrackId(matchTitle, artist, merged);
  const hitEarly = bestId ? merged.find((h) => h.spotifyId === bestId) : undefined;
  const earlyScore = hitEarly ? scoreTrackMatch(matchTitle, artist, hitEarly) : 0;
  if (!bestId || earlyScore < 42) {
    const extra = await collectTopTrackHits(artist, markets.slice(0, 2), delayMs);
    const map = new Map<string, TrackHit>();
    for (const h of merged) map.set(h.spotifyId, h);
    for (const h of extra) map.set(h.spotifyId, h);
    merged = [...map.values()];
    bestId = pickBestTrackId(matchTitle, artist, merged);
  }
  return { trackId: bestId, hits: merged };
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const fileArg = argv.find((a) => a.startsWith("--file="))?.split("=")[1] ?? "scripts/data/spotify-update-batch.json";
  const delayMs = Math.max(120, parseInt(argv.find((a) => a.startsWith("--delay-ms="))?.split("=")[1] ?? "520", 10) || 520);
  const limitArg = argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Math.max(1, parseInt(limitArg.split("=")[1] ?? "0", 10) || 0) : 0;
  const marketArg = argv.find((a) => a.startsWith("--market="))?.split("=")[1] ?? "US";
  const dryRun = argv.includes("--dry-run");
  const refresh = argv.includes("--refresh");
  return { fileArg, delayMs, limit, market: marketArg, dryRun, refresh };
}

async function main() {
  const { fileArg, delayMs, limit, market, dryRun, refresh } = parseArgs();

  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  const abs = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);
  const rows = JSON.parse(readFileSync(abs, "utf8")) as Row[];
  const slice = limit > 0 ? rows.slice(0, limit) : rows;

  const markets = [market, market === "US" ? "BR" : "US"].filter((m, i, a) => a.indexOf(m) === i);

  let ok = 0;
  let skip = 0;
  let fail = 0;
  let skipHasSpotify = 0;

  console.log(
    JSON.stringify({
      file: abs,
      total_in_file: rows.length,
      processing: slice.length,
      delay_ms: delayMs,
      dry_run: dryRun,
      refresh,
      markets,
    }),
  );

  for (const row of slice) {
    const song = await prisma.song.findUnique({
      where: { title_artist: { title: row.title, artist: row.artist } },
      select: { id: true, title: true, artist: true, spotifyId: true },
    });

    if (!song) {
      console.log(`SKIP not_in_db "${row.title}" — ${row.artist}`);
      skip += 1;
      await sleep(80);
      continue;
    }

    if (song.spotifyId?.trim() && !refresh) {
      console.log(`SKIP has_spotify "${row.title}" — ${row.artist}`);
      skipHasSpotify += 1;
      await sleep(Math.min(delayMs, 200));
      continue;
    }

    let trackId: string | null = song.spotifyId?.trim() ?? null;

    if (!trackId) {
      const { trackId: found } = await resolveTrackId(row.title, row.artist, markets, delayMs);
      trackId = found;
      if (!trackId) {
        console.log(`SKIP no_spotify_match "${row.title}" — ${row.artist}`);
        skip += 1;
        await sleep(delayMs);
        continue;
      }
    }

    await sleep(delayMs);
    const meta = await getSpotifyTrackMetadataById(trackId, markets[0] ?? "US");
    if (!meta) {
      console.log(`SKIP no_meta ${trackId} "${row.title}"`);
      skip += 1;
      await sleep(delayMs);
      continue;
    }

    const res = await applySpotifyMetadataToSong(song.id, meta, dryRun);
    if (!res.ok) {
      console.log(`FAIL "${row.title}" — ${row.artist} :: ${"reason" in res ? res.reason : ""}`);
      fail += 1;
    } else {
      console.log(`${dryRun ? "DRY" : "OK"} "${row.title}" — ${row.artist} -> ${meta.spotifyId}`);
      ok += 1;
    }

    await sleep(delayMs);
  }

  console.log(JSON.stringify({ ok, skip, fail, skip_has_spotify: skipHasSpotify, dryRun, refresh }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

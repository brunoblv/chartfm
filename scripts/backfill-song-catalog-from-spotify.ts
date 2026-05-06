/**
 * Atualiza músicas que já têm spotify_id mas faltam artistSpotifyId e/ou albumSpotifyId
 * (catálogo: tabelas artists/albums + FKs na Song + ChartEntry).
 *
 * Usa GET /tracks + applySpotifyMetadataToSong — mesmo fluxo robusto da app (inclui albumType).
 *
 * Uso (raiz chartfm):
 *   npx tsx scripts/backfill-song-catalog-from-spotify.ts
 *   npx tsx scripts/backfill-song-catalog-from-spotify.ts --dry-run
 *   npx tsx scripts/backfill-song-catalog-from-spotify.ts --limit=80 --delay-ms=850
 *   npx tsx scripts/backfill-song-catalog-from-spotify.ts --market=BR --fallback-markets=JP,US,KR
 *
 * Requer .env: DATABASE_URL ou DIRECT_URL, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { prisma } from "../lib/prisma";
import { getSpotifyTrackMetadataById, spotifyConfigured } from "../lib/spotify-server";

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

  const limit = Math.max(1, parseIntArg("limit", 5000));
  const offset = Math.max(0, parseIntArg("offset", 0));
  const delayMs = Math.max(50, parseIntArg("delay-ms", 850));
  const primaryMarket = (parseArg("market", "BR") ?? "BR").trim() || "BR";
  const fbRaw = parseArg("fallback-markets", "JP,US,KR") ?? "JP,US,KR";
  const fallbacks = fbRaw.split(",").map((s) => s.trim()).filter(Boolean);

  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  const songs = await prisma.song.findMany({
    where: {
      spotifyId: { not: null },
      OR: [{ artistSpotifyId: null }, { albumSpotifyId: null }],
    },
    select: { id: true, title: true, artist: true, spotifyId: true, artistSpotifyId: true, albumSpotifyId: true },
    orderBy: { id: "asc" },
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
      market: primaryMarket,
      fallbacks,
    }),
  );

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const s of songs) {
    const tid = s.spotifyId!.trim();
    if (!tid) {
      skip += 1;
      continue;
    }

    const { meta, market } = await fetchTrackMetaAcrossMarkets(tid, primaryMarket, fallbacks, delayMs);

    if (!meta) {
      console.log(`SKIP no_meta tid=${tid} "${s.title}" — ${s.artist}`);
      skip += 1;
      continue;
    }

    if (meta.spotifyId !== tid) {
      console.log(`SKIP id_mismatch esperado=${tid} veio=${meta.spotifyId} "${s.title}"`);
      skip += 1;
      continue;
    }

    const res = await applySpotifyMetadataToSong(s.id, meta, dryRun);
    if (!res.ok) {
      console.log(`FAIL "${s.title}" — ${s.artist} :: ${"reason" in res ? res.reason : ""}`);
      fail += 1;
    } else if (dryRun) {
      console.log(`DRY ok market=${market} "${s.title}" — ${s.artist}`);
      ok += 1;
    } else {
      console.log(`OK  market=${market} "${s.title}" — ${s.artist}`);
      ok += 1;
    }

    await sleep(delayMs);
  }

  console.log(JSON.stringify({ ok, skip, fail, dryRun }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

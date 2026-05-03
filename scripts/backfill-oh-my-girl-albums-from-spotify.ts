/**
 * Para cada `Song` da OH MY GIRL na base, obtém metadados de faixa no Spotify
 * (incl. álbum) e aplica com `applySpotifyMetadataToSong`.
 *
 * - Com `spotify_id`: GET /tracks + apply.
 * - Sem `spotify_id`: uma pesquisa `track:"…" artist:"OH MY GIRL"` (+ fallback),
 *   escolhe melhor match, GET /tracks + apply.
 *
 * Pacing: `--delay-ms` (padrão 1000 ms) **após cada chamada** à API de pesquisa
 * ou GET de faixa (e um intervalo extra no fim de cada música após `apply`,
 * que pode fazer GET /artists adicionais no Spotify).
 *
 * Uso:
 *   npx tsx scripts/backfill-oh-my-girl-albums-from-spotify.ts --dry-run
 *   npx tsx scripts/backfill-oh-my-girl-albums-from-spotify.ts --apply
 *   npx tsx scripts/backfill-oh-my-girl-albums-from-spotify.ts --apply --delay-ms=1000 --limit=50
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { prisma } from "../lib/prisma";
import {
  getSpotifyTrackMetadataById,
  searchSpotifyTracks,
  spotifyConfigured,
  type SpotifyTrackMetadata,
} from "../lib/spotify-server";

const OMG_ARTIST_SPOTIFY_ID = "2019zR22qK2RBvCqtudBaI";
const ARTIST_NAME_VARIANTS = ["OhMyGirl", "Oh My Girl", "OH MY GIRL", "Oh my girl"];
const DEFAULT_DELAY_MS = 1000;

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

function parseArg(flag: string, def: string | null): string | null {
  const nf = flag.replace(/^--/, "");
  const a = process.argv.find((x) => x.startsWith(`--${nf}=`));
  if (!a) return def;
  const eq = a.indexOf("=");
  return eq > 0 ? a.slice(eq + 1).trim() || def : def;
}

function parseIntArg(flag: string, def: number): number {
  const v = parseArg(flag, String(def));
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : def;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function sanitizeQueryPart(s: string): string {
  return s.replace(/"/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
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

function tokenOverlapScore(a: string, b: string): number {
  const ta = new Set(a.split(" ").filter((w) => w.length > 1));
  const tb = new Set(b.split(" ").filter((w) => w.length > 1));
  if (!ta.size || !tb.size) return 0;
  let n = 0;
  for (const w of ta) if (tb.has(w)) n += 1;
  return Math.round((n / Math.max(ta.size, tb.size)) * 50);
}

type TrackHit = { spotifyId: string; title: string; artist: string };

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

function metaInvolvesOmg(meta: SpotifyTrackMetadata): boolean {
  return meta.artists.some((a) => a.spotifyId === OMG_ARTIST_SPOTIFY_ID);
}

async function afterSpotify(delayMs: number) {
  if (delayMs > 0) await sleep(delayMs);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run") || !process.argv.includes("--apply");
  const delayMs = Math.max(0, parseIntArg("delay-ms", DEFAULT_DELAY_MS));
  const limit = Math.max(1, parseIntArg("limit", 500));
  const primaryMarket = (parseArg("market", "KR") ?? "KR").trim() || "KR";
  const fb = (parseArg("fallback-markets", "BR,US") ?? "BR,US").split(",").map((s) => s.trim()).filter(Boolean);
  const markets = [primaryMarket, ...fb.filter((m) => m !== primaryMarket)];

  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  const songs = await prisma.song.findMany({
    where: {
      OR: [
        { artistSpotifyId: OMG_ARTIST_SPOTIFY_ID },
        ...ARTIST_NAME_VARIANTS.map((a) => ({
          artist: { equals: a, mode: Prisma.QueryMode.insensitive },
        })),
      ],
    },
    select: {
      id: true,
      title: true,
      artist: true,
      spotifyId: true,
      album: true,
      albumSpotifyId: true,
    },
    orderBy: { id: "asc" },
    take: limit,
  });

  console.log(
    JSON.stringify({
      dryRun,
      delay_ms: delayMs,
      markets,
      songs: songs.length,
    }),
  );

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const song of songs) {
    let meta: SpotifyTrackMetadata | null = null;

    try {
      if (song.spotifyId?.trim()) {
        meta = await getSpotifyTrackMetadataById(song.spotifyId.trim(), markets[0] ?? "KR");
        await afterSpotify(delayMs);
        if (!meta) {
          for (const m of markets.slice(1)) {
            meta = await getSpotifyTrackMetadataById(song.spotifyId.trim(), m);
            await afterSpotify(delayMs);
            if (meta) break;
          }
        }
      } else {
        const t = sanitizeQueryPart(song.title);
        const queries = [
          `track:"${t}" artist:"OH MY GIRL"`,
          `track:"${t}" artist:"OhMyGirl"`,
          `${t} OH MY GIRL`,
        ];
        const hits: TrackHit[] = [];
        for (const market of markets) {
          for (const q of queries) {
            const batch = await searchSpotifyTracks(q, 15, market);
            await afterSpotify(delayMs);
            for (const h of batch) {
              if (!hits.some((x) => x.spotifyId === h.spotifyId)) {
                hits.push({
                  spotifyId: h.spotifyId,
                  title: h.title,
                  artist: h.artist,
                });
              }
            }
          }
        }
        const bestId = pickBestTrackId(song.title, song.artist, hits);
        if (bestId) {
          meta = await getSpotifyTrackMetadataById(bestId, markets[0] ?? "KR");
          await afterSpotify(delayMs);
          if (!meta) {
            for (const m of markets.slice(1)) {
              meta = await getSpotifyTrackMetadataById(bestId, m);
              await afterSpotify(delayMs);
              if (meta) break;
            }
          }
        }
      }

      if (!meta) {
        console.log("SKIP no_meta", song.title, song.artist);
        skip += 1;
        await afterSpotify(delayMs);
        continue;
      }

      if (!metaInvolvesOmg(meta)) {
        console.log("SKIP not_omg_track", song.title, song.artist, meta.primaryArtist?.name);
        skip += 1;
        await afterSpotify(delayMs);
        continue;
      }

      const res = await applySpotifyMetadataToSong(song.id, meta, dryRun);
      if (!res.ok) {
        console.log("FAIL", song.title, song.artist, res);
        fail += 1;
      } else {
        console.log(
          dryRun ? "DRY_OK" : "OK",
          song.title,
          "album=",
          meta.album.title,
          "albumSpotifyId=",
          meta.album.spotifyId,
        );
        ok += 1;
      }
      await afterSpotify(delayMs);
    } catch (e) {
      console.error("ERR", song.title, e);
      fail += 1;
      await afterSpotify(delayMs);
    }
  }

  console.log(JSON.stringify({ ok, skip, fail, dryRun }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * Seed script: inserts @boofrnds historical charts from public/boofrnds/*.txt
 *
 * Usage:
 *   npx tsx scripts/seed-boofrnds.ts
 *   npx tsx scripts/seed-boofrnds.ts --skip-spotify        # no Spotify lookup
 *   npx tsx scripts/seed-boofrnds.ts --delay=500          # ms between Spotify calls
 *   npx tsx scripts/seed-boofrnds.ts --dry-run            # parse only, no DB writes
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

// ── Load .env before Prisma connects ─────────────────────────────────────────
const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

const prisma = new PrismaClient();

// ── Config ────────────────────────────────────────────────────────────────────
const HANDLE = "boofrnds";
const TXT_DIR = join(process.cwd(), "public", "boofrnds");
const SKIP_SPOTIFY = process.argv.includes("--skip-spotify");
const DRY_RUN = process.argv.includes("--dry-run");
const DELAY_ARG = process.argv.find((a) => a.startsWith("--delay="));
const SPOTIFY_DELAY_MS = DELAY_ARG ? Math.max(100, parseInt(DELAY_ARG.split("=")[1], 10)) : 200;

// ── Types ─────────────────────────────────────────────────────────────────────
type ParsedEntry = {
  position: number;
  artist: string;
  title: string;
  weeks: number;
  peak: number;
  movement: string; // "=", "+N", "-N", "DEBUT"
};

type ParsedWeek = {
  startDate: Date;
  endDate: Date;
  entries: ParsedEntry[];
};

type SpotifyHit = {
  spotifyId: string;
  title: string;
  primaryArtistId: string | null;
  primaryArtistName: string | null;
  albumSpotifyId: string | null;
  albumTitle: string | null;
  albumType: "SINGLE" | "EP" | "ALBUM" | "COMPILATION" | null;
  albumCoverUrl: string | null;
  albumReleaseDate: Date | null;
  albumTotalTracks: number | null;
  albumSpotifyUrl: string | null;
  durationMs: number | null;
  trackNumber: number | null;
  previewUrl: string | null;
  spotifyUrl: string | null;
  featuredArtists: { spotifyId: string; name: string }[];
};

// ── File parser ───────────────────────────────────────────────────────────────
function parseDDMMYYYY(s: string): Date {
  const [dd, mm, yyyy] = s.trim().split("/").map(Number);
  return new Date(yyyy, mm - 1, dd);
}

function parseFile(filePath: string): ParsedWeek[] {
  const weeks: ParsedWeek[] = [];
  let current: ParsedWeek | null = null;
  let inFallOffs = false;

  for (const raw of readFileSync(filePath, "utf-8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    // Date range: [ DD/MM/YYYY - DD/MM/YYYY ]
    const dateM = line.match(/^\[\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})\s*\]\s*$/);
    if (dateM) {
      if (current && current.entries.length > 0) weeks.push(current);
      current = {
        startDate: parseDDMMYYYY(dateM[1]),
        endDate: parseDDMMYYYY(dateM[2]),
        entries: [],
      };
      inFallOffs = false;
      continue;
    }

    // FALL OFFS section — skip until next date range
    if (line.startsWith("@ FALL OFFS") || line.includes("@ FALL OFFS @")) {
      inFallOffs = true;
      continue;
    }

    if (inFallOffs || !current) continue;

    // Chart entry: #NN) Artist, "Title" [stats]
    // Artist may contain "f/", "&", ";" but NOT a comma before the quote
    const m = line.match(/^#(\d+)\)\s+(.+),\s+"([^"]+)"\s*\[([^\]]+)\]/);
    if (!m) continue;

    const stats = m[4];
    const weeksM = stats.match(/(\d+)\w+\s+week/i);
    const peakM = stats.match(/Peak:\s*(\d+)/i);
    const parts = stats.split("/");
    const movement = parts[1]?.trim() ?? "DEBUT";

    current.entries.push({
      position: parseInt(m[1], 10),
      artist: m[2].trim(),
      title: m[3].trim(),
      weeks: weeksM ? parseInt(weeksM[1], 10) : 1,
      peak: peakM ? parseInt(peakM[1], 10) : parseInt(m[1], 10),
      movement,
    });
  }

  if (current && current.entries.length > 0) weeks.push(current);
  return weeks;
}

// ── Week helpers ──────────────────────────────────────────────────────────────
function isoWeekNum(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - y0.getTime()) / 86400000 + 1) / 7);
}

function isoWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return d.getUTCFullYear();
}

function buildWeekIndex(date: Date): number {
  return isoWeekYear(date) * 100 + isoWeekNum(date);
}

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// ── Movement parsing ──────────────────────────────────────────────────────────
// delta = prevPos - pos (positive = moved up in chart, lower chart number)
// prevPos = pos + delta
function parseMovement(movement: string, pos: number) {
  if (movement.toUpperCase() === "DEBUT") return { delta: null, prevPos: null, status: "new" };
  if (movement === "=") return { delta: 0, prevPos: pos, status: "same" };
  const n = parseInt(movement, 10); // "+6" → 6, "-3" → -3
  if (!Number.isNaN(n)) return { delta: n, prevPos: pos + n, status: n > 0 ? "up" : "down" };
  return { delta: null, prevPos: null, status: "new" };
}

// ── Palette (matches chart route) ─────────────────────────────────────────────
const PALETTES: [string, string][] = [
  ["#FF6B6B", "#FFE66D"], ["#4ECDC4", "#556270"], ["#C7F464", "#4ECDC4"],
  ["#FF8C94", "#FFAAA5"], ["#A8E6CF", "#3D5A80"], ["#E07856", "#F2D8A7"],
  ["#2E294E", "#EA698B"], ["#1B2021", "#FFD166"], ["#EF476F", "#06D6A0"],
  ["#073B4C", "#FFD166"], ["#8338EC", "#FB5607"],
];

function paletteFor(artist: string, title: string) {
  const key = artist + title;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % PALETTES.length;
  return { a: PALETTES[idx][0], b: PALETTES[idx][1], seed: Math.abs(h) };
}

// ── Spotify client ─────────────────────────────────────────────────────────────
const spotifyState = {
  token: null as string | null,
  expiresAt: 0,
  cache: new Map<string, SpotifyHit | null>(),
};

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function getSpotifyToken(): Promise<string | null> {
  if (spotifyState.token && Date.now() < spotifyState.expiresAt) return spotifyState.token;
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) return null;
  const data = await res.json() as { access_token: string; expires_in: number };
  spotifyState.token = data.access_token;
  spotifyState.expiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return spotifyState.token;
}

function parseAlbumType(raw: string | undefined): SpotifyHit["albumType"] {
  const v = (raw ?? "").toUpperCase();
  if (v === "SINGLE" || v === "EP" || v === "ALBUM" || v === "COMPILATION") return v;
  return null;
}

function parseReleaseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T00:00:00Z`);
  if (/^\d{4}-\d{2}$/.test(raw)) return new Date(`${raw}-01T00:00:00Z`);
  if (/^\d{4}$/.test(raw)) return new Date(`${raw}-01-01T00:00:00Z`);
  return null;
}

async function searchSpotifyTrack(artist: string, title: string): Promise<SpotifyHit | null> {
  const cacheKey = `${artist.toLowerCase()}|${title.toLowerCase()}`;
  if (spotifyState.cache.has(cacheKey)) return spotifyState.cache.get(cacheKey)!;

  // Respectful delay before every real request
  await sleep(SPOTIFY_DELAY_MS);

  const token = await getSpotifyToken();
  if (!token) {
    spotifyState.cache.set(cacheKey, null);
    return null;
  }

  // Strip featured artists for cleaner query: "Ariana Grande f/ Nicki Minaj" → "Ariana Grande"
  const mainArtist = artist.split(/\s+f\/\s+/i)[0].trim();
  const q = `track:"${title.replace(/"/g, "")}" artist:"${mainArtist.replace(/"/g, "")}"`;

  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", q);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", "3");
  url.searchParams.set("market", "BR");

  let res: Response | null = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });

      if (res.status === 429) {
        const retryAfterSec = parseInt(res.headers.get("retry-after") ?? "10", 10);
        const wait = Math.max(5000, retryAfterSec * 1000);
        console.log(`\n  [Spotify 429] Retry-After: ${retryAfterSec}s — waiting ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }

      if (res.status === 401) {
        // Token expired mid-run, clear and retry
        spotifyState.token = null;
        const freshToken = await getSpotifyToken();
        if (!freshToken) break;
        res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${freshToken}` } });
      }

      break;
    } catch {
      if (attempt >= 4) break;
      await sleep(1000 * attempt);
    }
  }

  if (!res?.ok) {
    spotifyState.cache.set(cacheKey, null);
    return null;
  }

  const json = await res.json() as { tracks?: { items: any[] } };
  const track = json.tracks?.items?.[0];
  if (!track) {
    spotifyState.cache.set(cacheKey, null);
    return null;
  }

  const feats = (track.artists as any[]).slice(1).map((a: any) => ({
    spotifyId: a.id as string,
    name: a.name as string,
  }));

  const hit: SpotifyHit = {
    spotifyId: track.id,
    title: track.name,
    primaryArtistId: track.artists[0]?.id ?? null,
    primaryArtistName: track.artists[0]?.name ?? null,
    albumSpotifyId: track.album?.id ?? null,
    albumTitle: track.album?.name ?? null,
    albumType: parseAlbumType(track.album?.album_type),
    albumCoverUrl: (track.album?.images as any[])?.[0]?.url ?? null,
    albumReleaseDate: parseReleaseDate(track.album?.release_date),
    albumTotalTracks: track.album?.total_tracks ?? null,
    albumSpotifyUrl: track.album?.external_urls?.spotify ?? null,
    durationMs: track.duration_ms ?? null,
    trackNumber: track.track_number ?? null,
    previewUrl: track.preview_url ?? null,
    spotifyUrl: track.external_urls?.spotify ?? null,
    featuredArtists: feats,
  };

  spotifyState.cache.set(cacheKey, hit);
  return hit;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n=== Seed @boofrnds charts ===");
  console.log(`  Skip Spotify : ${SKIP_SPOTIFY}`);
  console.log(`  Spotify delay: ${SPOTIFY_DELAY_MS}ms`);
  console.log(`  Dry run      : ${DRY_RUN}`);
  console.log();

  // Parse files first (no DB needed)
  const files = readdirSync(TXT_DIR)
    .filter((f) => f.endsWith(".txt"))
    .sort()
    .map((f) => join(TXT_DIR, f));

  const allWeeks: ParsedWeek[] = [];
  for (const f of files) {
    const weeks = parseFile(f);
    const name = f.split(/[\\/]/).pop()!;
    console.log(`  Parsed ${name}: ${weeks.length} weeks`);
    allWeeks.push(...weeks);
  }

  allWeeks.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  console.log(`\nTotal: ${allWeeks.length} weeks parsed\n`);

  if (DRY_RUN) {
    console.log("[DRY RUN] Sample output (first 5 weeks):");
    for (const w of allWeeks.slice(0, 5)) {
      console.log(`\n  ${fmtDate(w.startDate)} - ${fmtDate(w.endDate)}  (${w.entries.length} entries)`);
      for (const e of w.entries.slice(0, 3)) {
        console.log(`    #${String(e.position).padStart(2, "0")}  ${e.artist} — "${e.title}"  [${e.weeks}w, mv:${e.movement}, peak:${e.peak}]`);
      }
      if (w.entries.length > 3) console.log(`    ... and ${w.entries.length - 3} more`);
    }
    return;
  }

  if (!SKIP_SPOTIFY && !process.env.SPOTIFY_CLIENT_ID) {
    console.warn("  [WARN] SPOTIFY_CLIENT_ID not set — Spotify lookups will be skipped.");
  }

  // 1. Find user
  const user = await prisma.user.findUnique({
    where: { handle: HANDLE },
    select: { id: true, name: true, paradaNome: true },
  });
  if (!user) {
    console.error(`User @${HANDLE} not found. Create the user in the DB first.`);
    process.exit(1);
  }
  console.log(`User: @${HANDLE}  id=${user.id}`);

  // 2. Get or create primary Parada
  let parada = await prisma.parada.findFirst({
    where: { userId: user.id, isPrimary: true },
  });
  if (!parada) {
    parada = await prisma.parada.findFirst({ where: { userId: user.id } });
  }

  if (!parada) {
    const paradaName =
      user.paradaNome?.trim() ||
      `Parada de ${user.name.split(" ")[0] || HANDLE}`;
    parada = await prisma.parada.create({
      data: { userId: user.id, name: paradaName, isPrimary: true, sortOrder: 0 },
    });
    console.log(`Created Parada: "${parada.name}" (${parada.id})`);
  }

  console.log(`Parada: "${parada.name}"  id=${parada.id}\n`);

  // 4. Process each week
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const week of allWeeks) {
    const wi = buildWeekIndex(week.startDate);

    // Idempotent: skip if chart already exists
    const existing = await prisma.chart.findUnique({
      where: { paradaId_weekIndex: { paradaId: parada.id, weekIndex: wi } },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const weekLabel = `Semana ${isoWeekNum(week.startDate)} - ${isoWeekYear(week.startDate)}`;
    const dateRange = `${fmtDate(week.startDate)} a ${fmtDate(week.endDate)}`;
    process.stdout.write(`${dateRange}  (${String(week.entries.length).padStart(2)} songs) ... `);

    try {
      const songRefs: { id: string; spotifyId: string | null; albumSpotifyId: string | null }[] = [];

      for (const entry of week.entries) {
        let hit: SpotifyHit | null = null;

        if (!SKIP_SPOTIFY && process.env.SPOTIFY_CLIENT_ID) {
          hit = await searchSpotifyTrack(entry.artist, entry.title);

          if (hit) {
            // Upsert primary artist
            if (hit.primaryArtistId) {
              await prisma.artist.upsert({
                where: { spotifyId: hit.primaryArtistId },
                update: { name: hit.primaryArtistName! },
                create: { spotifyId: hit.primaryArtistId, name: hit.primaryArtistName! },
              });
            }

            // Upsert album
            if (hit.albumSpotifyId && hit.primaryArtistId) {
              await prisma.album.upsert({
                where: { spotifyId: hit.albumSpotifyId },
                update: {
                  title: hit.albumTitle ?? "Unknown",
                  artistSpotifyId: hit.primaryArtistId,
                  ...(hit.albumCoverUrl != null ? { coverUrl: hit.albumCoverUrl } : {}),
                  ...(hit.albumReleaseDate != null ? { releaseDate: hit.albumReleaseDate } : {}),
                  ...(hit.albumTotalTracks != null ? { totalTracks: hit.albumTotalTracks } : {}),
                  ...(hit.albumType != null ? { albumType: hit.albumType } : {}),
                  ...(hit.albumSpotifyUrl != null ? { spotifyUrl: hit.albumSpotifyUrl } : {}),
                },
                create: {
                  spotifyId: hit.albumSpotifyId,
                  title: hit.albumTitle ?? "Unknown",
                  artistSpotifyId: hit.primaryArtistId,
                  coverUrl: hit.albumCoverUrl ?? null,
                  releaseDate: hit.albumReleaseDate ?? null,
                  totalTracks: hit.albumTotalTracks ?? null,
                  albumType: hit.albumType ?? null,
                  spotifyUrl: hit.albumSpotifyUrl ?? null,
                },
              });
            }

            // Upsert featured artists
            for (const feat of hit.featuredArtists) {
              await prisma.artist.upsert({
                where: { spotifyId: feat.spotifyId },
                update: { name: feat.name },
                create: { spotifyId: feat.spotifyId, name: feat.name },
              });
            }
          }
        }

        // Upsert Song
        let song: { id: string; spotifyId: string | null; albumSpotifyId: string | null };

        if (hit?.spotifyId) {
          // Upsert by Spotify ID (canonical)
          song = await prisma.song.upsert({
            where: { spotifyId: hit.spotifyId },
            update: {
              title: hit.title,
              artist: hit.primaryArtistName ?? entry.artist,
              ...(hit.albumTitle != null ? { album: hit.albumTitle } : {}),
              ...(hit.primaryArtistId != null ? { artistSpotifyId: hit.primaryArtistId } : {}),
              ...(hit.albumSpotifyId != null ? { albumSpotifyId: hit.albumSpotifyId } : {}),
              ...(hit.durationMs != null ? { durationMs: hit.durationMs } : {}),
              ...(hit.previewUrl != null ? { previewUrl: hit.previewUrl } : {}),
              ...(hit.spotifyUrl != null ? { spotifyUrl: hit.spotifyUrl } : {}),
              ...(hit.trackNumber != null ? { trackNumber: hit.trackNumber } : {}),
            },
            create: {
              title: hit.title,
              artist: hit.primaryArtistName ?? entry.artist,
              album: hit.albumTitle ?? null,
              spotifyId: hit.spotifyId,
              artistSpotifyId: hit.primaryArtistId ?? null,
              albumSpotifyId: hit.albumSpotifyId ?? null,
              durationMs: hit.durationMs ?? null,
              previewUrl: hit.previewUrl ?? null,
              spotifyUrl: hit.spotifyUrl ?? null,
              trackNumber: hit.trackNumber ?? null,
            },
            select: { id: true, spotifyId: true, albumSpotifyId: true },
          });

          // Upsert song_feats (featured artists relationship)
          if (song.spotifyId) {
            for (const feat of hit.featuredArtists) {
              await prisma.songFeat.upsert({
                where: {
                  songSpotifyId_artistSpotifyId: {
                    songSpotifyId: song.spotifyId,
                    artistSpotifyId: feat.spotifyId,
                  },
                },
                update: {},
                create: {
                  songSpotifyId: song.spotifyId,
                  artistSpotifyId: feat.spotifyId,
                },
              });
            }
          }
        } else {
          // No Spotify hit: upsert by title + artist text
          const found = await prisma.song.findFirst({
            where: { title: entry.title, artist: entry.artist },
            select: { id: true, spotifyId: true, albumSpotifyId: true },
          });
          song = found ?? await prisma.song.create({
            data: { title: entry.title, artist: entry.artist },
            select: { id: true, spotifyId: true, albumSpotifyId: true },
          });
        }

        songRefs.push(song);
      }

      // Build ChartEntry data using parsed stats (no need to query previous chart)
      const entryData = week.entries.map((e, i) => {
        const song = songRefs[i];
        const { delta, prevPos, status } = parseMovement(e.movement, e.position);
        const pal = paletteFor(e.artist, e.title);
        return {
          songId: song.id,
          songSpotifyId: song.spotifyId ?? null,
          albumSpotifyId: song.albumSpotifyId ?? null,
          points: 101 - e.position, // primary-parada scoring: #1 = 100 pts
          position: e.position,
          status,
          delta,
          prevPos,
          peak: e.peak,
          weeks: e.weeks,
          coverPaletteA: pal.a,
          coverPaletteB: pal.b,
          coverSeed: pal.seed,
        };
      });

      await prisma.chart.create({
        data: {
          userId: user.id,
          paradaId: parada.id,
          weekIndex: wi,
          weekLabel,
          dateRange,
          publishedAt: week.endDate,
          weekStartDate: week.startDate,
          entries: { create: entryData },
        },
      });

      inserted++;
      console.log("OK");
    } catch (err) {
      errors++;
      console.log(`ERROR: ${(err as Error).message}`);
    }
  }

  // Summary
  const spotifyHits = spotifyState.cache.size > 0
    ? `${[...spotifyState.cache.values()].filter(Boolean).length}/${spotifyState.cache.size} Spotify hits`
    : "Spotify skipped";

  console.log(`\n=== Done! ===`);
  console.log(`  Inserted : ${inserted}`);
  console.log(`  Skipped  : ${skipped} (already existed)`);
  console.log(`  Errors   : ${errors}`);
  console.log(`  ${spotifyHits}`);
}

main()
  .catch((err) => {
    console.error("\nFatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

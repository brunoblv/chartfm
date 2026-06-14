/**
 * Seed script: insere paradas LADO B do @brunurbano a partir da planilha Excel.
 *
 * Usage:
 *   npx tsx scripts/seed-brunurbano-lado-b.ts
 *   npx tsx scripts/seed-brunurbano-lado-b.ts --xlsx="C:\Users\...\LADO B.xlsx"
 *   npx tsx scripts/seed-brunurbano-lado-b.ts --json=scripts/data/lado-b-2026.json
 *   npx tsx scripts/seed-brunurbano-lado-b.ts --dry-run
 *   npx tsx scripts/seed-brunurbano-lado-b.ts --skip-spotify
 *   npx tsx scripts/seed-brunurbano-lado-b.ts --patch-songs
 */

import { PrismaClient } from "@prisma/client";
import { execFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  buildDateRangeFromDate,
  buildWeekIndexFromDate,
  buildWeekLabelFromDate,
  getChartWeekRange,
  prevChartWeekIndex,
} from "../lib/chart-week";
import { computeStreakForCadence } from "../lib/chart-cadence";
import { pointsForChartPosition, scoringTierFromPrimary } from "../lib/parada-points";

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

const HANDLE = "brunurbano";
const PARADA_NAME = "LADO B";
const DEFAULT_JSON = join(process.cwd(), "scripts", "data", "lado-b-2026.json");
const DEFAULT_XLSX = "C:\\Users\\blvbr\\Downloads\\LADO B.xlsx";
const PARSE_PY = join(process.cwd(), "scripts", "parse-lado-b-xlsx.py");

const SKIP_SPOTIFY = process.argv.includes("--skip-spotify");
const DRY_RUN = process.argv.includes("--dry-run");
const PATCH_SONGS = process.argv.includes("--patch-songs");
const JSON_ARG = process.argv.find((a) => a.startsWith("--json="));
const XLSX_ARG = process.argv.find((a) => a.startsWith("--xlsx="));
const DELAY_ARG = process.argv.find((a) => a.startsWith("--delay="));
const SPOTIFY_DELAY_MS = DELAY_ARG ? Math.max(100, parseInt(DELAY_ARG.split("=")[1], 10)) : 200;

type RawEntry = { position: number; artist: string; title: string };
type RawWeek = { label: string; date: string; entries: RawEntry[] };

type ParsedWeek = {
  label: string;
  refDate: Date;
  startDate: Date;
  endDate: Date;
  entries: RawEntry[];
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

const PALETTES: [string, string][] = [
  ["#FF6B6B", "#FFE66D"], ["#4ECDC4", "#556270"], ["#C7F464", "#4ECDC4"],
  ["#FF8C94", "#FFAAA5"], ["#A8E6CF", "#3D5A80"], ["#E07856", "#F2D8A7"],
  ["#2E294E", "#EA698B"], ["#1B2021", "#FFD166"], ["#EF476F", "#06D6A0"],
  ["#073B4C", "#FFD166"], ["#8338EC", "#FB5607"],
];

const spotifyState = {
  token: null as string | null,
  expiresAt: 0,
  cache: new Map<string, SpotifyHit | null>(),
};

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function paletteFor(artist: string, title: string) {
  const key = artist + title;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % PALETTES.length;
  return { a: PALETTES[idx][0], b: PALETTES[idx][1], seed: Math.abs(h) };
}

function parseDateYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function loadRawWeeks(): RawWeek[] {
  if (XLSX_ARG) {
    const xlsxPath = XLSX_ARG.split("=").slice(1).join("=");
    if (!existsSync(xlsxPath)) throw new Error(`XLSX não encontrado: ${xlsxPath}`);
    const out = execFileSync("python", [PARSE_PY, xlsxPath], { encoding: "utf-8" });
    return JSON.parse(out) as RawWeek[];
  }

  const jsonPath = JSON_ARG ? JSON_ARG.split("=").slice(1).join("=") : DEFAULT_JSON;
  if (existsSync(jsonPath)) {
    return JSON.parse(readFileSync(jsonPath, "utf-8")) as RawWeek[];
  }

  if (existsSync(DEFAULT_XLSX)) {
    const out = execFileSync("python", [PARSE_PY, DEFAULT_XLSX], { encoding: "utf-8" });
    return JSON.parse(out) as RawWeek[];
  }

  throw new Error(`Nenhuma fonte encontrada. Use --json= ou --xlsx=`);
}

function normalizeWeeks(raw: RawWeek[]): ParsedWeek[] {
  return raw
    .map((w) => {
      const refDate = parseDateYmd(w.date);
      const { start, end } = getChartWeekRange(refDate);
      const entries = [...w.entries].sort((a, b) => a.position - b.position);
      return { label: w.label, refDate, startDate: start, endDate: end, entries };
    })
    .sort((a, b) => a.refDate.getTime() - b.refDate.getTime());
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

function mapTrackToHit(track: any): SpotifyHit {
  const feats = (track.artists as any[]).slice(1).map((a: any) => ({
    spotifyId: a.id as string,
    name: a.name as string,
  }));
  return {
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
  const data = (await res.json()) as { access_token: string; expires_in: number };
  spotifyState.token = data.access_token;
  spotifyState.expiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return spotifyState.token;
}

async function spotifyGet(path: string, token: string): Promise<any | null> {
  let res: Response | null = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      res = await fetch(`https://api.spotify.com/v1${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 429) {
        const wait = Math.max(5000, parseInt(res.headers.get("retry-after") ?? "10", 10) * 1000);
        await sleep(wait);
        continue;
      }
      if (res.status === 401) {
        spotifyState.token = null;
        const fresh = await getSpotifyToken();
        if (!fresh) return null;
        res = await fetch(`https://api.spotify.com/v1${path}`, {
          headers: { Authorization: `Bearer ${fresh}` },
        });
      }
      break;
    } catch {
      if (attempt >= 4) return null;
      await sleep(1000 * attempt);
    }
  }
  if (!res?.ok) return null;
  return res.json();
}

function sanitizeForSearch(s: string): string {
  return s.replace(/[!$@#%^&*()+\[\]{}|\\<>?]/g, "").replace(/\s+/g, " ").trim();
}

async function searchSpotifyTrack(artist: string, title: string): Promise<SpotifyHit | null> {
  const cacheKey = `${artist.toLowerCase()}|${title.toLowerCase()}`;
  if (spotifyState.cache.has(cacheKey)) return spotifyState.cache.get(cacheKey)!;

  await sleep(SPOTIFY_DELAY_MS);
  const token = await getSpotifyToken();
  if (!token) {
    spotifyState.cache.set(cacheKey, null);
    return null;
  }

  const mainArtist = artist.split(/\s+ft\s+/i)[0].split(/\s+f\/\s+/i)[0].trim();
  const queries = [
    `track:"${title.replace(/"/g, "")}" artist:"${mainArtist.replace(/"/g, "")}"`,
    `track:"${sanitizeForSearch(title)}" artist:"${sanitizeForSearch(mainArtist)}"`,
  ];
  const uniqueQueries = [...new Set(queries)];

  let track: any = null;
  for (const q of uniqueQueries) {
    const url = new URL("https://api.spotify.com/v1/search");
    url.searchParams.set("q", q);
    url.searchParams.set("type", "track");
    url.searchParams.set("limit", "3");
    url.searchParams.set("market", "BR");
    const json = await spotifyGet(`/search?${url.searchParams.toString()}`, token);
    track = json?.tracks?.items?.[0] ?? null;
    if (track) break;
    if (uniqueQueries.length > 1) await sleep(SPOTIFY_DELAY_MS);
  }

  if (!track) {
    spotifyState.cache.set(cacheKey, null);
    return null;
  }

  const hit = mapTrackToHit(track);
  spotifyState.cache.set(cacheKey, hit);
  return hit;
}

async function upsertSpotifyEntities(hit: SpotifyHit) {
  if (hit.primaryArtistId) {
    await prisma.artist.upsert({
      where: { spotifyId: hit.primaryArtistId },
      update: { name: hit.primaryArtistName! },
      create: { spotifyId: hit.primaryArtistId, name: hit.primaryArtistName! },
    });
  }
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
  for (const feat of hit.featuredArtists) {
    await prisma.artist.upsert({
      where: { spotifyId: feat.spotifyId },
      update: { name: feat.name },
      create: { spotifyId: feat.spotifyId, name: feat.name },
    });
  }
}

async function upsertSong(entry: RawEntry, hit: SpotifyHit | null) {
  if (hit?.spotifyId) {
    await upsertSpotifyEntities(hit);
    const canonicalArtist = hit.primaryArtistName ?? entry.artist;
    const spotifyData = {
      album: hit.albumTitle ?? undefined,
      artistSpotifyId: hit.primaryArtistId ?? undefined,
      albumSpotifyId: hit.albumSpotifyId ?? undefined,
      durationMs: hit.durationMs ?? undefined,
      previewUrl: hit.previewUrl ?? undefined,
      spotifyUrl: hit.spotifyUrl ?? undefined,
      trackNumber: hit.trackNumber ?? undefined,
    };

    const existingByName = await prisma.song.findFirst({
      where: { title: hit.title, artist: canonicalArtist },
      select: { id: true, spotifyId: true, albumSpotifyId: true },
    });

    const song = existingByName
      ? await prisma.song.update({
          where: { id: existingByName.id },
          data: {
            ...(existingByName.spotifyId == null ? { spotifyId: hit.spotifyId } : {}),
            ...spotifyData,
          },
          select: { id: true, spotifyId: true, albumSpotifyId: true },
        })
      : await prisma.song.upsert({
          where: { spotifyId: hit.spotifyId },
          update: { title: hit.title, artist: canonicalArtist, ...spotifyData },
          create: {
            title: hit.title,
            artist: canonicalArtist,
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
          create: { songSpotifyId: song.spotifyId, artistSpotifyId: feat.spotifyId },
        });
      }
    }
    return song;
  }

  const found = await prisma.song.findFirst({
    where: { title: entry.title, artist: entry.artist },
    select: { id: true, spotifyId: true, albumSpotifyId: true },
  });
  return (
    found ??
    (await prisma.song.create({
      data: { title: entry.title, artist: entry.artist },
      select: { id: true, spotifyId: true, albumSpotifyId: true },
    }))
  );
}

async function resolveParada(userId: string, userName: string) {
  let parada = await prisma.parada.findFirst({
    where: { userId, name: { equals: PARADA_NAME, mode: "insensitive" } },
  });
  if (parada) return parada;

  const existing = await prisma.parada.findMany({
    where: { userId },
    select: { sortOrder: true },
    orderBy: { sortOrder: "desc" },
    take: 1,
  });
  const sortOrder = (existing[0]?.sortOrder ?? -1) + 1;
  const isPrimary = sortOrder === 0;

  parada = await prisma.parada.create({
    data: {
      userId,
      name: PARADA_NAME,
      isPrimary,
      sortOrder,
      chartSize: 25,
    },
  });
  console.log(`Criada parada "${PARADA_NAME}" (${parada.id})`);
  return parada;
}

async function seedCharts() {
  console.log("\n=== Seed @brunurbano — LADO B ===");
  console.log(`  Skip Spotify : ${SKIP_SPOTIFY}`);
  console.log(`  Dry run      : ${DRY_RUN}\n`);

  const raw = loadRawWeeks();
  const weeks = normalizeWeeks(raw);
  console.log(`Semanas parseadas: ${weeks.length}`);
  for (const w of weeks) {
    console.log(`  ${w.label} (${buildDateRangeFromDate(w.refDate)}) — ${w.entries.length} músicas`);
  }

  if (DRY_RUN) return;

  const user = await prisma.user.findUnique({
    where: { handle: HANDLE },
    select: { id: true, name: true },
  });
  if (!user) {
    console.error(`Usuário @${HANDLE} não encontrado.`);
    process.exit(1);
  }
  console.log(`\nUsuário: @${HANDLE} (id=${user.id})`);

  const parada = await resolveParada(user.id, user.name);
  const scoringTier = scoringTierFromPrimary(parada.isPrimary);
  console.log(`Parada: "${parada.name}" (id=${parada.id}, tier=${scoringTier})\n`);

  if (!SKIP_SPOTIFY && !process.env.SPOTIFY_CLIENT_ID) {
    console.warn("  [WARN] SPOTIFY_CLIENT_ID ausente — busca Spotify desativada.");
  }

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const week of weeks) {
    const weekIndex = buildWeekIndexFromDate(week.refDate);
    const existing = await prisma.chart.findUnique({
      where: { paradaId_weekIndex: { paradaId: parada.id, weekIndex } },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const weekLabel = buildWeekLabelFromDate(week.refDate);
    const dateRange = buildDateRangeFromDate(week.refDate);
    process.stdout.write(`${week.label} — ${dateRange} (${week.entries.length}) ... `);

    try {
      const songRefs: { id: string; spotifyId: string | null; albumSpotifyId: string | null }[] = [];
      for (const entry of week.entries) {
        let hit: SpotifyHit | null = null;
        if (!SKIP_SPOTIFY && process.env.SPOTIFY_CLIENT_ID) {
          hit = await searchSpotifyTrack(entry.artist, entry.title);
        }
        songRefs.push(await upsertSong(entry, hit));
      }

      const prevWeekIndex = prevChartWeekIndex(weekIndex);
      const previousChart = await prisma.chart.findFirst({
        where: { paradaId: parada.id, weekIndex: prevWeekIndex },
        include: { entries: true },
      });
      const historicalRows = await prisma.chartEntry.findMany({
        where: {
          songId: { in: [...new Set(songRefs.map((s) => s.id))] },
          chart: { paradaId: parada.id, weekIndex: { lt: weekIndex } },
        },
        select: { songId: true },
        distinct: ["songId"],
      });
      const historicalSongIds = new Set(historicalRows.map((r) => r.songId));
      const chartSize = week.entries.length;

      const entryData = week.entries.map((entry, i) => {
        const song = songRefs[i];
        const pos = entry.position;
        const points = pointsForChartPosition(pos, scoringTier, chartSize, parada.cadence);
        const prev = previousChart?.entries.find((pe) => pe.songId === song.id);
        const pal = paletteFor(entry.artist, entry.title);

        if (!prev) {
          return {
            songId: song.id,
            songSpotifyId: song.spotifyId,
            albumSpotifyId: song.albumSpotifyId,
            points,
            position: pos,
            status: historicalSongIds.has(song.id) ? "return" : "new",
            delta: null,
            prevPos: null,
            peak: pos,
            weeks: 1,
            coverPaletteA: pal.a,
            coverPaletteB: pal.b,
            coverSeed: pal.seed,
          };
        }

        const delta = prev.position - pos;
        return {
          songId: song.id,
          songSpotifyId: song.spotifyId,
          albumSpotifyId: song.albumSpotifyId,
          points,
          position: pos,
          status: delta > 0 ? "up" : delta < 0 ? "down" : "same",
          delta,
          prevPos: prev.position,
          peak: Math.min(pos, prev.peak),
          weeks: prev.weeks + 1,
          coverPaletteA: pal.a,
          coverPaletteB: pal.b,
          coverSeed: pal.seed,
        };
      });

      await prisma.chart.create({
        data: {
          userId: user.id,
          paradaId: parada.id,
          weekIndex,
          weekLabel,
          dateRange,
          publishedAt: week.endDate,
          weekStartDate: week.startDate,
          maxItems: chartSize,
          entries: { create: entryData },
        },
      });

      inserted++;
      console.log("OK");
    } catch (err) {
      errors++;
      console.log(`ERRO: ${(err as Error).message}`);
    }
  }

  if (parada.isPrimary) {
    const primaryWeeks = await prisma.chart.findMany({
      where: { userId: user.id, paradaId: parada.id },
      select: { weekIndex: true },
      orderBy: { weekIndex: "desc" },
    });
    const streak = computeStreakForCadence(primaryWeeks.map((w) => w.weekIndex), "WEEKLY");
    await prisma.user.update({ where: { id: user.id }, data: { streak } });
    console.log(`Streak atualizado: ${streak}`);
  }

  const spotifyHits =
    spotifyState.cache.size > 0
      ? `${[...spotifyState.cache.values()].filter(Boolean).length}/${spotifyState.cache.size} no Spotify`
      : "Spotify ignorado";

  console.log(`\n=== Concluído ===`);
  console.log(`  Inseridas : ${inserted}`);
  console.log(`  Puladas   : ${skipped} (já existiam)`);
  console.log(`  Erros     : ${errors}`);
  console.log(`  ${spotifyHits}`);
}

async function patchMissingSongs() {
  console.log("\n=== Patch: músicas sem Spotify (@brunurbano / LADO B) ===\n");
  const user = await prisma.user.findUnique({
    where: { handle: HANDLE },
    select: { id: true },
  });
  if (!user) {
    console.error(`Usuário @${HANDLE} não encontrado.`);
    process.exit(1);
  }

  const parada = await prisma.parada.findFirst({
    where: { userId: user.id, name: { equals: PARADA_NAME, mode: "insensitive" } },
    select: { id: true },
  });
  if (!parada) {
    console.error(`Parada "${PARADA_NAME}" não encontrada.`);
    process.exit(1);
  }

  const chartIds = (
    await prisma.chart.findMany({
      where: { paradaId: parada.id },
      select: { id: true },
    })
  ).map((c) => c.id);

  const songs = await prisma.song.findMany({
    where: {
      spotifyId: null,
      entries: { some: { chartId: { in: chartIds } } },
    },
    select: { id: true, title: true, artist: true },
    orderBy: { title: "asc" },
  });

  console.log(`${songs.length} músicas sem Spotify\n`);
  let fixed = 0;
  let skipped = 0;

  for (const song of songs) {
    process.stdout.write(`  ${song.artist} — "${song.title}" ... `);
    const hit = await searchSpotifyTrack(song.artist, song.title);
    if (!hit) {
      console.log("não encontrada");
      skipped++;
      continue;
    }
    await upsertSpotifyEntities(hit);
    await prisma.song.update({
      where: { id: song.id },
      data: {
        spotifyId: hit.spotifyId,
        album: hit.albumTitle ?? undefined,
        artistSpotifyId: hit.primaryArtistId ?? undefined,
        albumSpotifyId: hit.albumSpotifyId ?? undefined,
        durationMs: hit.durationMs ?? undefined,
        previewUrl: hit.previewUrl ?? undefined,
        spotifyUrl: hit.spotifyUrl ?? undefined,
        trackNumber: hit.trackNumber ?? undefined,
      },
    });
    await prisma.chartEntry.updateMany({
      where: { songId: song.id, songSpotifyId: null },
      data: {
        songSpotifyId: hit.spotifyId,
        ...(hit.albumSpotifyId ? { albumSpotifyId: hit.albumSpotifyId } : {}),
      },
    });
    fixed++;
    console.log(hit.spotifyId);
  }

  console.log(`\nCorrigidas: ${fixed} | Não encontradas: ${skipped}`);
}

async function main() {
  if (PATCH_SONGS) {
    await patchMissingSongs();
    return;
  }
  await seedCharts();
}

main()
  .catch((err) => {
    console.error("\nErro fatal:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

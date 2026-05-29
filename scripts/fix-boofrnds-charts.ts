/**
 * Corrige linhas mal formatadas nos .txt do @boofrnds e insere entradas
 * faltantes no banco (charts já publicados).
 *
 * Usage:
 *   npx tsx scripts/fix-boofrnds-charts.ts              # txt + db
 *   npx tsx scripts/fix-boofrnds-charts.ts --txt-only
 *   npx tsx scripts/fix-boofrnds-charts.ts --db-only
 *   npx tsx scripts/fix-boofrnds-charts.ts --dry-run
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync, existsSync } from "fs";
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

const prisma = new PrismaClient();
const HANDLE = "boofrnds";
const TXT_DIR = join(process.cwd(), "public", "boofrnds");
const FIXES_PATH = join(process.cwd(), "scripts", "boofrnds-chart-fixes.json");

const DRY_RUN = process.argv.includes("--dry-run");
const TXT_ONLY = process.argv.includes("--txt-only");
const DB_ONLY = process.argv.includes("--db-only");

type ChartFix = {
  file: string;
  weekStart: string;
  position: number;
  artist: string;
  title: string;
  stats: string;
  spotifyTrackId?: string;
};

function parseDDMMYYYY(s: string): Date {
  const [dd, mm, yyyy] = s.trim().split("/").map(Number);
  return new Date(yyyy, mm - 1, dd);
}

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

function formatChartLine(fix: ChartFix): string {
  return `#${String(fix.position).padStart(2, "0")}) ${fix.artist}, "${fix.title}" [${fix.stats}]`;
}

function parseMovement(movement: string, pos: number) {
  if (movement.toUpperCase() === "DEBUT") return { delta: null, prevPos: null, status: "new" };
  if (movement === "=") return { delta: 0, prevPos: pos, status: "same" };
  const n = parseInt(movement, 10);
  if (!Number.isNaN(n)) return { delta: n, prevPos: pos + n, status: n > 0 ? "up" : "down" };
  return { delta: null, prevPos: null, status: "new" };
}

function parseStats(stats: string, position: number) {
  const weeksM = stats.match(/(\d+)\w+\s+week/i);
  const peakM = stats.match(/Peak:\s*(\d+)/i);
  const parts = stats.split("/");
  const movement = parts[1]?.trim() ?? "DEBUT";
  const { delta, prevPos, status } = parseMovement(movement, position);
  return {
    weeks: weeksM ? parseInt(weeksM[1], 10) : 1,
    peak: peakM ? parseInt(peakM[1], 10) : position,
    delta,
    prevPos,
    status,
  };
}

const PALETTES: [string, string][] = [
  ["#FF6B6B", "#FFE66D"], ["#4ECDC4", "#556270"], ["#C7F464", "#4ECDC4"],
  ["#FF8C94", "#FFAAA5"], ["#A8E6CF", "#3D5A80"], ["#E07856", "#F2D8A7"],
];

function paletteFor(artist: string, title: string) {
  const key = artist + title;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % PALETTES.length;
  return { a: PALETTES[idx][0], b: PALETTES[idx][1], seed: Math.abs(h) };
}

function findWeekBlockLines(lines: string[], weekStart: string): { start: number; end: number } | null {
  const headerRe = new RegExp(`^\\[\\s*${weekStart.replace(/\//g, "\\/")}\\s*-`);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headerRe.test(lines[i].trim())) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith("[") && /\d{2}\/\d{2}\/\d{4}/.test(t)) {
      end = i;
      break;
    }
  }
  return { start, end };
}

function applyTxtFix(filePath: string, fix: ChartFix): boolean {
  const content = readFileSync(filePath, "utf-8");
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(/\r?\n/);

  const block = findWeekBlockLines(lines, fix.weekStart);
  if (!block) {
    console.warn(`  [txt] semana não encontrada: ${fix.weekStart} em ${fix.file}`);
    return false;
  }

  const newLine = formatChartLine(fix);
  const posRe = new RegExp(`^#${String(fix.position).padStart(2, "0")}\\)`);

  let replaced = false;
  for (let i = block.start + 1; i < block.end; i++) {
    if (posRe.test(lines[i].trim())) {
      lines[i] = newLine;
      replaced = true;
      break;
    }
  }

  if (!replaced) {
    let insertAt = block.end;
    for (let i = block.start + 1; i < block.end; i++) {
      const m = lines[i].trim().match(/^#(\d+)\)/);
      if (m && parseInt(m[1], 10) > fix.position) {
        insertAt = i;
        break;
      }
    }
    lines.splice(insertAt, 0, newLine);
  }

  if (!DRY_RUN) {
    writeFileSync(filePath, lines.join(eol), "utf-8");
  }
  return true;
}

// ── Spotify (fetch by track ID) ─────────────────────────────────────────────

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

const spotifyState = { token: null as string | null, expiresAt: 0 };

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
  const data = (await res.json()) as { access_token: string; expires_in: number };
  spotifyState.token = data.access_token;
  spotifyState.expiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return spotifyState.token;
}

function mapTrackToHit(track: Record<string, unknown>): SpotifyHit {
  const artists = (track.artists as { id: string; name: string }[]) ?? [];
  const album = track.album as Record<string, unknown> | undefined;
  const images = (album?.images as { url: string }[]) ?? [];
  const release = album?.release_date as string | undefined;
  let albumReleaseDate: Date | null = null;
  if (release) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(release)) albumReleaseDate = new Date(`${release}T00:00:00Z`);
    else if (/^\d{4}-\d{2}$/.test(release)) albumReleaseDate = new Date(`${release}-01T00:00:00Z`);
    else if (/^\d{4}$/.test(release)) albumReleaseDate = new Date(`${release}-01-01T00:00:00Z`);
  }

  const albumTypeRaw = (album?.album_type as string | undefined)?.toUpperCase();
  const albumType =
    albumTypeRaw === "SINGLE" || albumTypeRaw === "EP" || albumTypeRaw === "ALBUM" || albumTypeRaw === "COMPILATION"
      ? albumTypeRaw
      : null;

  return {
    spotifyId: track.id as string,
    title: track.name as string,
    primaryArtistId: artists[0]?.id ?? null,
    primaryArtistName: artists[0]?.name ?? null,
    albumSpotifyId: (album?.id as string) ?? null,
    albumTitle: (album?.name as string) ?? null,
    albumType,
    albumCoverUrl: images[0]?.url ?? null,
    albumReleaseDate,
    albumTotalTracks: (album?.total_tracks as number) ?? null,
    albumSpotifyUrl: ((album?.external_urls as { spotify?: string })?.spotify) ?? null,
    durationMs: (track.duration_ms as number) ?? null,
    trackNumber: (track.track_number as number) ?? null,
    previewUrl: (track.preview_url as string) ?? null,
    spotifyUrl: ((track.external_urls as { spotify?: string })?.spotify) ?? null,
    featuredArtists: artists.slice(1).map((a) => ({ spotifyId: a.id, name: a.name })),
  };
}

async function fetchTrackById(trackId: string): Promise<SpotifyHit | null> {
  await sleep(150);
  const token = await getSpotifyToken();
  if (!token) return null;
  const res = await fetch(`https://api.spotify.com/v1/tracks/${encodeURIComponent(trackId)}?market=BR`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json?.id) return null;
  return mapTrackToHit(json);
}

async function upsertSongFromHit(hit: SpotifyHit, fallbackArtist: string, fallbackTitle: string) {
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

  const canonicalArtist = hit.primaryArtistName ?? fallbackArtist;
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

  if (existingByName) {
    return prisma.song.update({
      where: { id: existingByName.id },
      data: {
        ...(existingByName.spotifyId == null ? { spotifyId: hit.spotifyId } : {}),
        ...spotifyData,
      },
      select: { id: true, spotifyId: true, albumSpotifyId: true },
    });
  }

  return prisma.song.upsert({
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
}

async function applyDbFix(
  fix: ChartFix,
  userId: string,
  paradaId: string,
): Promise<"inserted" | "updated" | "skipped" | "no_chart"> {
  const startDate = parseDDMMYYYY(fix.weekStart);
  const weekIndex = buildWeekIndex(startDate);

  const chart = await prisma.chart.findUnique({
    where: { paradaId_weekIndex: { paradaId, weekIndex } },
    include: { entries: { select: { id: true, position: true, songId: true } } },
  });

  if (!chart) return "no_chart";

  const existingAtPos = chart.entries.find((e) => e.position === fix.position);
  const parsed = parseStats(fix.stats, fix.position);
  const pal = paletteFor(fix.artist, fix.title);

  let hit: SpotifyHit | null = null;
  if (fix.spotifyTrackId) {
    hit = await fetchTrackById(fix.spotifyTrackId);
  }

  let song: { id: string; spotifyId: string | null; albumSpotifyId: string | null };

  if (hit) {
    song = await upsertSongFromHit(hit, fix.artist, fix.title);
  } else {
    const found = await prisma.song.findFirst({
      where: { title: fix.title, artist: fix.artist },
      select: { id: true, spotifyId: true, albumSpotifyId: true },
    });
    song =
      found ??
      (await prisma.song.create({
        data: { title: fix.title, artist: fix.artist },
        select: { id: true, spotifyId: true, albumSpotifyId: true },
      }));
  }

  const entryPayload = {
    songId: song.id,
    songSpotifyId: song.spotifyId ?? null,
    albumSpotifyId: song.albumSpotifyId ?? null,
    points: 101 - fix.position,
    position: fix.position,
    status: parsed.status,
    delta: parsed.delta,
    prevPos: parsed.prevPos,
    peak: parsed.peak,
    weeks: parsed.weeks,
    coverPaletteA: pal.a,
    coverPaletteB: pal.b,
    coverSeed: pal.seed,
  };

  if (DRY_RUN) return existingAtPos ? "updated" : "inserted";

  if (existingAtPos) {
    await prisma.chartEntry.update({
      where: { id: existingAtPos.id },
      data: entryPayload,
    });
    return "updated";
  }

  await prisma.chartEntry.create({
    data: { chartId: chart.id, ...entryPayload },
  });
  return "inserted";
}

async function main() {
  const fixes = JSON.parse(readFileSync(FIXES_PATH, "utf-8")) as ChartFix[];
  console.log(`\n=== Correção @${HANDLE} (${fixes.length} entradas) ===`);
  if (DRY_RUN) console.log("(dry-run — nenhuma alteração será salva)\n");

  let txtOk = 0;
  if (!DB_ONLY) {
    console.log("Arquivos .txt:");
    for (const fix of fixes) {
      const path = join(TXT_DIR, fix.file);
      const ok = applyTxtFix(path, fix);
      if (ok) {
        txtOk++;
        console.log(`  ✓ ${fix.file}  ${fix.weekStart}  #${String(fix.position).padStart(2, "0")}  ${fix.artist}, "${fix.title}"`);
      }
    }
    console.log(`  ${txtOk}/${fixes.length} linhas corrigidas\n`);
  }

  if (!TXT_ONLY) {
    const user = await prisma.user.findUnique({
      where: { handle: HANDLE },
      select: { id: true },
    });
    if (!user) {
      console.error(`Usuário @${HANDLE} não encontrado.`);
      process.exit(1);
    }

    const parada = await prisma.parada.findFirst({
      where: { userId: user.id, isPrimary: true },
      select: { id: true },
    });
    if (!parada) {
      console.error("Parada principal não encontrada.");
      process.exit(1);
    }

    console.log("Banco de dados:");
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let noChart = 0;

    for (const fix of fixes) {
      const label = `${fix.weekStart} #${String(fix.position).padStart(2, "0")} ${fix.artist}, "${fix.title}"`;
      try {
        const result = await applyDbFix(fix, user.id, parada.id);
        if (result === "inserted") {
          inserted++;
          console.log(`  + inserido: ${label}`);
        } else if (result === "updated") {
          updated++;
          console.log(`  ~ atualizado: ${label}`);
        } else if (result === "no_chart") {
          noChart++;
          console.log(`  ? parada não existe no DB: ${label}`);
        } else {
          skipped++;
        }
      } catch (err) {
        console.log(`  ✗ erro: ${label} — ${(err as Error).message}`);
      }
    }

    console.log(`\n  Inseridos: ${inserted}  Atualizados: ${updated}  Sem chart no DB: ${noChart}\n`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

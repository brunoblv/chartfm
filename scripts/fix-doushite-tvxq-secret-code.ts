/**
 * Faixa não disponível como faixa própria no Spotify: cria a `Song` manualmente
 * (título / artista / álbum segundo BANG20) e junta duplicatas nas paradas.
 *
 * Planilha 2008 (romulolima22): TVXQ!, "Doushite kimi wo suki ni natte shimattandarou?",
 * álbum The Secret Code.
 *
 * Uso:
 *   npx tsx scripts/fix-doushite-tvxq-secret-code.ts --dry-run
 *   npx tsx scripts/fix-doushite-tvxq-secret-code.ts --apply
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

const HANDLE = "romulolima22";
const SHEET_TITLE = "Doushite kimi wo suki ni natte shimattandarou?";
const SHEET_ARTIST = "TVXQ!";
const SHEET_ALBUM = "The Secret Code";

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

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isDoushiteSong(title: string): boolean {
  const n = norm(title);
  return n.includes("doushite") && n.includes("kimi") && n.includes("suki") && n.includes("shimattandarou");
}

function isTvxqArtist(artist: string): boolean {
  const a = artist.toLowerCase();
  return (
    a.includes("tvxq") ||
    a.includes("tohoshinki") ||
    a.includes("dong bang") ||
    artist.includes("東方神起")
  );
}

async function ensureCanonicalSong(create: boolean): Promise<{ id: string } | null> {
  const existing = await prisma.song.findUnique({
    where: { title_artist: { title: SHEET_TITLE, artist: SHEET_ARTIST } },
    select: { id: true },
  });
  if (existing) return existing;
  if (!create) return null;
  return prisma.song.create({
    data: {
      title: SHEET_TITLE,
      artist: SHEET_ARTIST,
      album: SHEET_ALBUM,
    },
    select: { id: true },
  });
}

async function clearSongFeatForSpotifyId(spotifyId: string | null) {
  const sid = spotifyId?.trim();
  if (!sid) return;
  await prisma.songFeat.deleteMany({ where: { songSpotifyId: sid } });
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");
  if ((!dryRun && !apply) || (dryRun && apply)) {
    console.error("Use exatamente um de: --dry-run | --apply");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { handle: HANDLE }, select: { id: true } });
  if (!user) {
    console.error(`User não encontrado: ${HANDLE}`);
    process.exit(1);
  }

  const dupCandidates = await prisma.song.findMany({
    where: {
      AND: [
        {
          OR: [
            { title: { contains: "Doushite", mode: Prisma.QueryMode.insensitive } },
            { title: { contains: "shimattandarou", mode: Prisma.QueryMode.insensitive } },
            { title: { contains: "どうして", mode: Prisma.QueryMode.insensitive } },
          ],
        },
        {
          OR: [
            { artist: { contains: "TVXQ", mode: Prisma.QueryMode.insensitive } },
            { artist: { contains: "Tohoshinki", mode: Prisma.QueryMode.insensitive } },
            { artist: { contains: "東方", mode: Prisma.QueryMode.insensitive } },
          ],
        },
      ],
    },
    select: { id: true, title: true, artist: true, spotifyId: true },
  });

  const wrongs = dupCandidates.filter((s) => isDoushiteSong(s.title) && isTvxqArtist(s.artist));

  const canonicalMaybe = await prisma.song.findUnique({
    where: { title_artist: { title: SHEET_TITLE, artist: SHEET_ARTIST } },
    select: { id: true },
  });

  const canonical = await ensureCanonicalSong(!dryRun);
  const dupOthers = canonical ? wrongs.filter((s) => s.id !== canonical.id) : wrongs;

  const chartsUsingDupes = await prisma.chartEntry.findMany({
    where: {
      songId: { in: dupOthers.map((s) => s.id) },
      chart: { userId: user.id },
    },
    select: {
      songId: true,
      position: true,
      chart: { select: { weekIndex: true, weekLabel: true, dateRange: true } },
    },
    orderBy: { chart: { weekIndex: "asc" } },
  });

  const chartsCanonicalUser = canonicalMaybe
    ? await prisma.chartEntry.findMany({
        where: { songId: canonicalMaybe.id, chart: { userId: user.id } },
        select: {
          position: true,
          chart: { select: { weekIndex: true, weekLabel: true, dateRange: true } },
        },
        orderBy: { chart: { weekIndex: "asc" } },
      })
    : [];

  console.log(
    JSON.stringify(
      {
        manualSong: {
          title: SHEET_TITLE,
          artist: SHEET_ARTIST,
          album: SHEET_ALBUM,
          spotify: null,
        },
        canonicalSongId: canonical?.id ?? null,
        wouldCreateCanonical: !canonicalMaybe,
        duplicateSongIds: dupOthers.map((s) => ({ id: s.id, title: s.title, spotifyId: s.spotifyId })),
        chartEntriesRomuloOnDupes: chartsUsingDupes.length,
        chartEntriesRomuloOnCanonicalPre: chartsCanonicalUser.length,
        weeksDupesSample: chartsUsingDupes.slice(0, 25).map((e) => ({
          weekIndex: e.chart.weekIndex,
          dateRange: e.chart.dateRange,
          position: e.position,
          songId: e.songId,
        })),
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    console.log(
      JSON.stringify({
        dryRun: true,
        wouldMergeDupes: dupOthers.length,
        wouldStripSpotifyFromCanonical: true,
      }),
    );
    return;
  }

  if (!canonical) {
    console.error("Estado inconsistente: apply sem canonical");
    process.exit(1);
  }

  const beforeCanon = await prisma.song.findUnique({
    where: { id: canonical.id },
    select: { spotifyId: true },
  });
  const oldCanonSpotify = beforeCanon?.spotifyId?.trim() || null;

  let entriesMoved = 0;
  let songsDeleted = 0;

  for (const dup of dupOthers) {
    const dupSid = dup.spotifyId?.trim() || null;
    await prisma.$transaction(async (tx) => {
      if (dupSid) await tx.songFeat.deleteMany({ where: { songSpotifyId: dupSid } });
      const up = await tx.chartEntry.updateMany({
        where: { songId: dup.id },
        data: {
          songId: canonical.id,
          songSpotifyId: null,
          albumSpotifyId: null,
        },
      });
      entriesMoved += up.count;
      const left = await tx.chartEntry.count({ where: { songId: dup.id } });
      if (left === 0) {
        await tx.song.delete({ where: { id: dup.id } });
        songsDeleted += 1;
      }
    });
  }

  if (oldCanonSpotify) await clearSongFeatForSpotifyId(oldCanonSpotify);

  /** Só limpamos metadados de *faixa* no Spotify; `artist_spotify_id` / `album_spotify_id`
   * ficam intocados para poderes ligar depois com `link-doushite-tvxq-artist-spotify.ts`. */
  await prisma.song.update({
    where: { id: canonical.id },
    data: {
      title: SHEET_TITLE,
      artist: SHEET_ARTIST,
      album: SHEET_ALBUM,
      spotifyId: null,
      spotifyUrl: null,
      previewUrl: null,
      durationMs: null,
      trackNumber: null,
    },
  });

  await prisma.chartEntry.updateMany({
    where: { songId: canonical.id },
    data: {
      songSpotifyId: null,
      albumSpotifyId: null,
    },
  });

  const chartsAfter = await prisma.chartEntry.findMany({
    where: { songId: canonical.id, chart: { userId: user.id } },
    select: {
      position: true,
      points: true,
      chart: { select: { weekIndex: true, weekLabel: true, dateRange: true } },
    },
    orderBy: { chart: { weekIndex: "asc" } },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        entriesMoved,
        dupSongsDeleted: songsDeleted,
        canonicalSongId: canonical.id,
        weeksOnChartRomulo: chartsAfter.length,
        weeks: chartsAfter.map((e) => ({
          weekIndex: e.chart.weekIndex,
          weekLabel: e.chart.weekLabel,
          dateRange: e.chart.dateRange,
          pos: e.position,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

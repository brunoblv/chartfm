/**
 * Cria/atualiza "Monster" — BAYLI ft. Banoffee (Spotify 3UxwLJNWomEPtuE5ArwuBK)
 * e grava ChartEntry na posição 85 do chart do @brunoxbubux (semana 24/04/2026).
 * Crownnote: 90 85 … → prevPos 90, delta +5, status up.
 *
 * Uso: npx tsx scripts/fix-add-monster-bayli-pos85.ts [--dry-run]
 */

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { buildWeekIndexFromDate } from "../lib/chart-week";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { getSpotifyTrackMetadataById, spotifyConfigured } from "../lib/spotify-server";

const USER_HANDLE = "brunoxbubux";
const WEEK_REF = new Date(2026, 3, 24);
const TRACK_ID = "3UxwLJNWomEPtuE5ArwuBK";
const POSITION = 85;
const PREV_CROWNNOTE = 90;

const PALETTES: [string, string][] = [
  ["#FF6B6B", "#FFE66D"],
  ["#4ECDC4", "#556270"],
  ["#C7F464", "#4ECDC4"],
  ["#FF8C94", "#FFAAA5"],
  ["#A8E6CF", "#3D5A80"],
  ["#E07856", "#F2D8A7"],
  ["#2E294E", "#EA698B"],
  ["#1B2021", "#FFD166"],
  ["#EF476F", "#06D6A0"],
  ["#073B4C", "#FFD166"],
  ["#8338EC", "#FB5607"],
];

function paletteFor(artist: string, title: string) {
  const key = artist + title;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return { palette: PALETTES[Math.abs(hash) % PALETTES.length], seed: Math.abs(hash) };
}

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

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  const meta = await getSpotifyTrackMetadataById(TRACK_ID, "BR");
  if (!meta?.title?.toLowerCase().includes("monster") || !meta.primaryArtist) {
    console.error("Meta inesperada:", meta?.title, meta?.primaryArtist?.name);
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: { handle: { equals: USER_HANDLE, mode: "insensitive" } },
    select: { id: true },
  });
  if (!user) {
    console.error("Usuário não encontrado:", USER_HANDLE);
    process.exit(1);
  }

  const weekIndex = buildWeekIndexFromDate(WEEK_REF);
  const chart = await prisma.chart.findUnique({
    where: { userId_weekIndex: { userId: user.id, weekIndex } },
    select: { id: true },
  });
  if (!chart) {
    console.error("Chart não encontrado weekIndex", weekIndex);
    process.exit(1);
  }

  const existingEntry = await prisma.chartEntry.findUnique({
    where: { chartId_position: { chartId: chart.id, position: POSITION } },
    select: { id: true },
  });
  if (existingEntry && !dryRun) {
    console.error("Já existe entrada na posição", POSITION, existingEntry.id);
    process.exit(1);
  }

  let song = await prisma.song.findFirst({
    where: { spotifyId: TRACK_ID },
    select: { id: true, spotifyId: true, albumSpotifyId: true, title: true, artist: true },
  });

  if (dryRun) {
    console.log(
      JSON.stringify({
        dryRun: true,
        meta: { title: meta.title, artist: meta.primaryArtist.name },
        song_existe: Boolean(song),
        chartId: chart.id,
        position: POSITION,
      }),
    );
    return;
  }

  if (!song) {
    const created = await prisma.song.create({
      data: {
        title: "Monster",
        artist: "BAYLI ft. Banoffee",
        album: null,
      },
      select: { id: true },
    });
    const res = await applySpotifyMetadataToSong(created.id, meta, false);
    if (!res.ok) {
      if (res.reason.startsWith("spotify_id_conflict:")) {
        const otherId = res.reason.split(":")[1];
        await prisma.song.delete({ where: { id: created.id } }).catch(() => {});
        song = await prisma.song.findUnique({
          where: { id: otherId },
          select: { id: true, spotifyId: true, albumSpotifyId: true, title: true, artist: true },
        });
        if (song) await applySpotifyMetadataToSong(song.id, meta, false);
      } else {
        console.error(res);
        await prisma.song.delete({ where: { id: created.id } }).catch(() => {});
        process.exit(1);
      }
    } else {
      song = await prisma.song.findUnique({
        where: { id: created.id },
        select: { id: true, spotifyId: true, albumSpotifyId: true, title: true, artist: true },
      });
    }
  } else {
    await applySpotifyMetadataToSong(song.id, meta, false);
    await prisma.song.update({
      where: { id: song.id },
      data: { title: meta.title, artist: meta.primaryArtist.name, album: meta.album.title ?? undefined },
    });
  }

  song = await prisma.song.findFirst({
    where: { spotifyId: TRACK_ID },
    select: { id: true, spotifyId: true, albumSpotifyId: true, title: true, artist: true },
  });

  if (!song?.spotifyId) {
    console.error("Song sem spotify após apply");
    process.exit(1);
  }

  const { palette, seed } = paletteFor(meta.primaryArtist.name, meta.title);
  const points = 101 - POSITION;
  const delta = PREV_CROWNNOTE - POSITION;

  await prisma.chartEntry.create({
    data: {
      chartId: chart.id,
      songId: song.id,
      position: POSITION,
      points,
      songSpotifyId: song.spotifyId,
      albumSpotifyId: song.albumSpotifyId,
      status: "up",
      delta,
      prevPos: PREV_CROWNNOTE,
      peak: Math.min(POSITION, PREV_CROWNNOTE),
      weeks: 1,
      coverPaletteA: palette[0],
      coverPaletteB: palette[1],
      coverSeed: seed,
    },
  });

  const summary = { ok: true, position: POSITION, songId: song.id, trackId: TRACK_ID, artist: meta.primaryArtist.name };
  console.log("ok", POSITION, song.id, TRACK_ID, meta.primaryArtist.name);
  try {
    appendFileSync(path.join(process.cwd(), "monster-pos85-import.log"), `${new Date().toISOString()} ${JSON.stringify(summary)}\n`);
  } catch {
    /* ignore */
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

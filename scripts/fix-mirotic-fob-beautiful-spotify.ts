/**
 * Corrige falhas de vínculo Spotify / duplicatas:
 * - Mirotic (TVXQ!): 4BZhUnXvXYRQJPClr0hhIC estava em "Doushite..."; move para "Mirotic" e unifica entradas.
 * - The Take Over, The Break's Over (Fall Out Boy): unifica título com aspas (já com Spotify).
 * - Beautiful you (TVXQ!): atualiza metadados (já com 3X7u2Lcw6sHKpx5bRfLNzk).
 *
 * Uso: npx tsx scripts/fix-mirotic-fob-beautiful-spotify.ts [--dry-run]
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { getSpotifyTrackMetadataById, spotifyConfigured } from "../lib/spotify-server";

const TRACK_MIROTIC = "4BZhUnXvXYRQJPClr0hhIC";
const TRACK_FOB = "3rG8ZkmKHb4Ms6CsSzEITv";
const TRACK_BEAUTIFUL = "3X7u2Lcw6sHKpx5bRfLNzk";

const WRONG_MIROTIC_HOLDER = "1c585ea4445444a2a7e4ed5fd9871e9d";
const MIROTIC_CANON = "1d667f229fc7469390f4665b8ab50f66";

const FOB_APOSTROPHE = "6b8cf1ef63b04d5bb45cb3f42a18b4fd";
const FOB_SPOTIFY_ROW = "cmohyjo5q0009sarjrakm6xp3";

const BEAUTIFUL = "c6065e629f3c494dabf026c7a11ccf78";

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

async function mergeChartEntries(fromSongId: string, toSongId: string, songSpotifyId: string, albumSpotifyId: string | null, dryRun: boolean) {
  if (dryRun) {
    const n = await prisma.chartEntry.count({ where: { songId: fromSongId } });
    console.log("DRY merge_entries", fromSongId, "->", toSongId, "n=", n);
    return;
  }
  await prisma.chartEntry.updateMany({
    where: { songId: fromSongId },
    data: { songId: toSongId, songSpotifyId, albumSpotifyId },
  });
  const left = await prisma.chartEntry.count({ where: { songId: fromSongId } });
  if (left === 0) {
    await prisma.song.delete({ where: { id: fromSongId } });
    console.log("deleted_song", fromSongId);
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  const metaM = await getSpotifyTrackMetadataById(TRACK_MIROTIC, "BR");
  const metaF = await getSpotifyTrackMetadataById(TRACK_FOB, "BR");
  const metaB = await getSpotifyTrackMetadataById(TRACK_BEAUTIFUL, "BR");
  if (!metaM?.title?.toLowerCase().includes("mirotic")) {
    console.error("Spotify Mirotic inesperado:", metaM?.title);
    process.exit(1);
  }
  if (!metaF) {
    console.error("Meta FOB ausente");
    process.exit(1);
  }
  if (!metaB?.title?.toLowerCase().includes("beautiful")) {
    console.error("Spotify Beautiful inesperado:", metaB?.title);
    process.exit(1);
  }

  // --- Mirotic: liberar spotify_id da faixa errada ---
  if (!dryRun) {
    await prisma.songFeat.deleteMany({ where: { songSpotifyId: TRACK_MIROTIC } });
    await prisma.song.update({
      where: { id: WRONG_MIROTIC_HOLDER },
      data: {
        spotifyId: null,
        artistSpotifyId: null,
        albumSpotifyId: null,
        spotifyUrl: null,
        previewUrl: null,
        durationMs: null,
        trackNumber: null,
      },
    });
    console.log("cleared_wrong_holder", WRONG_MIROTIC_HOLDER);
  } else {
    console.log("DRY would clear spotify + song_feats for", TRACK_MIROTIC, "on wrong row");
  }

  let r = await applySpotifyMetadataToSong(MIROTIC_CANON, metaM, dryRun);
  if (!r.ok) {
    console.error("Mirotic apply:", r);
    process.exit(1);
  }
  console.log("mirotic_apply", r);

  if (!dryRun) {
    await prisma.song.update({
      where: { id: MIROTIC_CANON },
      data: {
        title: metaM.title,
        artist: metaM.primaryArtist?.name ?? "TVXQ!",
        album: metaM.album.title ?? undefined,
      },
    });
  }

  await mergeChartEntries(
    WRONG_MIROTIC_HOLDER,
    MIROTIC_CANON,
    metaM.spotifyId,
    metaM.album.spotifyId ?? null,
    dryRun,
  );

  // --- Fall Out Boy ---
  r = await applySpotifyMetadataToSong(FOB_SPOTIFY_ROW, metaF, dryRun);
  if (!r.ok) {
    console.error("FOB apply:", r);
    process.exit(1);
  }
  console.log("fob_apply", r);

  if (!dryRun) {
    await prisma.song.update({
      where: { id: FOB_SPOTIFY_ROW },
      data: {
        title: metaF.title,
        artist: metaF.primaryArtist?.name ?? "Fall Out Boy",
        album: metaF.album.title ?? undefined,
      },
    });
  }

  await mergeChartEntries(FOB_APOSTROPHE, FOB_SPOTIFY_ROW, metaF.spotifyId, metaF.album.spotifyId ?? null, dryRun);

  // --- Beautiful you ---
  r = await applySpotifyMetadataToSong(BEAUTIFUL, metaB, dryRun);
  if (!r.ok) {
    console.error("Beautiful apply:", r);
    process.exit(1);
  }
  console.log("beautiful_apply", r);

  if (!dryRun) {
    await prisma.song.update({
      where: { id: BEAUTIFUL },
      data: {
        title: metaB.title,
        artist: metaB.primaryArtist?.name ?? "TVXQ!",
        album: metaB.album.title ?? undefined,
      },
    });
  }

  console.log(dryRun ? "dry_ok" : "ok");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * Unifica duplicatas "Breaking the Habit" / "Breaking The Habit" — Linkin Park
 * e atualiza metadados Spotify (6n8TMVyFKoUmDc4apxceRD, Meteora).
 * Uso: npx tsx scripts/fix-breaking-the-habit-linkin-park-spotify.ts [--dry-run]
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { getSpotifyTrackMetadataById, spotifyConfigured } from "../lib/spotify-server";

const TRACK_ID = "6n8TMVyFKoUmDc4apxceRD";
const CANON = "cmom0sbd6004s9x83sjxhjhb6";
const DUP = "e89465cc8e1142af909cf9fd15670567";

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
  if (!meta?.title?.toLowerCase().includes("breaking")) {
    console.error("Meta inesperada:", meta?.title);
    process.exit(1);
  }

  if (dryRun) {
    const n = await prisma.chartEntry.count({ where: { songId: DUP } });
    console.log("DRY merge dup entries", n);
  } else {
    await prisma.chartEntry.updateMany({
      where: { songId: DUP },
      data: {
        songId: CANON,
        songSpotifyId: meta.spotifyId,
        albumSpotifyId: meta.album.spotifyId ?? null,
      },
    });
    if ((await prisma.chartEntry.count({ where: { songId: DUP } })) === 0) {
      await prisma.song.delete({ where: { id: DUP } });
      console.log("deleted_dup", DUP);
    }
  }

  const applied = await applySpotifyMetadataToSong(CANON, meta, dryRun);
  if (!applied.ok) {
    console.error(applied);
    process.exit(1);
  }

  if (!dryRun && meta.primaryArtist) {
    await prisma.song.update({
      where: { id: CANON },
      data: {
        title: meta.title,
        artist: meta.primaryArtist.name,
        album: meta.album.title ?? undefined,
      },
    });
  }

  console.log(dryRun ? "dry_ok" : "ok", CANON, TRACK_ID);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

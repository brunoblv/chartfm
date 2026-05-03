/**
 * Alinha "I was wrong" — 2AM ao track correto no Spotify (잘못했어).
 * https://open.spotify.com/track/4b50XbHkjhF73j6vJapRJF
 *
 * Uso: npx tsx scripts/fix-2am-i-was-wrong-spotify.ts [--dry-run]
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { getSpotifyTrackMetadataById, spotifyConfigured } from "../lib/spotify-server";

const TRACK_ID = "4b50XbHkjhF73j6vJapRJF";
const SONG_ID = "b79468b71cdf4c718b3b5cd2ea06feaf";

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

  const song = await prisma.song.findUnique({
    where: { id: SONG_ID },
    select: { id: true, title: true, artist: true, spotifyId: true },
  });
  if (!song) {
    console.error("Song não encontrada:", SONG_ID);
    process.exit(1);
  }

  const meta = await getSpotifyTrackMetadataById(TRACK_ID, "BR");
  if (!meta) {
    console.error("Sem metadados Spotify para", TRACK_ID);
    process.exit(1);
  }

  const artistOk = meta.primaryArtist?.name?.toLowerCase().includes("2am") ?? false;
  if (!artistOk) {
    console.error("Artista inesperado:", meta.primaryArtist?.name);
    process.exit(1);
  }

  console.log(JSON.stringify({ dryRun, before: song, meta: { id: meta.spotifyId, title: meta.title, artist: meta.primaryArtist?.name } }));

  const applied = await applySpotifyMetadataToSong(SONG_ID, meta, dryRun);
  if (!applied.ok) {
    console.error(applied);
    process.exit(1);
  }

  console.log(dryRun ? "dry_ok" : "ok", TRACK_ID);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

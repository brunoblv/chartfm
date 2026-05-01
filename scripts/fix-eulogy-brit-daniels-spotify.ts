/**
 * Corrige "Eulogy" (artista errado Roly Daniels + Spotify antigo) para
 * Brit Daniels — faixa 230HTnVQbHUg59pyRnGJcj.
 * Uso: npx tsx scripts/fix-eulogy-brit-daniels-spotify.ts [--dry-run]
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { getSpotifyTrackMetadataById, spotifyConfigured } from "../lib/spotify-server";

const SONG_ID = "8ff5dee798654887bae42485d6a6e8e9";
const TRACK_ID = "230HTnVQbHUg59pyRnGJcj";

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

  const owner = await prisma.song.findUnique({
    where: { id: SONG_ID },
    select: { id: true, title: true, artist: true, spotifyId: true },
  });
  if (!owner) {
    console.error("Song não encontrada:", SONG_ID);
    process.exit(1);
  }

  const taken = await prisma.song.findFirst({
    where: { spotifyId: TRACK_ID, NOT: { id: SONG_ID } },
    select: { id: true, title: true, artist: true },
  });
  if (taken) {
    console.error("spotify_id já usado:", taken);
    process.exit(1);
  }

  const meta = await getSpotifyTrackMetadataById(TRACK_ID, "BR");
  if (!meta?.title?.toLowerCase().includes("eulogy")) {
    console.error("Meta inesperada:", meta?.title, meta?.primaryArtist?.name);
    process.exit(1);
  }

  const res = await applySpotifyMetadataToSong(SONG_ID, meta, dryRun);
  if (!res.ok) {
    console.error(res);
    process.exit(1);
  }

  if (!dryRun && meta.primaryArtist) {
    await prisma.song.update({
      where: { id: SONG_ID },
      data: {
        title: meta.title,
        artist: meta.primaryArtist.name,
      },
    });
  }

  console.log(dryRun ? "dry_ok" : "ok", owner.artist, "->", meta.primaryArtist?.name, TRACK_ID);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

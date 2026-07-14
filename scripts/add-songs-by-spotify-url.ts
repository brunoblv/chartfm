/**
 * Adiciona/atualiza músicas no banco a partir de links do Spotify (upsert por spotifyId).
 *
 * Uso:
 *   npx tsx scripts/add-songs-by-spotify-url.ts
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

for (const name of [".env", ".env.local", ".env.production"]) {
  loadEnvFile(join(process.cwd(), name));
}

import { prisma } from "../lib/prisma";
import { getSpotifyTrackMetadataById, isSpotifyTrackId } from "../lib/spotify-server";
import { upsertSongFromSpotifyMetadata } from "../lib/upsert-song-from-spotify-metadata";

const SPOTIFY_URLS = [
  "https://open.spotify.com/intl-pt/track/5ioB3LzMIXG31NYMXV685k?si=61b7d6ffd57b4f0f",
  "https://open.spotify.com/intl-pt/track/7zxikeAavSLQVGocbK2nau?si=6dc7eb68e8224b5d",
];

function extractTrackId(url: string): string | null {
  const m = url.match(/track\/([A-Za-z0-9]{22})/);
  return m ? m[1] : null;
}

async function main() {
  for (const url of SPOTIFY_URLS) {
    const trackId = extractTrackId(url);
    if (!trackId || !isSpotifyTrackId(trackId)) {
      console.error(`[skip] URL inválida: ${url}`);
      continue;
    }

    const metadata = await getSpotifyTrackMetadataById(trackId);
    if (!metadata) {
      console.error(`[skip] Não achei metadados no Spotify para ${trackId} (${url})`);
      continue;
    }

    const result = await upsertSongFromSpotifyMetadata(metadata);
    if (!result.ok) {
      console.error(`[erro] ${metadata.artistDisplay} - ${metadata.title}: ${result.error}`);
      continue;
    }

    console.log(`[ok] ${result.song.artist} - ${result.song.title} (id=${result.song.id}, spotifyId=${result.song.spotifyId})`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

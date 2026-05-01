/**
 * Aplica metadados do Spotify nas músicas:
 *   - Mirotic — TVXQ!
 *   - The Take Over, The Break's Over — Fall Out Boy
 *   - Beautiful You — TVXQ!
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { getSpotifyTrackMetadataById, spotifyConfigured } from "../lib/spotify-server";

function loadEnvFile() {
  const p = path.join(process.cwd(), ".env");
  if (!existsSync(p)) return;
  const txt = readFileSync(p, "utf8");
  for (const line of txt.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile();

const TARGETS = [
  { title: "Mirotic",                          artist: "TVXQ!", trackId: "4BZhUnXvXYRQJPClr0hhIC" },
  { title: "The Take Over, The Break's Over",  artist: "Fall Out Boy", trackId: "3rG8ZkmKHb4Ms6CsSzEITv" },
  { title: "Beautiful You",                    artist: "TVXQ!", trackId: "3X7u2Lcw6sHKpx5bRfLNzk" },
];

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  for (const t of TARGETS) {
    const label = `"${t.title}" — ${t.artist}`;

    const song = await prisma.song.findFirst({
      where: {
        title: { equals: t.title, mode: "insensitive" },
        artist: { equals: t.artist, mode: "insensitive" },
      },
      select: { id: true, title: true, artist: true },
    });

    if (!song) {
      console.log(`SKIP  not_found ${label}`);
      continue;
    }

    await sleep(1500);

    const meta = await getSpotifyTrackMetadataById(t.trackId);
    if (!meta) {
      console.log(`FAIL  no_meta ${label} (${t.trackId})`);
      continue;
    }

    const result = await applySpotifyMetadataToSong(song.id, meta, dryRun);

    if (!result.ok) {
      console.log(`FAIL  ${label} :: ${"reason" in result ? result.reason : ""}`);
    } else {
      console.log(`${dryRun ? "DRY " : "OK  "} ${label} -> cover=${meta.album.coverUrl ? "sim" : "não"} album=${meta.album.spotifyId ?? "?"}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

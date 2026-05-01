/**
 * Preenche metadados faltantes em músicas que já têm spotifyId mas estão incompletas
 * (artistSpotifyId, albumSpotifyId, Album.coverUrl, Artist, ChartEntry refs, etc.).
 *
 * Uso:
 *   npx tsx scripts/backfill-song-metadata.ts
 *   npx tsx scripts/backfill-song-metadata.ts --dry-run
 *   npx tsx scripts/backfill-song-metadata.ts --limit=50
 *   npx tsx scripts/backfill-song-metadata.ts --offset=100
 *   npx tsx scripts/backfill-song-metadata.ts --delay=2000
 *
 * Requer .env com SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET e DATABASE_URL.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { prisma } from "../lib/prisma";
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

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const limitArg = argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Math.max(1, parseInt(limitArg.split("=")[1] ?? "500", 10) || 500) : 500;
  const offsetArg = argv.find((a) => a.startsWith("--offset="));
  const offset = offsetArg ? Math.max(0, parseInt(offsetArg.split("=")[1] ?? "0", 10) || 0) : 0;
  const delayArg = argv.find((a) => a.startsWith("--delay="));
  const delayMs = delayArg ? Math.max(500, parseInt(delayArg.split("=")[1] ?? "2000", 10) || 2000) : 2000;

  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  // Músicas com spotifyId mas com algum campo importante faltando
  const songs = await prisma.song.findMany({
    where: {
      spotifyId: { not: null },
      OR: [
        { artistSpotifyId: null },
        { albumSpotifyId: null },
        { durationMs: null },
      ],
    },
    select: {
      id: true,
      title: true,
      artist: true,
      spotifyId: true,
      artistSpotifyId: true,
      albumSpotifyId: true,
      durationMs: true,
    },
    orderBy: { id: "asc" },
    skip: offset,
    take: limit,
  });

  console.log(
    `músicas incompletas: ${songs.length} | offset=${offset} | delay=${delayMs}ms | dry_run=${dryRun}`,
  );

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const song of songs) {
    const label = `"${song.title}" — ${song.artist}`;

    await sleep(delayMs);

    let meta;
    try {
      meta = await getSpotifyTrackMetadataById(song.spotifyId!);
    } catch {
      console.log(`FAIL  api_error ${label}`);
      failed++;
      continue;
    }

    if (!meta) {
      console.log(`SKIP  no_meta ${label} (${song.spotifyId})`);
      skipped++;
      continue;
    }

    const result = await applySpotifyMetadataToSong(song.id, meta, dryRun);

    if (!result.ok) {
      console.log(`FAIL  ${label} :: ${"reason" in result ? result.reason : ""}`);
      failed++;
    } else if (result.reason === "dry_run") {
      console.log(`DRY   ${label} -> album=${meta.album.spotifyId ?? "?"} artist=${meta.primaryArtist?.spotifyId ?? "?"}`);
      ok++;
    } else {
      console.log(`OK    ${label} -> album=${meta.album.spotifyId ?? "?"} cover=${meta.album.coverUrl ? "sim" : "não"}`);
      ok++;
    }
  }

  console.log(JSON.stringify({ ok, skipped, failed, dryRun }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

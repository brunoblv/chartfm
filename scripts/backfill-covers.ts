/**
 * Preenche Album.coverUrl para faixas ligadas a um álbum Spotify sem capa na BD.
 *
 * Estratégia:
 *   1. Se o álbum já tem coverUrl → ignora.
 *   2. Se a faixa tem spotifyId → busca metadata, faz upsert do Album com a capa do Spotify.
 *
 * Uso:
 *   npx tsx scripts/backfill-covers.ts
 *   npx tsx scripts/backfill-covers.ts --dry-run
 *   npx tsx scripts/backfill-covers.ts --limit=50
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
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

  const songs = await prisma.song.findMany({
    where: {
      spotifyId: { not: null },
      OR: [
        { albumSpotifyId: null },
        {
          AND: [
            { albumSpotifyId: { not: null } },
            {
              OR: [
                { albumRef: null },
                { albumRef: { OR: [{ coverUrl: null }, { coverUrl: "" }] } },
              ],
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      title: true,
      artist: true,
      spotifyId: true,
      albumSpotifyId: true,
      artistSpotifyId: true,
      albumRef: { select: { spotifyId: true, coverUrl: true, title: true } },
    },
    orderBy: { id: "asc" },
    skip: offset,
    take: limit,
  });

  console.log(
    `candidatos (faixa com Spotify e álbum sem capa ou sem album id): ${songs.length} | offset=${offset} | delay=${delayMs}ms | dry_run=${dryRun}`,
  );

  let patchedAlbum = 0;
  let skipped = 0;
  let failed = 0;

  for (const song of songs) {
    const label = `"${song.title}" — ${song.artist}`;

    if (song.albumRef?.coverUrl?.trim()) {
      skipped++;
      continue;
    }

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
      console.log(`SKIP  no_meta ${label}`);
      skipped++;
      continue;
    }

    const aid = meta.album.spotifyId ?? song.albumSpotifyId;
    const primary = meta?.primaryArtist;
    const coverUrl = meta?.album.coverUrl?.trim();
    if (!aid || !primary || !coverUrl) {
      console.log(`SKIP  incomplete_meta ${label}`);
      skipped++;
      continue;
    }

    if (!dryRun) {
      await prisma.album.upsert({
        where: { spotifyId: aid },
        update: {
          title: meta.album.title ?? undefined,
          artistSpotifyId: primary.spotifyId,
          coverUrl,
          albumType: meta.album.albumType ?? undefined,
          releaseDate: meta.album.releaseDate ?? undefined,
          spotifyUrl: meta.album.spotifyUrl ?? undefined,
          totalTracks: meta.album.totalTracks ?? undefined,
        },
        create: {
          spotifyId: aid,
          title: meta.album.title ?? "Álbum",
          artistSpotifyId: primary.spotifyId,
          coverUrl,
          albumType: meta.album.albumType ?? undefined,
          releaseDate: meta.album.releaseDate ?? undefined,
          spotifyUrl: meta.album.spotifyUrl ?? null,
          totalTracks: meta.album.totalTracks ?? null,
        },
      });
    }
    console.log(`OK    ${label}`);
    patchedAlbum++;
  }

  console.log(JSON.stringify({ patchedAlbum, skipped, failed, dryRun }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

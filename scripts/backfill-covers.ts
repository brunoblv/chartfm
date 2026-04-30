/**
 * Preenche Song.coverImageUrl para músicas sem capa visível no app.
 *
 * Estratégia:
 *   1. Se o Album vinculado já tem coverUrl → copia direto, sem chamar a API.
 *   2. Se não tem, mas a música tem spotifyId → busca metadata no Spotify,
 *      salva coverUrl no Album e coverImageUrl na música.
 *   3. Sem spotifyId e sem albumRef.coverUrl → pula (rode backfill-song-spotify.ts primeiro).
 *
 * Uso:
 *   npx tsx scripts/backfill-covers.ts
 *   npx tsx scripts/backfill-covers.ts --dry-run
 *   npx tsx scripts/backfill-covers.ts --limit=50
 *   npx tsx scripts/backfill-covers.ts --offset=100
 *   npx tsx scripts/backfill-covers.ts --delay=3000
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
    where: { coverImageUrl: null },
    select: {
      id: true,
      title: true,
      artist: true,
      spotifyId: true,
      albumSpotifyId: true,
      albumRef: { select: { spotifyId: true, coverUrl: true } },
    },
    orderBy: { id: "asc" },
    skip: offset,
    take: limit,
  });

  console.log(
    `músicas sem capa: ${songs.length} | offset=${offset} | delay=${delayMs}ms | dry_run=${dryRun}`,
  );

  let fromAlbum = 0;
  let fromApi = 0;
  let skipped = 0;
  let failed = 0;

  for (const song of songs) {
    const label = `"${song.title}" — ${song.artist}`;

    // Caso 1: Album vinculado já tem coverUrl → copia direto, sem chamar a API
    if (song.albumRef?.coverUrl?.trim()) {
      const coverUrl = song.albumRef.coverUrl.trim();
      if (!dryRun) {
        await prisma.song.update({
          where: { id: song.id },
          data: { coverImageUrl: coverUrl },
        });
      }
      console.log(`ALBUM ${label}`);
      fromAlbum++;
      continue;
    }

    // Caso 2: tem spotifyId → busca na API do Spotify
    if (song.spotifyId) {
      await sleep(delayMs);
      let meta;
      try {
        meta = await getSpotifyTrackMetadataById(song.spotifyId);
      } catch {
        console.log(`FAIL  api_error ${label}`);
        failed++;
        continue;
      }

      const coverUrl = meta?.album?.coverUrl;
      if (!coverUrl) {
        console.log(`SKIP  no_cover ${label}`);
        skipped++;
        continue;
      }

      if (!dryRun) {
        await prisma.song.update({
          where: { id: song.id },
          data: { coverImageUrl: coverUrl },
        });
        if (song.albumSpotifyId) {
          await prisma.album.updateMany({
            where: { spotifyId: song.albumSpotifyId, coverUrl: null },
            data: { coverUrl },
          });
        }
      }
      console.log(`API   ${label}`);
      fromApi++;
      continue;
    }

    // Caso 3: sem spotifyId e sem albumRef.coverUrl → pula
    console.log(`SKIP  no_spotify ${label}`);
    skipped++;
  }

  console.log(JSON.stringify({ fromAlbum, fromApi, skipped, failed, dryRun }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

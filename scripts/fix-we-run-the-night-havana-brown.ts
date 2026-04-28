/**
 * Corrige "We Run The Night" atribuída incorretamente (ex.: Ferrugem)
 * para a faixa correta da Havana Brown (feat. Pitbull).
 *
 * Faixa correta:
 * https://open.spotify.com/track/0mtPNQl5vePVwiI9Vykp7L
 *
 * Uso:
 *   npx tsx scripts/fix-we-run-the-night-havana-brown.ts --dry-run
 *   npx tsx scripts/fix-we-run-the-night-havana-brown.ts
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { getSpotifyTrackMetadataById, spotifyConfigured } from "../lib/spotify-server";

const TARGET_TRACK_SPOTIFY_ID = "0mtPNQl5vePVwiI9Vykp7L";

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile();

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  const meta = await getSpotifyTrackMetadataById(TARGET_TRACK_SPOTIFY_ID, "US");
  if (!meta?.primaryArtist?.name) {
    console.error("Falha ao obter metadados da faixa correta.");
    process.exit(1);
  }

  if (!normalize(meta.title).includes("we run the night")) {
    console.error(`Faixa alvo não parece ser 'We Run The Night': ${meta.title}`);
    process.exit(1);
  }
  if (!normalize(meta.primaryArtist.name).includes("havana brown")) {
    console.error(`Artista principal não parece ser Havana Brown: ${meta.primaryArtist.name}`);
    process.exit(1);
  }

  const songs = await prisma.song.findMany({
    where: {
      OR: [
        { spotifyId: TARGET_TRACK_SPOTIFY_ID },
        { title: { contains: "we run", mode: "insensitive" } },
      ],
    },
    select: { id: true, title: true, artist: true, spotifyId: true },
    orderBy: { id: "asc" },
  });

  const candidates = songs.filter((s) => normalize(s.title).includes("we run"));
  if (!candidates.length) {
    console.error("Nenhuma música candidata encontrada para 'We Run The Night'.");
    process.exit(1);
  }

  const canonical =
    candidates.find((s) => s.spotifyId === TARGET_TRACK_SPOTIFY_ID) ??
    candidates.find((s) => normalize(s.artist).includes("havana brown")) ??
    candidates.find((s) => normalize(s.artist).includes("ferrugem")) ??
    candidates[0];

  console.log("canonical_before", canonical);
  console.log("candidates_total", candidates.length, "dry_run", dryRun);

  const applied = await applySpotifyMetadataToSong(canonical.id, meta, dryRun);
  if (!applied.ok) {
    console.error("Falha ao aplicar metadados:", applied.reason);
    process.exit(1);
  }

  if (!dryRun) {
    await prisma.song.update({
      where: { id: canonical.id },
      data: {
        title: meta.title,
        artist: meta.primaryArtist.name,
        album: meta.album.title ?? undefined,
      },
    });
  }

  const sourceIds = candidates.map((s) => s.id).filter((id) => id !== canonical.id);
  for (const sourceId of sourceIds) {
    if (dryRun) {
      const count = await prisma.chartEntry.count({ where: { songId: sourceId } });
      console.log("DRY remap", { fromSongId: sourceId, toSongId: canonical.id, entries: count });
      continue;
    }

    const moved = await prisma.chartEntry.updateMany({
      where: { songId: sourceId },
      data: {
        songId: canonical.id,
        songSpotifyId: meta.spotifyId,
        albumSpotifyId: meta.album.spotifyId ?? null,
      },
    });
    console.log("remapped_entries", { fromSongId: sourceId, toSongId: canonical.id, count: moved.count });

    const refs = await prisma.chartEntry.count({ where: { songId: sourceId } });
    if (refs === 0) {
      await prisma.song.delete({ where: { id: sourceId } });
      console.log("deleted_duplicate_song", sourceId);
    }
  }

  console.log(dryRun ? "dry_run_ok" : "updated_ok", {
    songId: canonical.id,
    spotifyId: meta.spotifyId,
    albumSpotifyId: meta.album.spotifyId,
    title: meta.title,
    artist: meta.primaryArtist.name,
    album: meta.album.title,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());


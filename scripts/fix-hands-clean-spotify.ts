/**
 * Garante Spotify em "Hands Clean" — Alanis Morissette (track 2LVxvGhl2U5p2ql2ujc6vZ).
 * Uso: npx tsx scripts/fix-hands-clean-spotify.ts [--dry-run]
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { getSpotifyTrackMetadataById, spotifyConfigured } from "../lib/spotify-server";

const TRACK_ID = "2LVxvGhl2U5p2ql2ujc6vZ";

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

function norm(s: string) {
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

  const meta = await getSpotifyTrackMetadataById(TRACK_ID, "BR");
  if (!meta?.primaryArtist?.name || !norm(meta.title).includes("hands clean")) {
    console.error("Meta inválida", meta?.title);
    process.exit(1);
  }

  const rows = await prisma.song.findMany({
    where: {
      title: { contains: "hands clean", mode: "insensitive" },
      artist: { contains: "alanis", mode: "insensitive" },
    },
    select: { id: true, title: true, artist: true, spotifyId: true },
    orderBy: { id: "asc" },
  });

  const noSpotify = await prisma.song.findMany({
    where: {
      spotifyId: null,
      title: { contains: "hands clean", mode: "insensitive" },
    },
    select: { id: true, title: true, artist: true, spotifyId: true },
  });

  console.log("rows_alanis", JSON.stringify(rows, null, 2));
  console.log("rows_hands_no_spotify", JSON.stringify(noSpotify, null, 2));

  const canonical = rows.find((s) => s.spotifyId === TRACK_ID) ?? rows[0] ?? null;
  if (!canonical) {
    console.error("Nenhuma Song Hands Clean + Alanis.");
    process.exit(1);
  }

  const applied = await applySpotifyMetadataToSong(canonical.id, meta, dryRun);
  if (!applied.ok) {
    console.error(applied.reason);
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

  for (const s of rows) {
    if (s.id === canonical.id) continue;
    if (dryRun) {
      const n = await prisma.chartEntry.count({ where: { songId: s.id } });
      console.log("DRY merge", s.id, n);
      continue;
    }
    await prisma.chartEntry.updateMany({
      where: { songId: s.id },
      data: {
        songId: canonical.id,
        songSpotifyId: meta.spotifyId,
        albumSpotifyId: meta.album.spotifyId ?? null,
      },
    });
    if ((await prisma.chartEntry.count({ where: { songId: s.id } })) === 0) {
      await prisma.song.delete({ where: { id: s.id } });
      console.log("deleted_dup", s.id);
    }
  }

  console.log(dryRun ? "dry_ok" : "ok", canonical.id, meta.spotifyId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

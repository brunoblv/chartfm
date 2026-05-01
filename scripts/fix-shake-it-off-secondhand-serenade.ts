/**
 * Unifica duplicatas e atualiza metadados do Spotify para
 * "Shake It Off" — Secondhand Serenade (track 6MBrbxl7ic218wOUN0Tmq5).
 * Uso: npx tsx scripts/fix-shake-it-off-secondhand-serenade.ts [--dry-run]
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { getSpotifyTrackMetadataById, spotifyConfigured } from "../lib/spotify-server";

const TRACK_ID = "6MBrbxl7ic218wOUN0Tmq5";

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
  if (!meta?.primaryArtist?.name?.toLowerCase().includes("secondhand")) {
    console.error("Meta inválida ou artista inesperado", meta?.title, meta?.primaryArtist?.name);
    process.exit(1);
  }

  const rows = await prisma.song.findMany({
    where: {
      title: { contains: "shake", mode: "insensitive" },
      artist: { contains: "secondhand", mode: "insensitive" },
    },
    select: { id: true, title: true, artist: true, spotifyId: true },
    orderBy: { id: "asc" },
  });

  console.log("rows", JSON.stringify(rows, null, 2));

  const canonical = rows.find((s) => s.spotifyId === TRACK_ID) ?? rows.find((s) => s.spotifyId?.trim()) ?? rows[0] ?? null;
  if (!canonical) {
    console.error("Nenhuma Song encontrada.");
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
        artist: meta.primaryArtist!.name,
        album: meta.album.title ?? undefined,
      },
    });
  }

  for (const s of rows) {
    if (s.id === canonical.id) continue;
    if (dryRun) {
      const n = await prisma.chartEntry.count({ where: { songId: s.id } });
      console.log("DRY merge_from", s.id, n);
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

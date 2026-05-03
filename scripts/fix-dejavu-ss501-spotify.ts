/**
 * Atualiza "Deja Vu" / "Dejavu" (SS501, single Dejavu) com o Spotify oficial
 * https://open.spotify.com/album/2HpU5ApLkQsMwLnpsrSo5c (faixa "Dejavu").
 * Uso: npx tsx scripts/fix-dejavu-ss501-spotify.ts [--dry-run]
 *
 * Paradas: `applySpotifyMetadataToSong` já atualiza `ChartEntry`; para reforçar
 * ou outro ambiente, rode também:
 *   npx tsx scripts/sync-chart-entries-from-song.ts --song-id=<id retornado no log>
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { getSpotifyTrackMetadataById, listSpotifyAlbumTracks, spotifyConfigured } from "../lib/spotify-server";

const ALBUM_ID = "2HpU5ApLkQsMwLnpsrSo5c";

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

  const candidates = await prisma.song.findMany({
    where: {
      AND: [
        {
          OR: [
            { title: { equals: "Dejavu", mode: "insensitive" } },
            { title: { equals: "Deja Vu", mode: "insensitive" } },
          ],
        },
        {
          OR: [
            { artist: { equals: "SS501", mode: "insensitive" } },
            { artist: { equals: "SS502", mode: "insensitive" } },
          ],
        },
      ],
    },
    select: { id: true, title: true, artist: true, spotifyId: true },
  });

  if (candidates.length === 0) {
    console.error("Nenhuma Song encontrada: Dejavu|Deja Vu + SS501|SS502");
    process.exit(1);
  }
  if (candidates.length > 1) {
    console.error("Várias candidatas; refine o banco:", candidates);
    process.exit(1);
  }

  const owner = candidates[0]!;

  const tracks = await listSpotifyAlbumTracks(ALBUM_ID, "KR");
  const dejavu = tracks.find((t) => t.title.trim().toLowerCase() === "dejavu");
  if (!dejavu) {
    console.error("Faixa Dejavu não listada no álbum", ALBUM_ID, tracks);
    process.exit(1);
  }

  const TRACK_ID = dejavu.spotifyId;
  const taken = await prisma.song.findFirst({
    where: { spotifyId: TRACK_ID, NOT: { id: owner.id } },
    select: { id: true, title: true, artist: true },
  });
  if (taken) {
    console.error("spotify_id já usado:", taken);
    process.exit(1);
  }

  const meta = await getSpotifyTrackMetadataById(TRACK_ID, "KR");
  if (!meta) {
    console.error("Sem metadados Spotify para", TRACK_ID);
    process.exit(1);
  }

  const titleNorm = meta?.title?.toLowerCase().replace(/\s+/g, "") ?? "";
  if (!titleNorm.includes("dejavu")) {
    console.error("Meta inesperada:", meta?.title, meta?.primaryArtist?.name);
    process.exit(1);
  }

  const res = await applySpotifyMetadataToSong(owner.id, meta, dryRun);
  if (!res.ok) {
    console.error(res);
    process.exit(1);
  }

  if (!dryRun && meta.primaryArtist) {
    await prisma.song.update({
      where: { id: owner.id },
      data: {
        title: meta.title,
        artist: meta.primaryArtist.name,
      },
    });
  }

  console.log(dryRun ? "dry_ok" : "ok", owner.artist, "->", meta.primaryArtist?.name, TRACK_ID, "album", ALBUM_ID);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

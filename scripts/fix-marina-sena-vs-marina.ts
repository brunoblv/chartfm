/**
 * Corrige músicas atribuídas a "Marina Sena" que, no Spotify,
 * pertencem na verdade à artista MARINA (spotify artist id 6CwfuxIqcltXDGjfZsMd9A).
 *
 * Uso:
 *   npx tsx scripts/fix-marina-sena-vs-marina.ts --dry-run
 *   npx tsx scripts/fix-marina-sena-vs-marina.ts
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { getSpotifyTrackMetadataById, searchSpotifyTracks, spotifyConfigured } from "../lib/spotify-server";

const CORRECT_ARTIST_SPOTIFY_ID = "6CwfuxIqcltXDGjfZsMd9A";
const WRONG_ARTIST_TEXT = "marina sena";

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

type CandidateSong = {
  id: string;
  title: string;
  artist: string;
  spotifyId: string | null;
};

async function resolveMeta(song: CandidateSong) {
  if (song.spotifyId?.trim()) {
    return getSpotifyTrackMetadataById(song.spotifyId, "US");
  }

  const query = `track:\"${song.title.replace(/"/g, "")}\" artist:\"MARINA\"`;
  const hits = await searchSpotifyTracks(query, 8, "US");
  const best = hits.find((h) => h.artist.toLowerCase().includes("marina")) ?? hits[0];
  if (!best?.spotifyId) return null;
  return getSpotifyTrackMetadataById(best.spotifyId, "US");
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  const candidates = await prisma.song.findMany({
    where: {
      artist: { contains: WRONG_ARTIST_TEXT, mode: "insensitive" },
    },
    select: { id: true, title: true, artist: true, spotifyId: true },
    orderBy: { id: "asc" },
  });

  console.log(`candidatas=${candidates.length} dry_run=${dryRun}`);

  let fixed = 0;
  let skipped = 0;
  let failed = 0;

  for (const song of candidates) {
    const meta = await resolveMeta(song);
    if (!meta?.primaryArtist?.spotifyId) {
      console.log(`SKIP sem_meta ${song.id} :: ${song.title} — ${song.artist}`);
      skipped += 1;
      continue;
    }

    if (meta.primaryArtist.spotifyId !== CORRECT_ARTIST_SPOTIFY_ID) {
      console.log(
        `SKIP outro_artista ${song.id} :: ${song.title} — ${song.artist} -> ${meta.primaryArtist.name} (${meta.primaryArtist.spotifyId})`,
      );
      skipped += 1;
      continue;
    }

    const res = await applySpotifyMetadataToSong(song.id, meta, dryRun);
    if (!res.ok) {
      console.log(`FAIL ${song.id} :: ${song.title} — motivo=${res.reason}`);
      failed += 1;
      continue;
    }

    if (!dryRun) {
      // Garante texto canônico de artista na Song (links/slug/histórico local).
      await prisma.song.update({
        where: { id: song.id },
        data: {
          artist: meta.primaryArtist.name,
          title: meta.title,
          album: meta.album.title ?? undefined,
        },
      });
    }

    console.log(
      `${dryRun ? "DRY" : "OK "} ${song.id} :: ${song.title} — ${song.artist} -> ${meta.title} — ${meta.primaryArtist.name}`,
    );
    fixed += 1;
  }

  console.log(JSON.stringify({ fixed, skipped, failed, dryRun }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * Liga metadados Spotify às faixas:
 * - If you say you don't love someone, then you don't love them anymore — Nickthereal
 *   https://open.spotify.com/track/1lq0LbifVhOs1xmxCWOJVr
 * - Unfinished Dream — Nickthereal
 *   https://open.spotify.com/track/1W1hLJrAXj6im03tU9yato
 *
 * Uso: npx tsx scripts/fix-nickthereal-two-tracks-spotify.ts [--dry-run]
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { prisma } from "../lib/prisma";
import { getSpotifyTrackMetadataById, spotifyConfigured } from "../lib/spotify-server";

const PAIRS: Array<{ titleVariants: string[]; artistVariants: string[]; trackId: string; hint: string }> = [
  {
    titleVariants: [
      "If you say you don't love someone, then you don't love them anymore",
      "If You Say You Don't Love Someone, Then You Don't Love Them Anymore",
    ],
    artistVariants: ["Nickthereal", "NICKTHEREAL", "NickThereal"],
    trackId: "1lq0LbifVhOs1xmxCWOJVr",
    hint: "don't love",
  },
  {
    titleVariants: ["Unfinished Dream", "UNFINISHED DREAM"],
    artistVariants: ["Nickthereal", "NICKTHEREAL", "NickThereal"],
    trackId: "1W1hLJrAXj6im03tU9yato",
    hint: "unfinished",
  },
];

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

async function findSong(titleVariants: string[], artistVariants: string[]) {
  for (const title of titleVariants) {
    for (const artist of artistVariants) {
      const s = await prisma.song.findUnique({
        where: { title_artist: { title, artist } },
        select: { id: true, title: true, artist: true, spotifyId: true },
      });
      if (s) return s;
    }
  }
  const orTitle = titleVariants.map((title) => ({
    title: { equals: title, mode: Prisma.QueryMode.insensitive },
  }));
  const orArtist = artistVariants.map((artist) => ({
    artist: { equals: artist, mode: Prisma.QueryMode.insensitive },
  }));
  return prisma.song.findFirst({
    where: { AND: [{ OR: orTitle }, { OR: orArtist }] },
    select: { id: true, title: true, artist: true, spotifyId: true },
  });
}

async function resolveSpotifyIdConflictIfNeeded(
  targetSongId: string,
  trackId: string,
  meta: NonNullable<Awaited<ReturnType<typeof getSpotifyTrackMetadataById>>>,
  dryRun: boolean,
) {
  const other = await prisma.song.findFirst({
    where: { spotifyId: trackId, NOT: { id: targetSongId } },
    select: { id: true, title: true, artist: true },
  });
  if (!other) return;

  console.log(
    JSON.stringify({
      merge_dup_spotify: true,
      remove: other,
      keep: targetSongId,
    }),
  );

  if (dryRun) return;

  await prisma.songFeat.deleteMany({ where: { songSpotifyId: trackId } });

  const songSpotifyId = meta.spotifyId?.trim() || null;
  const albumSpotifyId = meta.album.spotifyId?.trim() || null;

  await prisma.chartEntry.updateMany({
    where: { songId: other.id },
    data: { songId: targetSongId, songSpotifyId, albumSpotifyId },
  });

  await prisma.song.update({
    where: { id: other.id },
    data: {
      spotifyId: null,
      artistSpotifyId: null,
      albumSpotifyId: null,
      spotifyUrl: null,
      previewUrl: null,
      durationMs: null,
      trackNumber: null,
    },
  });

  const left = await prisma.chartEntry.count({ where: { songId: other.id } });
  if (left === 0) {
    await prisma.song.delete({ where: { id: other.id } });
    console.log("deleted_dup_song", other.id);
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  for (const p of PAIRS) {
    const song = await findSong(p.titleVariants, p.artistVariants);
    if (!song) {
      console.error("Song não encontrada:", p.hint, p.titleVariants[0]);
      process.exit(1);
    }

    const meta = await getSpotifyTrackMetadataById(p.trackId, "BR");
    if (!meta) {
      console.error("Spotify sem meta:", p.trackId);
      process.exit(1);
    }

    const nick = meta.primaryArtist?.name?.toLowerCase().includes("nick") ?? false;
    if (!nick) {
      console.error("Artista inesperado:", meta.primaryArtist?.name, p.trackId);
      process.exit(1);
    }

    console.log(JSON.stringify({ dryRun, song, spotifyTitle: meta.title, trackId: p.trackId }));

    await resolveSpotifyIdConflictIfNeeded(song.id, p.trackId, meta, dryRun);

    const applied = await applySpotifyMetadataToSong(song.id, meta, dryRun);
    if (!applied.ok) {
      console.error(applied);
      process.exit(1);
    }
    console.log(dryRun ? "dry_ok" : "ok", song.id, p.trackId);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

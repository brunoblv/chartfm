/**
 * Corrige a música errada "I Did It!" / "KittenSneeze" para
 * a faixa real "I Did It!" da artista Kitten no Spotify.
 *
 * Também remapeia entradas de paradas (`ChartEntry.songId`) para a música correta,
 * preservando histórico já publicado.
 *
 * Uso (raiz do chartify):
 *   npx tsx scripts/fix-kitten-i-did-it.ts --dry-run
 *   npx tsx scripts/fix-kitten-i-did-it.ts
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { getSpotifyTrackMetadataById, spotifyConfigured } from "../lib/spotify-server";

const prisma = new PrismaClient();

const CORRECT_TRACK_SPOTIFY_ID = "488Tk9iPifa1ba8XiJ1oMe";
const WRONG_TITLE = "I Did It!";
const WRONG_ARTIST = "KittenSneeze";
const CANONICAL_ARTIST = "Kitten";

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

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  const meta = await getSpotifyTrackMetadataById(CORRECT_TRACK_SPOTIFY_ID, "US");
  if (!meta) {
    console.error("Falha ao obter metadados Spotify da faixa correta.");
    process.exit(1);
  }

  const normalizedTitle = meta.title.toLowerCase().replace(/\s+/g, " ").trim();
  const normalizedArtist = (meta.primaryArtist?.name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalizedTitle.includes("i did it") || !normalizedArtist.includes("kitten")) {
    console.error("A faixa configurada não parece ser 'I Did It!' da artista Kitten.");
    console.error("meta", { title: meta.title, artist: meta.primaryArtist?.name, spotifyId: meta.spotifyId });
    process.exit(1);
  }

  const [canonicalBySpotify, canonicalByName, wrongSongs] = await Promise.all([
    prisma.song.findUnique({
      where: { spotifyId: CORRECT_TRACK_SPOTIFY_ID },
      select: { id: true, title: true, artist: true, spotifyId: true },
    }),
    prisma.song.findFirst({
      where: {
        title: { equals: WRONG_TITLE, mode: "insensitive" },
        artist: { equals: CANONICAL_ARTIST, mode: "insensitive" },
      },
      select: { id: true, title: true, artist: true, spotifyId: true },
    }),
    prisma.song.findMany({
      where: {
        title: { equals: WRONG_TITLE, mode: "insensitive" },
        OR: [
          { artist: { equals: WRONG_ARTIST, mode: "insensitive" } },
          { artist: { contains: "kitten", mode: "insensitive" } },
        ],
      },
      select: { id: true, title: true, artist: true, spotifyId: true },
      orderBy: { id: "asc" },
    }),
  ]);

  let target = canonicalBySpotify ?? canonicalByName ?? wrongSongs[0] ?? null;

  if (!target) {
    if (dryRun) {
      console.log("DRY create Song", { title: meta.title, artist: meta.primaryArtist?.name ?? CANONICAL_ARTIST });
      return;
    }
    target = await prisma.song.create({
      data: {
        title: meta.title,
        artist: meta.primaryArtist?.name ?? CANONICAL_ARTIST,
        album: meta.album.title ?? null,
      },
      select: { id: true, title: true, artist: true, spotifyId: true },
    });
  }

  console.log("target_song", target);
  console.log("wrong_song_candidates", wrongSongs.length);

  const res = await applySpotifyMetadataToSong(target.id, meta, dryRun);
  if (!res.ok) {
    console.error("Falha ao aplicar metadados:", res.reason);
    process.exit(1);
  }

  if (!dryRun) {
    await prisma.song.update({
      where: { id: target.id },
      data: {
        title: meta.title,
        artist: meta.primaryArtist?.name ?? CANONICAL_ARTIST,
        album: meta.album.title ?? undefined,
      },
    });
  }

  const sourceIds = wrongSongs.map((s) => s.id).filter((id) => id !== target!.id);
  if (sourceIds.length) {
    if (dryRun) {
      const counts = await Promise.all(sourceIds.map((id) => prisma.chartEntry.count({ where: { songId: id } })));
      console.log(
        "DRY remap ChartEntry",
        sourceIds.map((id, i) => ({ fromSongId: id, toSongId: target!.id, entries: counts[i] })),
      );
    } else {
      for (const srcId of sourceIds) {
        const moved = await prisma.chartEntry.updateMany({
          where: { songId: srcId },
          data: {
            songId: target.id,
            songSpotifyId: meta.spotifyId,
            albumSpotifyId: meta.album.spotifyId ?? null,
          },
        });
        console.log("remapped_entries", { fromSongId: srcId, toSongId: target.id, count: moved.count });

        const refs = await prisma.chartEntry.count({ where: { songId: srcId } });
        if (refs === 0) {
          await prisma.song.delete({ where: { id: srcId } });
          console.log("deleted_wrong_song", srcId);
        }
      }
    }
  }

  console.log(dryRun ? "dry_run_ok" : "updated_ok", {
    targetSongId: target.id,
    spotifyId: meta.spotifyId,
    albumSpotifyId: meta.album.spotifyId,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * Alinha o artista Oh My Girl ao perfil oficial do Spotify:
 * https://open.spotify.com/intl-pt/artist/2019zR22qK2RBvCqtudBaI
 *
 * Atualiza `artists` (upsert) e `Song.artist_spotify_id` para músicas cujo
 * texto `artist` corresponde a variantes comuns (ex.: planilha "OhMyGirl").
 *
 * Uso: npx tsx scripts/fix-oh-my-girl-artist-spotify.ts [--dry-run]
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getSpotifyArtistById, spotifyConfigured } from "../lib/spotify-server";

const CORRECT_ARTIST_SPOTIFY_ID = "2019zR22qK2RBvCqtudBaI";

/** Nomes como aparecem na planilha / import — não altera o texto `Song.artist`. */
const ARTIST_NAME_VARIANTS = ["OhMyGirl", "Oh My Girl", "OH MY GIRL", "Oh my girl"];

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

  const profile = await getSpotifyArtistById(CORRECT_ARTIST_SPOTIFY_ID);
  if (!profile) {
    console.error("Spotify: artista não encontrado", CORRECT_ARTIST_SPOTIFY_ID);
    process.exit(1);
  }

  const before = await prisma.song.findMany({
    where: {
      OR: ARTIST_NAME_VARIANTS.map((a) => ({
        artist: { equals: a, mode: Prisma.QueryMode.insensitive },
      })),
    },
    select: { id: true, title: true, artist: true, artistSpotifyId: true },
    take: 500,
  });

  const distinctOld = [...new Set(before.map((s) => s.artistSpotifyId ?? "(null)"))];
  console.log(
    JSON.stringify({
      dryRun,
      spotifyArtist: profile.name,
      songsMatched: before.length,
      distinctPreviousArtistSpotifyId: distinctOld,
    }),
  );

  if (!dryRun) {
    await prisma.artist.upsert({
      where: { spotifyId: CORRECT_ARTIST_SPOTIFY_ID },
      create: {
        spotifyId: CORRECT_ARTIST_SPOTIFY_ID,
        name: profile.name,
        genres: profile.genres,
        spotifyUrl: profile.spotifyUrl,
        imageUrl: profile.imageUrl,
      },
      update: {
        name: profile.name,
        genres: profile.genres,
        spotifyUrl: profile.spotifyUrl ?? undefined,
        imageUrl: profile.imageUrl ?? undefined,
      },
    });

    const up = await prisma.song.updateMany({
      where: {
        OR: ARTIST_NAME_VARIANTS.map((a) => ({
          artist: { equals: a, mode: Prisma.QueryMode.insensitive },
        })),
      },
      data: { artistSpotifyId: CORRECT_ARTIST_SPOTIFY_ID },
    });

    console.log(JSON.stringify({ ok: true, songsUpdated: up.count }));
  } else {
    console.log(JSON.stringify({ dry_ok: true, wouldUpdate: before.length }));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

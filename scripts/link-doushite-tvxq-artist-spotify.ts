/**
 * Depois da `Song` manual (sem track no Spotify), associa o perfil oficial TVXQ!
 * em `Song.artist_spotify_id` e garante a linha em `artists`.
 *
 * Uso:
 *   npx tsx scripts/link-doushite-tvxq-artist-spotify.ts --dry-run
 *   npx tsx scripts/link-doushite-tvxq-artist-spotify.ts --apply
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { getSpotifyArtistById, spotifyConfigured } from "../lib/spotify-server";

const SHEET_TITLE = "Doushite kimi wo suki ni natte shimattandarou?";
const SHEET_ARTIST = "TVXQ!";
/** Perfil "TVXQ!" no Spotify (mesmo catálogo usado no app). */
const TVXQ_SPOTIFY_ARTIST_ID = "6nVMMEywS5Y4tsHPKx1nIo";

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
  const apply = process.argv.includes("--apply");
  if ((!dryRun && !apply) || (dryRun && apply)) {
    console.error("Use exatamente um de: --dry-run | --apply");
    process.exit(1);
  }

  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  const song = await prisma.song.findUnique({
    where: { title_artist: { title: SHEET_TITLE, artist: SHEET_ARTIST } },
    select: { id: true, title: true, artist: true, artistSpotifyId: true, spotifyId: true },
  });
  if (!song) {
    console.error('Song não encontrada. Corra antes: npx tsx scripts/fix-doushite-tvxq-secret-code.ts --apply');
    process.exit(1);
  }

  const profile = await getSpotifyArtistById(TVXQ_SPOTIFY_ARTIST_ID);
  if (!profile) {
    console.error("Spotify: artista não encontrado", TVXQ_SPOTIFY_ARTIST_ID);
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        song: { id: song.id, title: song.title, artist: song.artist, artistSpotifyId: song.artistSpotifyId },
        spotifyArtist: {
          spotifyId: profile.spotifyId,
          name: profile.name,
          spotifyUrl: profile.spotifyUrl,
        },
      },
      null,
      2,
    ),
  );

  if (!apply) return;

  await prisma.artist.upsert({
    where: { spotifyId: TVXQ_SPOTIFY_ARTIST_ID },
    create: {
      spotifyId: profile.spotifyId,
      name: profile.name,
      genres: profile.genres,
      spotifyUrl: profile.spotifyUrl ?? null,
      imageUrl: profile.imageUrl ?? null,
    },
    update: {
      name: profile.name,
      genres: profile.genres,
      spotifyUrl: profile.spotifyUrl ?? undefined,
      ...(profile.imageUrl ? { imageUrl: profile.imageUrl } : {}),
    },
  });

  await prisma.song.update({
    where: { id: song.id },
    data: { artistSpotifyId: TVXQ_SPOTIFY_ARTIST_ID },
  });

  console.log(JSON.stringify({ ok: true, songId: song.id, artistSpotifyId: TVXQ_SPOTIFY_ARTIST_ID }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

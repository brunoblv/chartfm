/**
 * Cria ou atualiza o registro em `artists` para Jun Hyo Seong com dados oficiais do Spotify.
 *
 * Uso:
 *   npx tsx scripts/upsert-jun-hyo-seong-artist-from-spotify.ts --dry-run
 *   npx tsx scripts/upsert-jun-hyo-seong-artist-from-spotify.ts --apply
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getSpotifyArtistById, spotifyConfigured } from "../lib/spotify-server";

const SPOTIFY_ARTIST_ID = "73RRzEpK7IQexOhC0CuTRZ";

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

  const profile = await getSpotifyArtistById(SPOTIFY_ARTIST_ID);
  if (!profile) {
    console.error("Spotify: artista não encontrado", SPOTIFY_ARTIST_ID);
    process.exit(1);
  }

  const payload = {
    spotifyId: profile.spotifyId,
    name: profile.name,
    genres: profile.genres,
    spotifyUrl: profile.spotifyUrl,
    imageUrl: profile.imageUrl,
  };

  console.log(JSON.stringify({ dryRun, apply, profile: payload }, null, 2));

  if (!apply) return;

  await prisma.artist.upsert({
    where: { spotifyId: SPOTIFY_ARTIST_ID },
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

  const linked = await prisma.song.updateMany({
    where: {
      artist: { equals: profile.name, mode: Prisma.QueryMode.insensitive },
      OR: [{ artistSpotifyId: null }, { artistSpotifyId: "" }],
    },
    data: { artistSpotifyId: SPOTIFY_ARTIST_ID },
  });

  console.log(JSON.stringify({ ok: true, upserted: SPOTIFY_ARTIST_ID, songsArtistSpotifyIdSet: linked.count }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

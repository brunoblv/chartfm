/** Corrige o álbum do O Terno na rodada 3. */
import { AlbumType, PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getSpotifyAlbumDetails, getSpotifyArtistById } from "../lib/spotify-server";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

const SPOTIFY_ID = "7nf6cMzbnj1BqhY5VBwT16";
const ROUND_ID = "clube_round_003";
const OLD_SPOTIFY_ID = "02vHpEZ51lnEYQ5cSm233p";

const prisma = new PrismaClient();

function mapAlbumType(raw: string | null): AlbumType | undefined {
  if (!raw) return undefined;
  const v = raw.toUpperCase();
  if (v === "SINGLE" || v === "EP" || v === "ALBUM" || v === "COMPILATION") return v as AlbumType;
  return undefined;
}

async function main() {
  const details = await getSpotifyAlbumDetails(SPOTIFY_ID);
  if (!details?.artistSpotifyId) throw new Error("Álbum não encontrado no Spotify");

  const artistProfile = await getSpotifyArtistById(details.artistSpotifyId);
  await prisma.artist.upsert({
    where: { spotifyId: details.artistSpotifyId },
    update: {
      name: artistProfile?.name ?? details.artistName ?? "O Terno",
      genres: artistProfile?.genres ?? [],
    },
    create: {
      spotifyId: details.artistSpotifyId,
      name: artistProfile?.name ?? details.artistName ?? "O Terno",
      genres: artistProfile?.genres ?? [],
      spotifyUrl: artistProfile?.spotifyUrl ?? null,
      imageUrl: artistProfile?.imageUrl ?? null,
    },
  });

  const album = await prisma.album.upsert({
    where: { spotifyId: SPOTIFY_ID },
    update: {
      title: details.title,
      coverUrl: details.coverUrl ?? null,
      spotifyUrl: details.spotifyUrl ?? null,
    },
    create: {
      spotifyId: SPOTIFY_ID,
      title: details.title,
      artistSpotifyId: details.artistSpotifyId,
      albumType: mapAlbumType(details.albumType),
      releaseDate: details.releaseDate ? new Date(`${details.releaseDate}T12:00:00.000Z`) : null,
      coverUrl: details.coverUrl ?? null,
      spotifyUrl: details.spotifyUrl ?? null,
      totalTracks: details.totalTracks ?? null,
      label: details.label ?? null,
    },
    select: { id: true, title: true },
  });

  const oldAlbum = await prisma.album.findUnique({ where: { spotifyId: OLD_SPOTIFY_ID }, select: { id: true } });
  const nominations = await prisma.albumClubNomination.findMany({
    where: { roundId: ROUND_ID, ...(oldAlbum ? { albumId: oldAlbum.id } : {}) },
    include: { album: { select: { title: true, spotifyId: true } } },
  });

  const ternoNom = nominations.find(
    (n) => n.album.spotifyId === OLD_SPOTIFY_ID || n.album.title.toLowerCase().includes("terno"),
  );

  if (!ternoNom) {
    console.log("Nenhuma indicação do O Terno encontrada na rodada 3.");
    return;
  }

  await prisma.albumClubNomination.update({
    where: { id: ternoNom.id },
    data: { albumId: album.id },
  });

  console.log(`✓ Indicação atualizada: O Terno — ${album.title} (db #${album.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/** Adiciona Rihanna — ANTI à rodada 3 do Clube. */
import { AlbumType, PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  getSpotifyAlbumDetails,
  getSpotifyArtistById,
  searchSpotifyAlbums,
} from "../lib/spotify-server";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

const ROUND_ID = "clube_round_003";
const SPOTIFY_ID = "48i37aZTC1prDr4EcpQeEa"; // Rihanna — ANTI (2016)

const prisma = new PrismaClient();

function mapAlbumType(raw: string | null): AlbumType | undefined {
  if (!raw) return undefined;
  const v = raw.toUpperCase();
  if (v === "SINGLE" || v === "EP" || v === "ALBUM" || v === "COMPILATION") return v as AlbumType;
  return undefined;
}

async function ensureAlbum(spotifyAlbumId: string) {
  const existing = await prisma.album.findUnique({ where: { spotifyId: spotifyAlbumId }, select: { id: true } });
  if (existing) return existing.id;

  const details = await getSpotifyAlbumDetails(spotifyAlbumId);
  if (!details?.artistSpotifyId) throw new Error("Álbum não encontrado");

  const artistProfile = await getSpotifyArtistById(details.artistSpotifyId);
  await prisma.artist.upsert({
    where: { spotifyId: details.artistSpotifyId },
    update: { name: artistProfile?.name ?? details.artistName ?? "Rihanna" },
    create: {
      spotifyId: details.artistSpotifyId,
      name: artistProfile?.name ?? details.artistName ?? "Rihanna",
      genres: artistProfile?.genres ?? [],
      spotifyUrl: artistProfile?.spotifyUrl ?? null,
      imageUrl: artistProfile?.imageUrl ?? null,
    },
  });

  const album = await prisma.album.create({
    data: {
      spotifyId: spotifyAlbumId,
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
  return album.id;
}

async function main() {
  let spotifyId = SPOTIFY_ID;
  const hits = await searchSpotifyAlbums("Rihanna ANTI", 5);
  const anti = hits.find((h) => h.title.toLowerCase().includes("anti")) ?? hits[0];
  if (anti) {
    spotifyId = anti.spotifyId;
    console.log(`Spotify: ${anti.artist} — ${anti.title} (${spotifyId})`);
  }

  const albumId = await ensureAlbum(spotifyId);

  const dup = await prisma.albumClubNomination.findFirst({
    where: { roundId: ROUND_ID, albumId },
  });
  if (dup) {
    console.log("ANTI já está na rodada 3.");
    return;
  }

  const user = await prisma.user.upsert({
    where: { handle: "clube_r3_import_12" },
    update: {},
    create: { handle: "clube_r3_import_12", name: "Importação Clube R3 #12" },
    select: { id: true },
  });

  await prisma.albumClubNomination.create({
    data: { roundId: ROUND_ID, userId: user.id, albumId, slot: 1 },
  });

  const album = await prisma.album.findUnique({ where: { id: albumId }, select: { title: true } });
  console.log(`✓ ANTI adicionado à rodada 3 (${album?.title})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

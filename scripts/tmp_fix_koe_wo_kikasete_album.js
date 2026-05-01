const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const TRACK_TITLE = "Koe wo kikasete";
const ARTIST_NAME = "BIGBANG";
const TARGET_ALBUM = "Koe wo Kikasete";
const MANUAL_ALBUM_SPOTIFY_ID = "manual_bigbang_koe_wo_kikasete";
const MANUAL_ARTIST_SPOTIFY_ID = "manual_bigbang";

async function main() {
  const songs = await prisma.song.findMany({
    where: {
      title: { equals: TRACK_TITLE, mode: "insensitive" },
      artist: { contains: ARTIST_NAME, mode: "insensitive" },
    },
    select: {
      id: true,
      title: true,
      artist: true,
      spotifyId: true,
      artistSpotifyId: true,
      albumSpotifyId: true,
    },
  });
  if (!songs.length) throw new Error("Música não encontrada no banco.");

  const existingArtist = await prisma.artist.findFirst({
    where: { name: { equals: ARTIST_NAME, mode: "insensitive" } },
    select: { spotifyId: true },
  });

  const artistSpotifyId = existingArtist?.spotifyId ?? MANUAL_ARTIST_SPOTIFY_ID;

  if (!existingArtist) {
    await prisma.artist.upsert({
      where: { spotifyId: MANUAL_ARTIST_SPOTIFY_ID },
      update: { name: ARTIST_NAME },
      create: { spotifyId: MANUAL_ARTIST_SPOTIFY_ID, name: ARTIST_NAME },
    });
    console.log("Artista criado com ID manual:", MANUAL_ARTIST_SPOTIFY_ID);
  }

  const album = await prisma.album.upsert({
    where: { spotifyId: MANUAL_ALBUM_SPOTIFY_ID },
    update: { title: TARGET_ALBUM, artistSpotifyId },
    create: { spotifyId: MANUAL_ALBUM_SPOTIFY_ID, title: TARGET_ALBUM, artistSpotifyId },
    select: { id: true, title: true, spotifyId: true, coverUrl: true },
  });

  const ids = songs.map((s) => s.id);
  await prisma.song.updateMany({
    where: { id: { in: ids } },
    data: {
      album: TARGET_ALBUM,
      albumSpotifyId: MANUAL_ALBUM_SPOTIFY_ID,
      artistSpotifyId,
    },
  });

  const updatedSongs = await prisma.song.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      title: true,
      artist: true,
      album: true,
      albumSpotifyId: true,
      albumRef: { select: { id: true, title: true, spotifyId: true, coverUrl: true } },
    },
  });

  console.log(JSON.stringify({ album, updatedSongs }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

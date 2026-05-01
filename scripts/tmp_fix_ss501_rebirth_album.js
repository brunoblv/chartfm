const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const ARTIST_NAME = "SS501";
const TARGET_ALBUM = "SS501 / Rebirth";
const MANUAL_ALBUM_SPOTIFY_ID = "manual_ss501_rebirth";
const MANUAL_ARTIST_SPOTIFY_ID = "manual_ss501";

async function main() {
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
  } else {
    console.log("Artista encontrado no banco:", existingArtist.spotifyId);
  }

  const album = await prisma.album.upsert({
    where: { spotifyId: MANUAL_ALBUM_SPOTIFY_ID },
    update: { title: TARGET_ALBUM, artistSpotifyId },
    create: { spotifyId: MANUAL_ALBUM_SPOTIFY_ID, title: TARGET_ALBUM, artistSpotifyId },
    select: { id: true, title: true, spotifyId: true, coverUrl: true },
  });

  console.log(JSON.stringify({ album }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

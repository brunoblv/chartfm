/**
 * Artista manual, álbum e faixa única conforme Single "Shout To The Lord" / American Idol 7 Top 8.
 *
 * Uso: npx tsx scripts/ensure-american-idol-shout-to-the-lord.ts
 */

import { PrismaClient } from "@prisma/client";
import { slugify } from "../lib/music-routes";

const prisma = new PrismaClient();

const ARTIST_NAME = "American Idol 7 Top 8";
const ALBUM_TITLE = "Shout To The Lord";
const SONG_TITLE = "Shout To The Lord";
const COVER_PUBLIC_PATH = "/covers/american-idol-7-top8-shout-to-the-lord.png";

async function main() {
  const artistSpotifyId = `manual_${slugify(ARTIST_NAME)}`;
  const albumSpotifyId = `manual_${slugify(ARTIST_NAME)}_${slugify(ALBUM_TITLE)}`;

  const artist = await prisma.artist.upsert({
    where: { spotifyId: artistSpotifyId },
    create: {
      spotifyId: artistSpotifyId,
      name: ARTIST_NAME,
    },
    update: { name: ARTIST_NAME },
    select: { id: true, spotifyId: true, name: true },
  });

  const album = await prisma.album.upsert({
    where: { spotifyId: albumSpotifyId },
    create: {
      spotifyId: albumSpotifyId,
      title: ALBUM_TITLE,
      artistSpotifyId,
      albumType: "SINGLE",
      coverUrl: COVER_PUBLIC_PATH,
    },
    update: {
      title: ALBUM_TITLE,
      artistSpotifyId,
      coverUrl: COVER_PUBLIC_PATH,
    },
    select: { id: true, spotifyId: true, title: true },
  });

  const song = await prisma.song.upsert({
    where: {
      title_artist: {
        title: SONG_TITLE,
        artist: ARTIST_NAME,
      },
    },
    create: {
      title: SONG_TITLE,
      artist: ARTIST_NAME,
      album: ALBUM_TITLE,
      artistSpotifyId,
      albumSpotifyId,
    },
    update: {
      album: ALBUM_TITLE,
      artistSpotifyId,
      albumSpotifyId,
    },
    select: {
      id: true,
      title: true,
      artist: true,
      album: true,
      spotifyId: true,
      artistSpotifyId: true,
      albumSpotifyId: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        artist,
        album,
        song,
        urls: {
          cover: COVER_PUBLIC_PATH,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

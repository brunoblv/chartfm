import type { Prisma } from "@prisma/client";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const COVER = "/covers/tvxq-album-t.png";
const ALBUM = "T";
const ARTIST = "TVXQ!";

const TITLES = ["Purple Line", "Lovin' You", "Forever Love", "SHINE", "Summer Dream"] as const;

async function main() {
  const whereSong: Prisma.SongWhereInput = {
    artist: ARTIST,
    OR: TITLES.map((title) => ({ title: { equals: title, mode: "insensitive" as const } })),
  };

  const songs = await prisma.song.findMany({
    where: whereSong,
    select: { albumSpotifyId: true },
  });
  const ids = [...new Set(songs.map((s) => s.albumSpotifyId).filter((id): id is string => Boolean(id?.trim())))];

  let albums = 0;
  for (const spotifyId of ids) {
    const r = await prisma.album.updateMany({
      where: { spotifyId },
      data: { coverUrl: COVER },
    });
    albums += r.count;
  }

  const titles = await prisma.song.updateMany({
    where: whereSong,
    data: { album: ALBUM },
  });
  console.log(JSON.stringify({ albums_updated: albums, songs_title_updated: titles.count, album_spotify_ids: ids.length }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

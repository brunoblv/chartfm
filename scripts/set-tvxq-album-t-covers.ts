import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const COVER = "/covers/tvxq-album-t.png";
const ALBUM = "T";
const ARTIST = "TVXQ!";

const TITLES = ["Purple Line", "Lovin' You", "Forever Love", "SHINE", "Summer Dream"] as const;

async function main() {
  const r = await prisma.song.updateMany({
    where: {
      artist: ARTIST,
      OR: TITLES.map((title) => ({ title: { equals: title, mode: "insensitive" as const } })),
    },
    data: {
      coverImageUrl: COVER,
      album: ALBUM,
    },
  });
  console.log("songs_updated", r.count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

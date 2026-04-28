import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Arte oficial Mirotic (The Fourth Album), em `public/covers/`. */
const COVER = "/covers/tvxq-mirotic-the-4th-album.png";
const ALBUM = "Mirotic";
const ARTIST = "TVXQ!";

/** Faixas do 4º álbum coreano (títulos comuns em charts / romanização). */
const TITLES = [
  "MIROTIC",
  "Mirotic",
  "Wrong Number",
  "Picture Of You",
  "Crazy Love",
  "Hey! (Don't Bring Me Down)",
  "Hey!",
  "You're My Melody",
  "Rainbow",
  "Paradise",
  "Are You A Good Girl?",
  "Flower Lady",
  "Forgotten Season",
  "Love In The Ice",
  "노을..바라보다",
  "넌 나의 노래",
  "무지개",
  "낙원",
  "악취",
  "잊혀진 계절",
] as const;

async function main() {
  const titleOr = TITLES.map((title) => ({
    title: { equals: title, mode: "insensitive" as const },
  }));

  const r = await prisma.song.updateMany({
    where: {
      artist: ARTIST,
      OR: [
        { album: { contains: "Mirotic", mode: "insensitive" } },
        { album: { contains: "MIROTIC", mode: "insensitive" } },
        { album: { contains: "Fourth Album", mode: "insensitive" } },
        { title: { contains: "mirotic", mode: "insensitive" } },
        ...titleOr,
      ],
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

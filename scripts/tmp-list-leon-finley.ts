import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.song.findMany({
    where: {
      OR: [
        { artist: { equals: "LÉON", mode: "insensitive" } },
        { artist: { equals: "Leonardo", mode: "insensitive" } },
        { artist: { contains: "leon", mode: "insensitive" } },
        { artist: { equals: "Finley", mode: "insensitive" } },
      ],
    },
    select: { id: true, title: true, artist: true, spotifyId: true, album: true },
    orderBy: [{ artist: "asc" }, { title: "asc" }],
    take: 100,
  });
  console.log(JSON.stringify(rows, null, 2));
}

main().catch((e)=>{ console.error(e); process.exit(1); }).finally(()=>prisma.$disconnect());

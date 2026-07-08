import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.PRODUCTION_DATABASE_URL } },
});

async function run() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { handle: { contains: "caio", mode: "insensitive" } },
        { name: { contains: "caio", mode: "insensitive" } },
        { handle: { contains: "cesar", mode: "insensitive" } },
        { name: { contains: "cesar", mode: "insensitive" } },
        { handle: { contains: "maziero", mode: "insensitive" } },
        { name: { contains: "maziero", mode: "insensitive" } },
        { handle: { contains: "soares", mode: "insensitive" } },
        { name: { contains: "soares", mode: "insensitive" } },
      ],
    },
    select: { id: true, handle: true, name: true, image: true },
  });
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

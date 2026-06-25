import { existsSync, readFileSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const arg = (process.argv[2] || "bruno").toLowerCase();
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { handle: { contains: arg, mode: "insensitive" } },
        { name: { contains: arg, mode: "insensitive" } },
        { lastfmUser: { contains: arg, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      handle: true,
      name: true,
      lastfmUser: true,
      spotifyUserId: true,
      spotifyAccessToken: true,
      spotifyRefreshToken: true,
      spotifyTokenExpiresAt: true,
    },
  });

  console.log(`Matches for "${arg}": ${users.length}`);
  for (const u of users) {
    console.log({
      handle: u.handle,
      name: u.name,
      lastfmUser: u.lastfmUser,
      spotifyUserId: u.spotifyUserId,
      hasAccessToken: Boolean(u.spotifyAccessToken),
      hasRefreshToken: Boolean(u.spotifyRefreshToken),
      tokenExpiresAt: u.spotifyTokenExpiresAt,
    });
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

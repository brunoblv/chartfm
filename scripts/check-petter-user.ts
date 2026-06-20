import { existsSync, readFileSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
}

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const byHandle = await prisma.user.findMany({
    where: { handle: { contains: "petter", mode: "insensitive" } },
    select: { id: true, name: true, email: true, handle: true, lastfmUser: true, googleId: true },
  });
  console.log("Por handle (petter):", JSON.stringify(byHandle, null, 2));

  const byLastfm = await prisma.user.findMany({
    where: { lastfmUser: { contains: "petter", mode: "insensitive" } },
    select: { id: true, name: true, email: true, handle: true, lastfmUser: true, googleId: true },
  });
  console.log("Por lastfmUser (petter):", JSON.stringify(byLastfm, null, 2));

  const byName = await prisma.user.findMany({
    where: { name: { contains: "Peterson", mode: "insensitive" } },
    select: { id: true, name: true, email: true, handle: true, lastfmUser: true, googleId: true },
  });
  console.log("Por nome (Peterson):", JSON.stringify(byName, null, 2));
}

main().finally(() => prisma.$disconnect());

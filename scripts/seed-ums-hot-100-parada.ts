/**
 * Cria a parada "Under My Skin Hot 100" para @bruno (se ainda não existir).
 *
 * Usage: npx tsx scripts/seed-ums-hot-100-parada.ts
 */

import { PrismaClient } from "@prisma/client";
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

const prisma = new PrismaClient();

const HANDLE = "bruno";
const PARADA_NAME = "Under My Skin Hot 100";

async function main() {
  const user = await prisma.user.findUnique({
    where: { handle: HANDLE },
    select: { id: true, handle: true },
  });
  if (!user) throw new Error(`Usuário @${HANDLE} não encontrado.`);

  const existing = await prisma.parada.findFirst({
    where: {
      userId: user.id,
      name: { equals: PARADA_NAME, mode: "insensitive" },
    },
  });
  if (existing) {
    console.log(`Parada já existe: "${existing.name}" (${existing.id})`);
    return;
  }

  const sortOrder = await prisma.parada.count({ where: { userId: user.id } });
  const parada = await prisma.parada.create({
    data: {
      userId: user.id,
      name: PARADA_NAME,
      genres: ["Pop", "Rock", "Indie"],
      isPrimary: false,
      sortOrder,
      chartSize: 100,
      cadence: "WEEKLY",
    },
  });

  console.log(`Parada criada: "${parada.name}" (${parada.id})`);
  console.log(`sortOrder=${parada.sortOrder}, chartSize=${parada.chartSize}, cadence=${parada.cadence}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

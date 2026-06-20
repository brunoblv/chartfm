import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function modelDelegateKey(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

function isStaleClient(client: PrismaClient): boolean {
  return Object.values(Prisma.ModelName).some((model) => !(modelDelegateKey(model) in client));
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}

function getPrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && !isStaleClient(cached)) {
    return cached;
  }
  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}

export const prisma = getPrismaClient();

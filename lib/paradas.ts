import type { Prisma, PrismaClient } from "@prisma/client";
import { maxParadasForUser } from "@/lib/mytrl-access";

type Db = PrismaClient | Prisma.TransactionClient;

import type { ParadaCadence } from "@/lib/chart-cadence";

export type ParadaRow = {
  id: string;
  userId: string;
  name: string;
  logo: string | null;
  genres: string[];
  isPrimary: boolean;
  sortOrder: number;
  chartSize: number | null;
  cadence: ParadaCadence;
};

/** Garante parada principal (migra `User.paradaNome` / `genres` / `paradaLogo` se necessário). */
export async function ensureUserParadas(db: Db, userId: string): Promise<ParadaRow[]> {
  const existing = await db.parada.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
  });
  if (existing.length > 0) return existing;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { paradaNome: true, paradaLogo: true, genres: true, handle: true, name: true, chartSize: true },
  });
  if (!user) {
    throw new Error("user_not_found");
  }

  const name =
    user.paradaNome?.trim() ||
    `Parada de ${user.name.split(" ")[0] || user.handle}`;

  try {
    const created = await db.parada.create({
      data: {
        userId,
        name,
        logo: user.paradaLogo,
        genres: user.genres ?? [],
        isPrimary: true,
        sortOrder: 0,
        chartSize: user.chartSize ?? null,
        cadence: "WEEKLY",
      },
    });
    return [created];
  } catch (err) {
    // Corrida entre requisições paralelas no primeiro setup
    const retry = await db.parada.findMany({
      where: { userId },
      orderBy: { sortOrder: "asc" },
    });
    if (retry.length > 0) return retry;
    throw err;
  }
}

export async function getPrimaryParada(db: Db, userId: string): Promise<ParadaRow> {
  const paradas = await ensureUserParadas(db, userId);
  const primary = paradas.find((p) => p.isPrimary) ?? paradas[0];
  if (!primary) {
    throw new Error("parada_not_found");
  }
  return primary;
}

export async function resolveParadaForPublish(
  db: Db,
  userId: string,
  paradaId?: string | null,
): Promise<ParadaRow> {
  const paradas = await ensureUserParadas(db, userId);
  if (paradaId) {
    const match = paradas.find((p) => p.id === paradaId);
    if (match) return match;
  }
  return getPrimaryParada(db, userId);
}

/** Mantém campos legados em `User` alinhados à parada principal (feed, cards). */
export async function syncUserPrimaryParadaFields(db: Db, userId: string): Promise<void> {
  const primary = await getPrimaryParada(db, userId);
  await db.user.update({
    where: { id: userId },
    data: {
      paradaNome: primary.name,
      paradaLogo: primary.logo,
      genres: primary.genres,
    },
  });
}

export async function countUserParadas(db: Db, userId: string): Promise<number> {
  await ensureUserParadas(db, userId);
  return db.parada.count({ where: { userId } });
}

export async function canCreateAnotherParada(
  db: Db,
  userId: string,
  handle?: string | null,
): Promise<boolean> {
  const resolvedHandle =
    handle ??
    (await db.user.findUnique({ where: { id: userId }, select: { handle: true } }))?.handle;
  const limit = maxParadasForUser(resolvedHandle);
  return (await countUserParadas(db, userId)) < limit;
}

export async function setPrimaryParada(db: Db, userId: string, paradaId: string): Promise<void> {
  const paradas = await ensureUserParadas(db, userId);
  if (!paradas.some((p) => p.id === paradaId)) {
    throw new Error("parada_not_found");
  }
  await db.parada.updateMany({
    where: { userId },
    data: { isPrimary: false },
  });
  await db.parada.update({
    where: { id: paradaId },
    data: { isPrimary: true, cadence: "WEEKLY" },
  });
  await syncUserPrimaryParadaFields(db, userId);
}

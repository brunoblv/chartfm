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
  isCommunityOfficial: boolean;
};

export const PARADA_TRASH_DAYS = 7;

/** Charts publicados da parada principal de cada usuário (elegíveis ao Global 100). */
export const publishedPrimaryParadaChartWhere = {
  isPublished: true,
  parada: { isPrimary: true },
} as const;

export function isPrimaryParadaChartEntry(entry: {
  chart: { parada: { isPrimary: boolean } };
}): boolean {
  return entry.chart.parada.isPrimary;
}

/** Garante parada principal (migra `User.paradaNome` / `genres` / `paradaLogo` se necessário). */
export async function ensureUserParadas(db: Db, userId: string): Promise<ParadaRow[]> {
  const existing = await db.parada.findMany({
    where: { userId, deletedAt: null, isCommunityOfficial: false },
    orderBy: { sortOrder: "asc" },
  });
  if (existing.length > 0) return existing;

  // Se o usuário já teve alguma parada pessoal (mesmo que hoje todas estejam na
  // lixeira), não recria uma "fantasma" a partir dos campos legados de User — evita
  // duplicar a parada que acabou de ser excluída enquanto ela ainda pode ser restaurada.
  // Ignora paradas oficiais de comunidade: quem só tem uma delas ainda não tem parada própria.
  const everHadParada = await db.parada.count({ where: { userId, isCommunityOfficial: false } });
  if (everHadParada > 0) return [];

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
      where: { userId, deletedAt: null },
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
  return db.parada.count({ where: { userId, deletedAt: null, isCommunityOfficial: false } });
}

/** Próximo sortOrder livre para o usuário. Usa o maior valor já usado (inclusive por
 * paradas excluídas) + 1, já que `@@unique([userId, sortOrder])` vale para a tabela toda —
 * contar só as ativas poderia colidir com o sortOrder de uma parada que ficou "presa"
 * numa posição depois que outra foi excluída. */
export async function nextParadaSortOrder(db: Db, userId: string): Promise<number> {
  const result = await db.parada.aggregate({
    where: { userId },
    _max: { sortOrder: true },
  });
  return (result._max.sortOrder ?? -1) + 1;
}

export async function countParadaWeeks(db: Db, paradaId: string): Promise<number> {
  return db.chart.count({ where: { paradaId } });
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

/** Move uma parada para a lixeira (soft-delete). Recuperável por `PARADA_TRASH_DAYS` dias. */
export async function softDeleteParada(db: Db, userId: string, paradaId: string): Promise<void> {
  const active = await db.parada.findMany({
    where: { userId, deletedAt: null, isCommunityOfficial: false },
    orderBy: { sortOrder: "asc" },
  });
  const target = active.find((p) => p.id === paradaId);
  if (!target) {
    throw new Error("parada_not_found");
  }

  const promoted = target.isPrimary ? active.find((p) => p.id !== paradaId) : undefined;
  if (promoted) {
    await db.parada.update({
      where: { id: promoted.id },
      data: { isPrimary: true, cadence: "WEEKLY" },
    });
  }

  await db.parada.update({
    where: { id: paradaId },
    data: { deletedAt: new Date(), isPrimary: false },
  });

  if (promoted) {
    await syncUserPrimaryParadaFields(db, userId);
  }
}

/** Restaura uma parada da lixeira, desde que o usuário ainda tenha slot disponível. */
export async function restoreParada(
  db: Db,
  userId: string,
  paradaId: string,
  handle?: string | null,
): Promise<void> {
  const trashed = await db.parada.findFirst({
    where: { id: paradaId, userId, deletedAt: { not: null } },
  });
  if (!trashed) {
    throw new Error("parada_not_found");
  }

  const active = await db.parada.findMany({
    where: { userId, deletedAt: null, isCommunityOfficial: false },
  });
  const resolvedHandle =
    handle ??
    (await db.user.findUnique({ where: { id: userId }, select: { handle: true } }))?.handle;
  if (active.length >= maxParadasForUser(resolvedHandle)) {
    throw new Error("paradas_limit_reached");
  }

  const isPrimary = !active.some((p) => p.isPrimary);
  const sortOrder = await nextParadaSortOrder(db, userId);

  await db.parada.update({
    where: { id: paradaId },
    data: { deletedAt: null, isPrimary, sortOrder },
  });

  if (isPrimary) {
    await syncUserPrimaryParadaFields(db, userId);
  }
}

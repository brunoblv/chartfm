import type { EntityPageKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { snapshotDayBrt } from "@/lib/snapshot-day";

export async function getLatestEntityPageSnapshot<T>(
  kind: EntityPageKind,
  entityKey: string,
): Promise<{ payload: T; builtAt: Date; snapshotDay: Date } | null> {
  const row = await prisma.entityPageSnapshot.findFirst({
    where: { kind, entityKey },
    orderBy: { snapshotDay: "desc" },
  });
  if (!row) return null;
  return {
    payload: row.payload as T,
    builtAt: row.builtAt,
    snapshotDay: row.snapshotDay,
  };
}

export async function saveEntityPageSnapshot(
  kind: EntityPageKind,
  entityKey: string,
  payload: unknown,
  now: Date = new Date(),
) {
  const snapshotDay = snapshotDayBrt(now);
  return prisma.entityPageSnapshot.upsert({
    where: {
      kind_entityKey_snapshotDay: { kind, entityKey, snapshotDay },
    },
    create: {
      kind,
      entityKey,
      payload: payload as object,
      snapshotDay,
      builtAt: now,
    },
    update: {
      payload: payload as object,
      builtAt: now,
    },
  });
}

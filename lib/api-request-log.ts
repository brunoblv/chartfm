import { prisma } from "@/lib/prisma";

export type ApiRequestLogSource = "user" | "system" | "anonymous";

export type ApiRequestLogInput = {
  id: string;
  method: string;
  path: string;
  source: ApiRequestLogSource;
  userId?: string | null;
  userName?: string | null;
  userHandle?: string | null;
};

export async function recordApiRequestStart(input: ApiRequestLogInput): Promise<void> {
  await prisma.apiRequestLog.create({
    data: {
      id: input.id,
      method: input.method,
      path: input.path,
      source: input.source,
      userId: input.userId ?? null,
      userName: input.userName ?? null,
      userHandle: input.userHandle ?? null,
    },
  });
}

export async function recordApiRequestError(id: string, errorMessage: string): Promise<void> {
  await prisma.apiRequestLog.update({
    where: { id },
    data: { ok: false, errorMessage: errorMessage.slice(0, 2000) },
  }).catch(() => null);
}

const RETENTION_DAYS = 14;

export async function purgeOldApiRequestLogs(): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await prisma.apiRequestLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}

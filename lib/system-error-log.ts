import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SystemErrorLogInput = {
  /** De onde veio, ex.: "POST /api/charts", "auth.jwt-refresh". */
  scope: string;
  error: unknown;
  path?: string | null;
  meta?: Prisma.InputJsonValue;
};

/**
 * Persiste um erro real de servidor em SystemErrorLog (ver /admin/logs, aba "Logs de sistema").
 * Best-effort: se o próprio banco estiver indisponível (ex.: pool esgotado — o cenário que
 * este log existe para capturar), a escrita falha silenciosamente e só sobra o console.error
 * já feito no call site.
 */
export async function logSystemError(input: SystemErrorLogInput): Promise<void> {
  const message = input.error instanceof Error ? input.error.message : String(input.error);
  const stack = input.error instanceof Error ? input.error.stack ?? null : null;
  await prisma.systemErrorLog
    .create({
      data: {
        scope: input.scope,
        message: message.slice(0, 4000),
        stack: stack ? stack.slice(0, 8000) : null,
        path: input.path ?? null,
        meta: input.meta ?? undefined,
      },
    })
    .catch(() => null);
}

const RETENTION_DAYS = 14;

export async function purgeOldSystemErrorLogs(): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await prisma.systemErrorLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}

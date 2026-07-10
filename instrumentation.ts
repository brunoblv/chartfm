// Hook global do Next.js — roda para toda rota Node.js quando uma exceção não
// tratada estoura no handler. Usado para marcar em ApiRequestLog (app/admin/logs)
// que aquela chamada quebrou de verdade (500/crash), complementando o registro
// de "toda chamada aconteceu" feito no middleware (ver middleware.ts).
// Não captura respostas de erro retornadas manualmente (ex: NextResponse.json({}, {status:404}))
// — só exceções que o Next relança.

type RequestErrorContext = {
  routePath?: string;
  routeType?: string;
};

function extractLogId(request: unknown): string | null {
  if (!request || typeof request !== "object") return null;
  const headers = (request as { headers?: unknown }).headers;
  if (!headers) return null;
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get("x-log-id");
  }
  const record = headers as Record<string, string | undefined>;
  return record["x-log-id"] ?? null;
}

export async function register() {
  // nada a inicializar; register() é exigido pelo Next para habilitar o hook abaixo.
}

export async function onRequestError(
  error: unknown,
  request: unknown,
  context: RequestErrorContext,
) {
  if (context.routeType !== "route") return; // só Route Handlers (app/api/**)

  const logId = extractLogId(request);
  if (!logId) return;

  const { recordApiRequestError } = await import("@/lib/api-request-log");
  const message = error instanceof Error ? error.message : String(error);
  await recordApiRequestError(logId, message).catch(() => null);
}

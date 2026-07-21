// Hook global do Next.js — roda para toda rota Node.js quando uma exceção não
// tratada estoura no handler. Usado para marcar em ApiRequestLog (app/admin/logs)
// que aquela chamada quebrou de verdade (500/crash), complementando o registro
// de "toda chamada aconteceu" feito no middleware (ver middleware.ts), e também
// para gravar em SystemErrorLog (aba "Logs de sistema" em /admin/logs).
// Não captura respostas de erro retornadas manualmente (ex: NextResponse.json({}, {status:404}))
// nem exceções pegas em try/catch dentro da própria rota — só exceções que o
// Next relança. Rotas que já fazem seu próprio try/catch chamam logSystemError()
// diretamente (ver lib/system-error-log.ts).

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
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Hosts com AAAA (ex.: musicbrainz.org) fazem o fetch nativo tentar IPv6
    // primeiro; em redes com IPv6 mal configurado (comum em fibra residencial
    // no Brasil) a conexão trava e o fetch quebra com "fetch failed". Força
    // IPv4 via dispatcher global do undici.
    await import("@/lib/force-ipv4-fetch");
    // Liga o resolvedor de "quem pediu" para o log do Spotify (headers do middleware).
    await import("@/lib/api-call-context");
  }
}

export async function onRequestError(
  error: unknown,
  request: unknown,
  context: RequestErrorContext,
) {
  if (context.routeType !== "route") return; // só Route Handlers (app/api/**)

  const { logSystemError } = await import("@/lib/system-error-log");
  await logSystemError({ scope: context.routePath ?? "unknown", error, path: context.routePath ?? null });

  const logId = extractLogId(request);
  if (!logId) return;

  const { recordApiRequestError } = await import("@/lib/api-request-log");
  const message = error instanceof Error ? error.message : String(error);
  await recordApiRequestError(logId, message).catch(() => null);
}

/**
 * Contexto de quem pediu a chamada à API externa (Spotify etc.).
 * Server-only: usa headers do middleware + AsyncLocalStorage opcional.
 * Não importar de componentes client.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { headers } from "next/headers";
import {
  __setApiCallContextResolver,
  __setSpotifyCallCounterInc,
  type ApiCallContext,
} from "@/lib/spotify-usage-log";
import type { ApiTrigger } from "@/lib/api-log-labels";
import { sourceWhoLabel } from "@/lib/api-log-labels";

const storage = new AsyncLocalStorage<ApiCallContext>();
const callCountStorage = new AsyncLocalStorage<{ count: number }>();

__setSpotifyCallCounterInc(() => {
  const box = callCountStorage.getStore();
  if (box) box.count += 1;
});

export function runWithApiCallContext<T>(ctx: ApiCallContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

/** Conta quantas consultas Spotify ocorreram dentro do callback (para auditoria). */
export async function runCountingSpotifyCalls<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; spotifyCalls: number }> {
  const box = { count: 0 };
  const result = await callCountStorage.run(box, fn);
  return { result, spotifyCalls: box.count };
}

function contextFromSource(opts: {
  source: string;
  userName?: string | null;
  userHandle?: string | null;
  path?: string | null;
}): ApiCallContext {
  const trigger: ApiTrigger = opts.source === "system" ? "automatic" : "manual";
  return {
    who: sourceWhoLabel({
      source: opts.source,
      userName: opts.userName,
      userHandle: opts.userHandle,
    }),
    trigger,
    path: opts.path ?? null,
    source: opts.source,
  };
}

async function resolveFromHeaders(): Promise<ApiCallContext | null> {
  try {
    const h = await headers();
    const source = h.get("x-api-source");
    if (!source) return null;
    return contextFromSource({
      source,
      userName: h.get("x-api-user-name"),
      userHandle: h.get("x-api-user-handle"),
      path: h.get("x-api-path"),
    });
  } catch {
    return null;
  }
}

async function resolveContext(): Promise<ApiCallContext | null> {
  const fromAls = storage.getStore();
  if (fromAls) return fromAls;
  return resolveFromHeaders();
}

__setApiCallContextResolver(resolveContext);

export { contextFromSource };

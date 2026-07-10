import type { SocialCredentialPlatform } from "@prisma/client";
import { isTransientRefreshError, sanitizeErrorMessage } from "@/lib/social/credentials/error-sanitizer";
import { socialCredentialService } from "@/lib/social/credentials/social-credential-service";
import type { TokenRefreshResponse } from "@/lib/social/credentials/types";
import { timedFetch } from "@/lib/social/publish/shared";

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1000, 3000, 9000];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function validateRefreshResponse(json: unknown): TokenRefreshResponse {
  if (!json || typeof json !== "object") {
    throw new Error("Resposta de refresh inválida");
  }
  const payload = json as Record<string, unknown>;
  if (typeof payload.access_token !== "string" || !payload.access_token.trim()) {
    throw new Error("Resposta de refresh sem access_token");
  }
  if (typeof payload.expires_in !== "number" || !Number.isFinite(payload.expires_in) || payload.expires_in <= 0) {
    throw new Error("Resposta de refresh sem expires_in válido");
  }
  return {
    access_token: payload.access_token.trim(),
    token_type: typeof payload.token_type === "string" ? payload.token_type : undefined,
    expires_in: payload.expires_in,
  };
}

async function fetchRefresh(url: string, platformLabel: string): Promise<TokenRefreshResponse> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await timedFetch(url);
      if (!res.ok) {
        const apiMessage = res.json?.error?.message ?? res.json?.error?.type ?? `HTTP ${res.status}`;
        throw new Error(`${platformLabel} refresh falhou: ${apiMessage}`);
      }
      return validateRefreshResponse(res.json);
    } catch (err) {
      lastError = err;
      const canRetry = attempt < MAX_ATTEMPTS - 1 && isTransientRefreshError(err);
      if (!canRetry) break;
      await sleep(BACKOFF_MS[attempt] ?? 9000);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(sanitizeErrorMessage(lastError));
}

export async function refreshInstagramToken(): Promise<{ ok: true } | { ok: false; error: string }> {
  const platform: SocialCredentialPlatform = "INSTAGRAM";
  const token = await socialCredentialService.getDecryptedAccessToken(platform);
  if (!token) {
    return { ok: false, error: "Instagram não configurado no banco" };
  }

  const credential = await socialCredentialService.getCredential(platform);
  if (credential?.expiresAt && credential.expiresAt.getTime() < Date.now()) {
    await socialCredentialService.registerRefreshFailure(platform, "Token Instagram expirado — renovação automática bloqueada");
    return { ok: false, error: "Token Instagram expirado" };
  }

  console.log("[SocialTokenRefresh] Instagram refresh started");

  try {
    const url =
      "https://graph.instagram.com/refresh_access_token" +
      `?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`;
    const refreshed = await fetchRefresh(url, "Instagram");
    await socialCredentialService.updateToken(platform, refreshed.access_token, refreshed.expires_in);
    console.log("[SocialTokenRefresh] Instagram refresh completed successfully");
    return { ok: true };
  } catch (err) {
    await socialCredentialService.registerRefreshFailure(platform, err);
    const message = sanitizeErrorMessage(err);
    console.error(`[SocialTokenRefresh] Instagram refresh failed: ${message}`);
    return { ok: false, error: message };
  }
}

export async function refreshThreadsToken(): Promise<{ ok: true } | { ok: false; error: string }> {
  const platform: SocialCredentialPlatform = "THREADS";
  const token = await socialCredentialService.getDecryptedAccessToken(platform);
  if (!token) {
    return { ok: false, error: "Threads não configurado no banco" };
  }

  const credential = await socialCredentialService.getCredential(platform);
  if (credential?.expiresAt && credential.expiresAt.getTime() < Date.now()) {
    await socialCredentialService.registerRefreshFailure(platform, "Token Threads expirado — renovação automática bloqueada");
    return { ok: false, error: "Token Threads expirado" };
  }

  console.log("[SocialTokenRefresh] Threads refresh started");

  try {
    const url =
      "https://graph.threads.net/refresh_access_token" +
      `?grant_type=th_refresh_token&access_token=${encodeURIComponent(token)}`;
    const refreshed = await fetchRefresh(url, "Threads");
    await socialCredentialService.updateToken(platform, refreshed.access_token, refreshed.expires_in);
    console.log("[SocialTokenRefresh] Threads refresh completed successfully");
    return { ok: true };
  } catch (err) {
    await socialCredentialService.registerRefreshFailure(platform, err);
    const message = sanitizeErrorMessage(err);
    console.error(`[SocialTokenRefresh] Threads refresh failed: ${message}`);
    return { ok: false, error: message };
  }
}

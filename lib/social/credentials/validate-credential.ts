import type { SocialCredentialPlatform } from "@prisma/client";
import { sanitizeErrorMessage } from "@/lib/social/credentials/error-sanitizer";
import { socialCredentialService } from "@/lib/social/credentials/social-credential-service";
import { resolveSocialAccessToken, resolveSocialAccountId } from "@/lib/social/credentials/token-resolver";
import { timedFetch } from "@/lib/social/publish/shared";

export async function validateCredential(platform: SocialCredentialPlatform): Promise<{ ok: boolean; error?: string }> {
  const token = await resolveSocialAccessToken(platform);
  const accountId = await resolveSocialAccountId(platform);

  if (!token || !accountId) {
    return { ok: false, error: "Credencial não configurada" };
  }

  try {
    if (platform === "FACEBOOK") {
      const res = await timedFetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(accountId)}?fields=id&access_token=${encodeURIComponent(token)}`,
      );
      if (!res.ok) {
        const message = res.json?.error?.message ?? `HTTP ${res.status}`;
        await socialCredentialService.registerRefreshFailure(platform, message);
        return { ok: false, error: sanitizeErrorMessage(message) };
      }
    } else if (platform === "INSTAGRAM") {
      const res = await timedFetch(
        `https://graph.instagram.com/v21.0/me?fields=id,username&access_token=${encodeURIComponent(token)}`,
      );
      if (!res.ok) {
        const message = res.json?.error?.message ?? `HTTP ${res.status}`;
        await socialCredentialService.registerRefreshFailure(platform, message);
        return { ok: false, error: sanitizeErrorMessage(message) };
      }
    } else if (platform === "THREADS") {
      const res = await timedFetch(
        `https://graph.threads.net/v1.0/me?fields=id,username&access_token=${encodeURIComponent(token)}`,
      );
      if (!res.ok) {
        const message = res.json?.error?.message ?? `HTTP ${res.status}`;
        await socialCredentialService.registerRefreshFailure(platform, message);
        return { ok: false, error: sanitizeErrorMessage(message) };
      }
    } else if (platform === "TELEGRAM") {
      const res = await timedFetch(`https://api.telegram.org/bot${token}/getMe`);
      if (!res.ok || !res.json?.ok) {
        const message = res.json?.description ?? `HTTP ${res.status}`;
        await socialCredentialService.registerRefreshFailure(platform, message);
        return { ok: false, error: sanitizeErrorMessage(message) };
      }
    }

    await socialCredentialService.markChecked(platform);
    return { ok: true };
  } catch (err) {
    const message = sanitizeErrorMessage(err);
    await socialCredentialService.registerRefreshFailure(platform, message);
    return { ok: false, error: message };
  }
}

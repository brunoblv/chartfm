import type { SocialCredentialPlatform } from "@prisma/client";
import { socialCredentialService } from "@/lib/social/credentials/social-credential-service";
import { refreshInstagramToken, refreshThreadsToken } from "@/lib/social/credentials/platform-refresh";
import { REFRESHABLE_PLATFORMS } from "@/lib/social/credentials/types";
import { daysUntilExpiry } from "@/lib/social/credentials/social-credential-service";

export type RefreshCandidate = {
  platform: SocialCredentialPlatform;
  daysUntilExpiry: number | null;
};

export type RefreshPlatformResult = {
  platform: SocialCredentialPlatform;
  ok: boolean;
  error?: string;
  skipped?: boolean;
  reason?: string;
};

export class SocialTokenRefreshService {
  async getRefreshCandidates(now = new Date()): Promise<RefreshCandidate[]> {
    const candidates: RefreshCandidate[] = [];

    for (const platform of REFRESHABLE_PLATFORMS) {
      const credential = await socialCredentialService.getCredential(platform);
      if (!credential?.refreshEnabled) continue;

      const days = credential.expiresAt ? daysUntilExpiry(credential.expiresAt, now) : null;
      if (days !== null && days < 0) {
        console.error(`[SocialTokenRefresh] ${platform} token expirado — renovação automática bloqueada`);
        await socialCredentialService.registerRefreshFailure(platform, "Token expirado — reautenticação manual necessária");
        continue;
      }

      if (!credential.expiresAt) {
        console.error(`[SocialTokenRefresh] ${platform} sem expiresAt — configuração necessária`);
        await socialCredentialService.registerRefreshFailure(platform, "expiresAt ausente — configure a data de expiração");
        continue;
      }

      if (await socialCredentialService.shouldRefresh(platform, now)) {
        candidates.push({ platform, daysUntilExpiry: days });
      }
    }

    return candidates;
  }

  async refreshPlatform(platform: SocialCredentialPlatform, options?: { force?: boolean }): Promise<RefreshPlatformResult> {
    if (!REFRESHABLE_PLATFORMS.includes(platform)) {
      return { platform, ok: false, skipped: true, reason: "Plataforma sem refresh automático" };
    }

    console.log(`[SocialTokenRefresh] Checking ${platform} credential`);
    const credential = await socialCredentialService.getCredential(platform);
    if (!credential) {
      return { platform, ok: false, error: "Credencial não encontrada no banco" };
    }

    const days = credential.expiresAt ? daysUntilExpiry(credential.expiresAt) : null;
    if (days !== null) {
      console.log(`[SocialTokenRefresh] ${platform} token expires in ${days} days`);
    }

    if (!options?.force && !(await socialCredentialService.shouldRefresh(platform))) {
      return { platform, ok: true, skipped: true, reason: "Renovação não necessária" };
    }

    if (platform === "INSTAGRAM") {
      const result = await refreshInstagramToken();
      return result.ok ? { platform, ok: true } : { platform, ok: false, error: result.error };
    }

    const result = await refreshThreadsToken();
    return result.ok ? { platform, ok: true } : { platform, ok: false, error: result.error };
  }

  async refreshDueTokens(): Promise<RefreshPlatformResult[]> {
    const candidates = await this.getRefreshCandidates();
    const results: RefreshPlatformResult[] = [];

    for (const candidate of candidates) {
      results.push(await this.refreshPlatform(candidate.platform));
    }

    return results;
  }
}

export const socialTokenRefreshService = new SocialTokenRefreshService();

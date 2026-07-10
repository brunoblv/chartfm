import type { SocialCredential, SocialCredentialPlatform } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken, hasEncryptionKey } from "@/lib/social/credentials/encryption";
import { sanitizeErrorMessage } from "@/lib/social/credentials/error-sanitizer";
import type { IntegrationStatus, SafeIntegrationStatus } from "@/lib/social/credentials/types";
import { REFRESHABLE_PLATFORMS } from "@/lib/social/credentials/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getRefreshThresholdDays(): number {
  const raw = process.env.SOCIAL_TOKEN_REFRESH_THRESHOLD_DAYS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : 30;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

export function daysUntilExpiry(expiresAt: Date | null | undefined, now = new Date()): number | null {
  if (!expiresAt) return null;
  return Math.ceil((expiresAt.getTime() - now.getTime()) / MS_PER_DAY);
}

export function computeExpiresAt(expiresInSeconds: number, now = new Date()): Date {
  return new Date(now.getTime() + expiresInSeconds * 1000);
}

export function deriveIntegrationStatus(
  credential: SocialCredential | null,
  configured: boolean,
  now = new Date(),
): IntegrationStatus {
  if (!configured) return "NOT_CONFIGURED";
  if (!credential) return "NOT_CONFIGURED";

  if (credential.lastError && credential.refreshFailures > 0) {
    return "ERROR";
  }

  if (!credential.expiresAt) {
    return credential.refreshEnabled ? "REFRESH_DUE" : "HEALTHY";
  }

  const days = daysUntilExpiry(credential.expiresAt, now);
  if (days === null) return "NOT_CONFIGURED";
  if (days < 0) return "EXPIRED";

  const threshold = getRefreshThresholdDays();
  if (days <= threshold) return "REFRESH_DUE";
  if (days <= threshold + 7) return "EXPIRING_SOON";
  return "HEALTHY";
}

export function shouldRefreshByExpiration(
  expiresAt: Date | null | undefined,
  refreshEnabled: boolean,
  now = new Date(),
): boolean {
  if (!refreshEnabled || !expiresAt) return false;
  const days = daysUntilExpiry(expiresAt, now);
  if (days === null || days < 0) return false;
  return days <= getRefreshThresholdDays();
}

export class SocialCredentialService {
  async getCredential(platform: SocialCredentialPlatform): Promise<SocialCredential | null> {
    return prisma.socialCredential.findUnique({ where: { platform } });
  }

  async getDecryptedAccessToken(platform: SocialCredentialPlatform): Promise<string | null> {
    const credential = await this.getCredential(platform);
    if (!credential?.accessToken) return null;
    if (!hasEncryptionKey()) return null;
    return decryptToken(credential.accessToken);
  }

  async upsertCredential(input: {
    platform: SocialCredentialPlatform;
    accessToken: string;
    accountId?: string | null;
    accountUsername?: string | null;
    expiresAt?: Date | null;
    refreshEnabled?: boolean;
  }): Promise<SocialCredential> {
    if (!hasEncryptionKey()) {
      throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY não configurada");
    }

    const encrypted = encryptToken(input.accessToken);
    return prisma.socialCredential.upsert({
      where: { platform: input.platform },
      create: {
        platform: input.platform,
        accessToken: encrypted,
        accountId: input.accountId ?? null,
        accountUsername: input.accountUsername ?? null,
        expiresAt: input.expiresAt ?? null,
        refreshEnabled: input.refreshEnabled ?? REFRESHABLE_PLATFORMS.includes(input.platform),
        lastCheckedAt: new Date(),
      },
      update: {
        accessToken: encrypted,
        ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
        ...(input.accountUsername !== undefined ? { accountUsername: input.accountUsername } : {}),
        ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
        ...(input.refreshEnabled !== undefined ? { refreshEnabled: input.refreshEnabled } : {}),
        lastCheckedAt: new Date(),
      },
    });
  }

  async updateToken(platform: SocialCredentialPlatform, newToken: string, expiresIn: number): Promise<SocialCredential> {
    if (!hasEncryptionKey()) {
      throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY não configurada");
    }

    const encrypted = encryptToken(newToken);
    const expiresAt = computeExpiresAt(expiresIn);

    return prisma.socialCredential.update({
      where: { platform },
      data: {
        accessToken: encrypted,
        expiresAt,
        lastRefreshedAt: new Date(),
        lastCheckedAt: new Date(),
        refreshFailures: 0,
        lastError: null,
        lastErrorAt: null,
      },
    });
  }

  async updateExpiration(platform: SocialCredentialPlatform, expiresIn: number): Promise<SocialCredential> {
    return prisma.socialCredential.update({
      where: { platform },
      data: {
        expiresAt: computeExpiresAt(expiresIn),
        lastCheckedAt: new Date(),
      },
    });
  }

  async registerRefreshSuccess(platform: SocialCredentialPlatform): Promise<SocialCredential> {
    return prisma.socialCredential.update({
      where: { platform },
      data: {
        lastRefreshedAt: new Date(),
        lastCheckedAt: new Date(),
        refreshFailures: 0,
        lastError: null,
        lastErrorAt: null,
      },
    });
  }

  async registerRefreshFailure(platform: SocialCredentialPlatform, error: unknown): Promise<SocialCredential> {
    const sanitized = sanitizeErrorMessage(error);
    return prisma.socialCredential.update({
      where: { platform },
      data: {
        lastCheckedAt: new Date(),
        refreshFailures: { increment: 1 },
        lastError: sanitized,
        lastErrorAt: new Date(),
      },
    });
  }

  async markChecked(platform: SocialCredentialPlatform): Promise<void> {
    await prisma.socialCredential.update({
      where: { platform },
      data: { lastCheckedAt: new Date() },
    });
  }

  async shouldRefresh(platform: SocialCredentialPlatform, now = new Date()): Promise<boolean> {
    if (!REFRESHABLE_PLATFORMS.includes(platform)) return false;

    const credential = await this.getCredential(platform);
    if (!credential) return false;
    return shouldRefreshByExpiration(credential.expiresAt, credential.refreshEnabled, now);
  }

  async validateCredential(platform: SocialCredentialPlatform) {
    const { validateCredential } = await import("@/lib/social/credentials/validate-credential");
    return validateCredential(platform);
  }

  async getIntegrationStatus(): Promise<SafeIntegrationStatus[]> {
    const platforms: SocialCredentialPlatform[] = ["FACEBOOK", "INSTAGRAM", "THREADS", "TELEGRAM"];
    const { isSocialPlatformConfigured } = await import("@/lib/social/credentials/token-resolver");

    const results: SafeIntegrationStatus[] = [];
    for (const platform of platforms) {
      const configured = await isSocialPlatformConfigured(platform);
      const credential = configured ? await this.getCredential(platform) : null;
      const status = deriveIntegrationStatus(credential, configured);
      const days = credential?.expiresAt ? daysUntilExpiry(credential.expiresAt) : null;

      results.push({
        platform,
        status,
        accountId: credential?.accountId ?? null,
        accountUsername: credential?.accountUsername ?? null,
        expiresAt: credential?.expiresAt?.toISOString() ?? null,
        daysUntilExpiry: days,
        lastRefreshedAt: credential?.lastRefreshedAt?.toISOString() ?? null,
        lastCheckedAt: credential?.lastCheckedAt?.toISOString() ?? null,
        refreshEnabled: credential?.refreshEnabled ?? false,
        refreshFailures: credential?.refreshFailures ?? 0,
        lastError: credential?.lastError ?? null,
        lastErrorAt: credential?.lastErrorAt?.toISOString() ?? null,
        configured,
      });
    }

    return results;
  }
}

export const socialCredentialService = new SocialCredentialService();

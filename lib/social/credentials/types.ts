import type { SocialCredentialPlatform } from "@prisma/client";

export type IntegrationStatus =
  | "HEALTHY"
  | "REFRESH_DUE"
  | "EXPIRING_SOON"
  | "EXPIRED"
  | "ERROR"
  | "NOT_CONFIGURED";

export type SafeIntegrationStatus = {
  platform: SocialCredentialPlatform;
  status: IntegrationStatus;
  accountId: string | null;
  accountUsername: string | null;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  lastRefreshedAt: string | null;
  lastCheckedAt: string | null;
  refreshEnabled: boolean;
  refreshFailures: number;
  lastError: string | null;
  lastErrorAt: string | null;
  configured: boolean;
};

export type TokenRefreshResponse = {
  access_token: string;
  token_type?: string;
  expires_in: number;
};

export const REFRESHABLE_PLATFORMS: SocialCredentialPlatform[] = ["INSTAGRAM", "THREADS"];

import type { SocialCredentialPlatform } from "@prisma/client";
import { socialCredentialService } from "@/lib/social/credentials/social-credential-service";
import { hasEncryptionKey } from "@/lib/social/credentials/encryption";

type EnvMapping = {
  tokenKeys: string[];
  accountIdKeys: string[];
};

const ENV_BY_PLATFORM: Record<SocialCredentialPlatform, EnvMapping> = {
  FACEBOOK: {
    tokenKeys: ["FACEBOOK_PAGE_ACCESS_TOKEN", "FACEBOOK_SYSTEM_USER_TOKEN"],
    accountIdKeys: ["FACEBOOK_PAGE_ID"],
  },
  INSTAGRAM: {
    tokenKeys: ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_INITIAL_ACCESS_TOKEN"],
    accountIdKeys: ["INSTAGRAM_BUSINESS_ACCOUNT_ID", "INSTAGRAM_ACCOUNT_ID"],
  },
  THREADS: {
    tokenKeys: ["THREADS_ACCESS_TOKEN", "THREADS_INITIAL_ACCESS_TOKEN"],
    accountIdKeys: ["THREADS_USER_ID", "THREADS_ACCOUNT_ID"],
  },
  TELEGRAM: {
    tokenKeys: ["TELEGRAM_BOT_TOKEN"],
    accountIdKeys: ["TELEGRAM_CHAT_ID"],
  },
};

function readEnv(keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

export function readEnvAccessToken(platform: SocialCredentialPlatform): string | null {
  return readEnv(ENV_BY_PLATFORM[platform].tokenKeys);
}

export function readEnvAccountId(platform: SocialCredentialPlatform): string | null {
  return readEnv(ENV_BY_PLATFORM[platform].accountIdKeys);
}

export function isSocialPlatformConfiguredFromEnv(platform: SocialCredentialPlatform): boolean {
  return Boolean(readEnvAccessToken(platform) && readEnvAccountId(platform));
}

export async function isSocialPlatformConfigured(platform: SocialCredentialPlatform): Promise<boolean> {
  const token = await resolveSocialAccessToken(platform);
  const accountId = await resolveSocialAccountId(platform);
  return Boolean(token && accountId);
}

export async function resolveSocialAccessToken(platform: SocialCredentialPlatform): Promise<string | null> {
  if (hasEncryptionKey()) {
    const fromDb = await socialCredentialService.getDecryptedAccessToken(platform);
    if (fromDb) return fromDb;
  }
  return readEnvAccessToken(platform);
}

export async function resolveSocialAccountId(platform: SocialCredentialPlatform): Promise<string | null> {
  const credential = await socialCredentialService.getCredential(platform);
  if (credential?.accountId) return credential.accountId;
  return readEnvAccountId(platform);
}

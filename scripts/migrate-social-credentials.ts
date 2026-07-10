/**
 * Migra credenciais sociais do .env para social_credentials (criptografadas).
 *
 * Uso:
 *   npx tsx scripts/migrate-social-credentials.ts
 *
 * Requer SOCIAL_TOKEN_ENCRYPTION_KEY no ambiente.
 * Não inclui tokens reais — leia do .env local ou variáveis de deploy.
 */
import type { SocialCredentialPlatform } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { hasEncryptionKey } from "../lib/social/credentials/encryption";
import { socialCredentialService } from "../lib/social/credentials/social-credential-service";
import { readEnvAccessToken, readEnvAccountId } from "../lib/social/credentials/token-resolver";

const DEFAULT_LONG_LIVED_DAYS = 60;

type PlatformSeed = {
  platform: SocialCredentialPlatform;
  refreshEnabled: boolean;
  expiresAtEnvKeys: string[];
  defaultExpiresInDays?: number;
};

const PLATFORMS: PlatformSeed[] = [
  {
    platform: "FACEBOOK",
    refreshEnabled: false,
    expiresAtEnvKeys: ["FACEBOOK_TOKEN_EXPIRES_AT"],
  },
  {
    platform: "INSTAGRAM",
    refreshEnabled: true,
    expiresAtEnvKeys: ["INSTAGRAM_TOKEN_EXPIRES_AT"],
    defaultExpiresInDays: DEFAULT_LONG_LIVED_DAYS,
  },
  {
    platform: "THREADS",
    refreshEnabled: true,
    expiresAtEnvKeys: ["THREADS_TOKEN_EXPIRES_AT"],
    defaultExpiresInDays: DEFAULT_LONG_LIVED_DAYS,
  },
  {
    platform: "TELEGRAM",
    refreshEnabled: false,
    expiresAtEnvKeys: [],
  },
];

function readExpiresAt(keys: string[], defaultExpiresInDays?: number): Date | null {
  for (const key of keys) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  if (defaultExpiresInDays && defaultExpiresInDays > 0) {
    return new Date(Date.now() + defaultExpiresInDays * 24 * 60 * 60 * 1000);
  }

  return null;
}

async function main() {
  if (!hasEncryptionKey()) {
    console.error("SOCIAL_TOKEN_ENCRYPTION_KEY não configurada.");
    process.exit(1);
  }

  let migrated = 0;
  let skipped = 0;

  for (const item of PLATFORMS) {
    const token = readEnvAccessToken(item.platform);
    const accountId = readEnvAccountId(item.platform);

    if (!token) {
      console.log(`[migrate] ${item.platform}: sem token no ENV — ignorado`);
      skipped++;
      continue;
    }

    const expiresAt = readExpiresAt(item.expiresAtEnvKeys, item.defaultExpiresInDays);

    await socialCredentialService.upsertCredential({
      platform: item.platform,
      accessToken: token,
      accountId,
      expiresAt,
      refreshEnabled: item.refreshEnabled,
    });

    console.log(`[migrate] ${item.platform}: credencial gravada com sucesso`);
    migrated++;
  }

  console.log(`[migrate] concluído — ${migrated} migradas, ${skipped} ignoradas`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[migrate] falhou", err);
  process.exit(1);
});

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { SocialCredential } from "@prisma/client";
import {
  computeExpiresAt,
  daysUntilExpiry,
  deriveIntegrationStatus,
  getRefreshThresholdDays,
  shouldRefreshByExpiration,
} from "@/lib/social/credentials/social-credential-service";
import { sanitizeErrorMessage } from "@/lib/social/credentials/error-sanitizer";
import { validateRefreshResponse } from "@/lib/social/credentials/platform-refresh";

const NOW = new Date("2026-07-10T12:00:00.000Z");

function makeCredential(overrides: Partial<SocialCredential> = {}): SocialCredential {
  return {
    id: 1,
    platform: "INSTAGRAM",
    accessToken: "encrypted",
    accountId: "123",
    accountUsername: null,
    expiresAt: new Date("2026-08-09T12:00:00.000Z"),
    lastRefreshedAt: null,
    lastCheckedAt: null,
    refreshEnabled: true,
    refreshFailures: 0,
    lastError: null,
    lastErrorAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("social credential helpers", () => {
  beforeEach(() => {
    vi.stubEnv("SOCIAL_TOKEN_REFRESH_THRESHOLD_DAYS", "30");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("calcula expiresAt a partir de expires_in", () => {
    const expiresAt = computeExpiresAt(3600, NOW);
    expect(expiresAt.toISOString()).toBe("2026-07-10T13:00:00.000Z");
  });

  it("shouldRefresh retorna false com mais de 30 dias", () => {
    const expiresAt = new Date("2026-09-15T12:00:00.000Z");
    expect(shouldRefreshByExpiration(expiresAt, true, NOW)).toBe(false);
    expect(daysUntilExpiry(expiresAt, NOW)).toBeGreaterThan(30);
  });

  it("shouldRefresh retorna true com exatamente 30 dias", () => {
    const expiresAt = new Date("2026-08-09T12:00:00.000Z");
    expect(daysUntilExpiry(expiresAt, NOW)).toBe(30);
    expect(shouldRefreshByExpiration(expiresAt, true, NOW)).toBe(true);
  });

  it("shouldRefresh retorna true próximo da expiração", () => {
    const expiresAt = new Date("2026-07-15T12:00:00.000Z");
    expect(shouldRefreshByExpiration(expiresAt, true, NOW)).toBe(true);
    expect(deriveIntegrationStatus(makeCredential({ expiresAt }), true, NOW)).toBe("REFRESH_DUE");
  });

  it("marca expirado e não renova automaticamente", () => {
    const expiresAt = new Date("2026-07-09T12:00:00.000Z");
    expect(shouldRefreshByExpiration(expiresAt, true, NOW)).toBe(false);
    expect(deriveIntegrationStatus(makeCredential({ expiresAt }), true, NOW)).toBe("EXPIRED");
  });

  it("usa threshold configurável", () => {
    vi.stubEnv("SOCIAL_TOKEN_REFRESH_THRESHOLD_DAYS", "14");
    expect(getRefreshThresholdDays()).toBe(14);
    const expiresAt = new Date("2026-07-20T12:00:00.000Z");
    expect(shouldRefreshByExpiration(expiresAt, true, NOW)).toBe(true);
  });
});

describe("validateRefreshResponse", () => {
  it("aceita resposta válida", () => {
    const parsed = validateRefreshResponse({
      access_token: "new-token",
      token_type: "bearer",
      expires_in: 5184000,
    });
    expect(parsed.access_token).toBe("new-token");
    expect(parsed.expires_in).toBe(5184000);
  });

  it("rejeita resposta sem access_token", () => {
    expect(() => validateRefreshResponse({ expires_in: 100 })).toThrow(/access_token/);
  });

  it("rejeita resposta sem expires_in válido", () => {
    expect(() => validateRefreshResponse({ access_token: "x" })).toThrow(/expires_in/);
  });
});

describe("sanitizeErrorMessage", () => {
  it("remove tokens de URLs e mensagens", () => {
    const sanitized = sanitizeErrorMessage("falhou em https://api.test?access_token=IGAAsecret123");
    expect(sanitized).not.toContain("IGAAsecret123");
    expect(sanitized).toContain("[REDACTED]");
  });
});

describe("integration status", () => {
  it("não inclui token no objeto de status derivado", () => {
    const status = deriveIntegrationStatus(makeCredential(), true, NOW);
    expect(status).toBe("REFRESH_DUE");
    const serialized = JSON.stringify(makeCredential());
    expect(serialized).not.toContain("IGAA");
    expect(serialized).toContain("encrypted");
  });
});

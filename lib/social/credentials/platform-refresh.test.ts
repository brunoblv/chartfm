import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { socialCredentialService } from "@/lib/social/credentials/social-credential-service";
import { refreshInstagramToken, refreshThreadsToken } from "@/lib/social/credentials/platform-refresh";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    socialCredential: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/social/credentials/social-credential-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/social/credentials/social-credential-service")>();
  return {
    ...actual,
    socialCredentialService: {
      getDecryptedAccessToken: vi.fn(),
      getCredential: vi.fn(),
      updateToken: vi.fn(),
      registerRefreshFailure: vi.fn(),
    },
  };
});

vi.mock("@/lib/social/publish/shared", () => ({
  timedFetch: vi.fn(),
}));

import { timedFetch } from "@/lib/social/publish/shared";

describe("platform refresh", () => {
  beforeEach(() => {
    vi.stubEnv("SOCIAL_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 1).toString("base64"));
    vi.mocked(socialCredentialService.getDecryptedAccessToken).mockResolvedValue("current-token");
    vi.mocked(socialCredentialService.getCredential).mockResolvedValue({
      id: 1,
      platform: "INSTAGRAM",
      accessToken: "encrypted",
      accountId: "1",
      accountUsername: null,
      expiresAt: new Date("2026-08-09T12:00:00.000Z"),
      lastRefreshedAt: null,
      lastCheckedAt: null,
      refreshEnabled: true,
      refreshFailures: 0,
      lastError: null,
      lastErrorAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(socialCredentialService.updateToken).mockResolvedValue({} as any);
    vi.mocked(socialCredentialService.registerRefreshFailure).mockResolvedValue({} as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("refresh Instagram com sucesso grava novo token após resposta válida", async () => {
    vi.mocked(timedFetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: { access_token: "new-ig-token", expires_in: 5184000 },
    });

    const result = await refreshInstagramToken();
    expect(result.ok).toBe(true);
    expect(socialCredentialService.updateToken).toHaveBeenCalledWith("INSTAGRAM", "new-ig-token", 5184000);
  });

  it("refresh Threads com sucesso", async () => {
    vi.mocked(socialCredentialService.getDecryptedAccessToken).mockResolvedValue("threads-token");
    vi.mocked(socialCredentialService.getCredential).mockResolvedValue({
      id: 2,
      platform: "THREADS",
      accessToken: "encrypted",
      accountId: "1",
      accountUsername: null,
      expiresAt: new Date("2026-08-09T12:00:00.000Z"),
      lastRefreshedAt: null,
      lastCheckedAt: null,
      refreshEnabled: true,
      refreshFailures: 0,
      lastError: null,
      lastErrorAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(timedFetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: { access_token: "new-th-token", expires_in: 5184000 },
    });

    const result = await refreshThreadsToken();
    expect(result.ok).toBe(true);
    expect(socialCredentialService.updateToken).toHaveBeenCalledWith("THREADS", "new-th-token", 5184000);
  });

  it("preserva token anterior em falha da API", async () => {
    vi.mocked(timedFetch).mockResolvedValue({
      ok: false,
      status: 400,
      json: { error: { message: "OAuthException code 452", type: "OAuthException" } },
    });

    const result = await refreshInstagramToken();
    expect(result.ok).toBe(false);
    expect(socialCredentialService.updateToken).not.toHaveBeenCalled();
    expect(socialCredentialService.registerRefreshFailure).toHaveBeenCalled();
  });

  it("não grava token quando resposta não tem access_token", async () => {
    vi.mocked(timedFetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: { expires_in: 100 },
    });

    const result = await refreshInstagramToken();
    expect(result.ok).toBe(false);
    expect(socialCredentialService.updateToken).not.toHaveBeenCalled();
  });
});

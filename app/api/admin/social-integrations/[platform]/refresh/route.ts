import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { socialTokenRefreshService } from "@/lib/social/credentials/social-token-refresh-service";
import type { SocialCredentialPlatform } from "@prisma/client";
import { REFRESHABLE_PLATFORMS } from "@/lib/social/credentials/types";

const PLATFORM_ALIASES: Record<string, SocialCredentialPlatform> = {
  facebook: "FACEBOOK",
  instagram: "INSTAGRAM",
  threads: "THREADS",
  telegram: "TELEGRAM",
};

export async function POST(_req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { platform: rawPlatform } = await params;
  const platform = PLATFORM_ALIASES[rawPlatform.toLowerCase()] ?? (rawPlatform.toUpperCase() as SocialCredentialPlatform);

  if (!REFRESHABLE_PLATFORMS.includes(platform)) {
    return NextResponse.json(
      { ok: false, error: "Refresh manual disponível apenas para Instagram e Threads" },
      { status: 400 },
    );
  }

  const result = await socialTokenRefreshService.refreshPlatform(platform, { force: true });
  return NextResponse.json({ ok: result.ok, result });
}

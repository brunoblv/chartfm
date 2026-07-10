import { NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { socialCredentialService } from "@/lib/social/credentials/social-credential-service";

export async function GET() {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const integrations = await socialCredentialService.getIntegrationStatus();
  return NextResponse.json({ ok: true, integrations });
}

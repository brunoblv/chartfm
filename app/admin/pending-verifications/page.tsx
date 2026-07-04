import { Shell } from "@/components/layout/Shell";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { PendingVerificationsClient } from "./pending-verifications-client";

export const dynamic = "force-dynamic";

export default async function AdminPendingVerificationsPage() {
  const auth = await requirePrivilegedSession();
  if (!auth) {
    return (
      <Shell title="Admin" subtitle="Acesso">
        <div>Acesso negado.</div>
      </Shell>
    );
  }

  return (
    <Shell title="Admin" subtitle="Confirmações de email pendentes">
      <PendingVerificationsClient />
    </Shell>
  );
}

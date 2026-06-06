import { Shell } from "@/components/layout/Shell";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { getWeeklyReleaseAdminData } from "@/lib/weekly-releases";
import { LancamentosAdminClient } from "./LancamentosAdminClient";

export default async function AdminLancamentosPage() {
  const auth = await requirePrivilegedSession();
  if (!auth) {
    return (
      <Shell title="Admin" subtitle="Lançamentos da Semana">
        <div style={{ color: "var(--text-muted)" }}>Acesso negado. Apenas ADMIN e DEV.</div>
      </Shell>
    );
  }

  const releases = await getWeeklyReleaseAdminData();

  return (
    <Shell title="Lançamentos da Semana" subtitle="Curadoria semanal de lançamentos">
      <LancamentosAdminClient initialReleases={releases} />
    </Shell>
  );
}

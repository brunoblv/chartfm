import { Shell } from "@/components/layout/Shell";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import CrownnoteExportClient from "./CrownnoteExportClient";

export const dynamic = "force-dynamic";

export default async function CrownnoteExportPage() {
  const auth = await requirePrivilegedSession();
  if (!auth) {
    return (
      <Shell title="Admin" subtitle="Exportar Crownnote">
        <div style={{ color: "var(--text-muted)" }}>Acesso negado. Apenas ADMIN e DEV.</div>
      </Shell>
    );
  }

  return (
    <Shell
      title="Exportar Crownnote"
      subtitle="Extrai paradas do Crownnote e corresponde ao catálogo ChartFM"
    >
      <CrownnoteExportClient />
    </Shell>
  );
}

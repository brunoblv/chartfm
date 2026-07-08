import { Shell } from "@/components/layout/Shell";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { getReleaseRadarAdminData } from "@/lib/release-radar";
import { RadarLancamentosClient } from "./RadarLancamentosClient";

export default async function AdminRadarLancamentosPage() {
  const auth = await requirePrivilegedSession();
  if (!auth) {
    return (
      <Shell title="Admin" subtitle="Radar de Lançamentos">
        <div style={{ color: "var(--text-muted)" }}>Acesso negado. Apenas ADMIN e DEV.</div>
      </Shell>
    );
  }

  const data = await getReleaseRadarAdminData();

  return (
    <Shell title="Radar de Lançamentos" subtitle="Artistas monitorados no Spotify — avisos automáticos no Telegram">
      <RadarLancamentosClient initialData={data} />
    </Shell>
  );
}

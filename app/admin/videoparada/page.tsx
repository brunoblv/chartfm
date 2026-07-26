import { requirePrivilegedSession } from "@/lib/admin-auth";
import { Shell } from "@/components/layout/Shell";
import { isVideoparadaModuleEnabled } from "@/lib/videoparada-dev-only";
import {
  listVideoparadaCharts,
  listVideoparadaWeeks,
  resolveDefaultVideoparadaWeek,
} from "@/lib/videoparada";
import VideoparadaAdminClient from "./VideoparadaAdminClient";

export const dynamic = "force-dynamic";

export default async function VideoparadaAdminPage() {
  const auth = await requirePrivilegedSession();
  if (!auth) {
    return (
      <Shell title="Admin" subtitle="Acesso">
        <div>Acesso negado. Apenas ADMIN e DEV.</div>
      </Shell>
    );
  }
  if (!isVideoparadaModuleEnabled()) {
    return (
      <Shell title="Vídeos das Paradas" subtitle="Indisponível">
        <div>Este módulo fica disponível apenas em ambiente de desenvolvimento (desligado em produção por consumo de memória na VPS).</div>
      </Shell>
    );
  }

  const charts = listVideoparadaCharts();
  const defaultKind = "global";
  const weeks = await listVideoparadaWeeks(defaultKind);
  const defaultWeek = (await resolveDefaultVideoparadaWeek(defaultKind)) ?? weeks[0]?.weekIndex ?? null;

  return (
    <Shell title="Vídeos das Paradas" subtitle="Configuração de clipes para geração automática (Remotion)">
      <VideoparadaAdminClient
        initialCharts={charts}
        initialChartKind={defaultKind}
        initialWeeks={weeks}
        initialWeekIndex={defaultWeek}
      />
    </Shell>
  );
}

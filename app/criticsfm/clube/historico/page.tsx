import { Shell } from "@/components/layout/Shell";
import { getClubeHistorico, getClubeHistoricoStats } from "@/lib/clube-album";
import { ClubeHistorico } from "../../ClubeHistorico";

export const revalidate = 60;

export default async function ClubeHistoricoPage() {
  const [rounds, stats] = await Promise.all([getClubeHistorico(), getClubeHistoricoStats()]);

  return (
    <Shell title="">
      <ClubeHistorico rounds={rounds} stats={stats} />
    </Shell>
  );
}

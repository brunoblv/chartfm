import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { prisma } from "@/lib/prisma";
import RankingClient from "./RankingClient";
import { PushNav } from "../PushNav";

export const revalidate = 60;

async function getSeasons(): Promise<number[]> {
  const rounds = await prisma.pushRound.findMany({
    where: { phase: "RESULT" },
    select: { season: true },
    distinct: ["season"],
    orderBy: { season: "asc" },
  });
  return rounds.map((r) => r.season);
}

export default async function PushRankingPage() {
  const seasons = await getSeasons();

  return (
    <Shell
      title="Push · Ranking"
      subtitle="Pontuação acumulada por temporada e geral"
      headerRight={
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link href="/push/historico" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none" }}>
            Histórico
          </Link>
          <Link href="/push" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none" }}>
            ← Rodada atual
          </Link>
        </div>
      }
    >
      <div style={{ maxWidth: 560, marginBottom: 24 }}>
        <PushNav />
      </div>
      <div style={{ maxWidth: 560 }}>
        <RankingClient seasons={seasons} />
      </div>
    </Shell>
  );
}

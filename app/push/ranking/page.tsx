import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { prisma } from "@/lib/prisma";
import RankingClient from "./RankingClient";
import { PushNav } from "../PushNav";
import { getServerTranslations } from "@/lib/i18n/server-translations";

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
  const { t } = await getServerTranslations();
  const seasons = await getSeasons();

  return (
    <Shell
      title={t("push.rankingTitle")}
      subtitle={t("push.rankingSubtitle")}
      headerRight={
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link href="/push/historico" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none" }}>
            {t("push.rankingHistoricoLink")}
          </Link>
          <Link href="/push" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none" }}>
            {t("push.backToCurrentRound")}
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

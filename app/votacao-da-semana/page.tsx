import type { Metadata } from "next";
import { VotacaoDaSemanaClient } from "./VotacaoDaSemanaClient";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("weeklyPoll.metaTitle"),
    description: t("weeklyPoll.metaDescription"),
    alternates: { canonical: "/votacao-da-semana" },
  };
}

export default function VotacaoDaSemanaPage() {
  return <VotacaoDaSemanaClient />;
}

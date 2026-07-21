import type { Metadata } from "next";
import { WhatsNewClient } from "./WhatsNewClient";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("whatsNew.metaTitle"),
    description: t("whatsNew.metaDescription"),
    alternates: { canonical: "/whats-new" },
  };
}

export default function WhatsNewPage() {
  return <WhatsNewClient />;
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { SupportClient } from "./SupportClient";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("supportPage.metaTitle"),
    description: t("supportPage.metaDescription"),
    alternates: { canonical: "/support" },
  };
}

export default function SupportPage() {
  return (
    <Suspense>
      <SupportClient />
    </Suspense>
  );
}

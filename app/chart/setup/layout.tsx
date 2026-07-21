import { Suspense } from "react";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export default async function ChartSetupLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getServerTranslations();
  return <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#6B6B70" }}>{t("chart.setup.loadingFallback")}</div>}>{children}</Suspense>;
}

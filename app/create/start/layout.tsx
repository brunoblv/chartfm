import { Suspense } from "react";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export default async function CreateStartLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getServerTranslations();
  return <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>{t("create.loadingFallback")}</div>}>{children}</Suspense>;
}

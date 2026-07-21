import { redirect } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { requireBruno } from "@/lib/require-bruno";
import { getServerTranslations } from "@/lib/i18n/server-translations";
import { RetroClient } from "./RetroClient";

export const dynamic = "force-dynamic";

// Em um primeiro momento, a Hot 100 Retrospectiva é visível apenas para o @bruno.
export default async function RetroPage() {
  const userId = await requireBruno();
  if (!userId) redirect("/");

  const { t } = await getServerTranslations();

  return (
    <Shell title={t("retro.pageTitle")} subtitle={t("retro.pageSubtitle")}>
      <RetroClient />
    </Shell>
  );
}

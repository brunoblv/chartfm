import { Shell } from "@/components/layout/Shell";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/translate";
import { InstagramDashboardClient } from "./InstagramDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminInstagramPage() {
  const locale = await getServerLocale();
  const t = (key: string) => translate(locale, `adminInstagram.${key}`);
  const auth = await requirePrivilegedSession();
  if (!auth) {
    return (
      <Shell title={t("title")} subtitle={t("subtitle")}>
        <div style={{ color: "var(--text-muted)" }}>{t("accessDenied")}</div>
      </Shell>
    );
  }
  return (
    <Shell title={t("title")} subtitle={t("subtitle")}>
      <InstagramDashboardClient />
    </Shell>
  );
}

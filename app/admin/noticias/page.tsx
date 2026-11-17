import { Shell } from "@/components/layout/Shell";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/translate";
import { NewsCenterClient } from "./NewsCenterClient";

export const dynamic = "force-dynamic";

export default async function AdminNewsPage() {
  const locale = await getServerLocale();
  const t = (key: string) => translate(locale, `adminNews.${key}`);
  const auth = await requirePrivilegedSession();
  return (
    <Shell title={t("title")} subtitle={t("subtitle")}>
      {auth ? <NewsCenterClient /> : <div style={{ color: "var(--text-muted)" }}>{t("accessDenied")}</div>}
    </Shell>
  );
}

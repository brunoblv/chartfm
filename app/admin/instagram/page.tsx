import { Shell } from "@/components/layout/Shell";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { getServerTranslations } from "@/lib/i18n/server-translations";
import { parseIgRange } from "@/lib/instagram-analytics/compute";
import { getInstagramAnalytics } from "@/lib/instagram-analytics/service";
import InstagramAnalyticsClient from "./InstagramAnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AdminInstagramPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t } = await getServerTranslations();
  const auth = await requirePrivilegedSession();
  if (!auth) {
    return (
      <Shell title={t("adminInstagram.title")} subtitle={t("adminInstagram.subtitle")}>
        <div style={{ color: "var(--text-muted)" }}>{t("adminInstagram.denied")}</div>
      </Shell>
    );
  }

  const params = await searchParams;
  const range = parseIgRange(params.range);
  const tab = params.tab === "posts" ? "posts" : "followers";
  const data = await getInstagramAnalytics(range);

  return (
    <Shell title={t("adminInstagram.title")} subtitle={t("adminInstagram.subtitle")}>
      <InstagramAnalyticsClient data={data} initialTab={tab} />
    </Shell>
  );
}

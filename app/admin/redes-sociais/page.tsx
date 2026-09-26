import { Shell } from "@/components/layout/Shell";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { getServerTranslations } from "@/lib/i18n/server-translations";
import { getSocialAnalyticsData } from "@/lib/social/metrics/dashboard";
import { SocialAnalyticsClient } from "./SocialAnalyticsClient";

export const dynamic = "force-dynamic";

const PERIODS = [7, 30, 90] as const;

export default async function AdminRedesSociaisPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { t } = await getServerTranslations();
  const auth = await requirePrivilegedSession();
  if (!auth) {
    return (
      <Shell title={t("socialAnalytics.title")} subtitle={t("socialAnalytics.subtitle")}>
        <div style={{ color: "var(--text-muted)" }}>{t("socialAnalytics.accessDenied")}</div>
      </Shell>
    );
  }

  const { days: rawDays } = await searchParams;
  const days = PERIODS.find((p) => String(p) === rawDays) ?? 30;
  const data = await getSocialAnalyticsData(days);

  return (
    <Shell title={t("socialAnalytics.title")} subtitle={t("socialAnalytics.subtitle")}>
      <SocialAnalyticsClient data={data} periods={[...PERIODS]} />
    </Shell>
  );
}

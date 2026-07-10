import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { Shell } from "@/components/layout/Shell";
import { getAnalyticsDashboardData } from "@/lib/analytics-metrics";
import { getEditorialAnalytics } from "@/lib/editorial-analytics";
import { AnalyticsClient } from "./analytics-client";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <Shell title="Admin" subtitle="Acesso"><div>Faça login para acessar.</div></Shell>;
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role)) return <Shell title="Admin" subtitle="Acesso"><div>Acesso negado.</div></Shell>;

  const [data, editorial] = await Promise.all([getAnalyticsDashboardData(), getEditorialAnalytics()]);

  return (
    <Shell title="Analytics" subtitle="Uso, retenção e tráfego do ChartFM">
      <AnalyticsClient data={data} editorial={editorial} />
    </Shell>
  );
}

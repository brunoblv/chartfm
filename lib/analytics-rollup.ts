import { prisma } from "@/lib/prisma";
import { purgeOldApiRequestLogs } from "@/lib/api-request-log";
import { purgeOldSiteAuditLogs } from "@/lib/site-audit-log";
import { purgeOldSystemErrorLogs } from "@/lib/system-error-log";

// Dias em horário de Brasília (UTC-3 fixo, sem horário de verão desde 2019)
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
const EVENT_RETENTION_DAYS = 90;

export function brtDayKey(d: Date): string {
  return new Date(d.getTime() - BRT_OFFSET_MS).toISOString().slice(0, 10);
}

function brtDayRangeUtc(dayKey: string): { start: Date; end: Date } {
  const start = new Date(`${dayKey}T03:00:00.000Z`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export async function rollupAnalyticsDay(dayKey: string) {
  const { start, end } = brtDayRangeUtc(dayKey);

  const [events, signups] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { sessionId: true, userId: true, type: true, path: true, createdAt: true },
    }),
    prisma.user.count({ where: { createdAt: { gte: start, lt: end } } }),
  ]);

  const sessions = new Map<string, { min: number; max: number }>();
  const loggedUsers = new Set<string>();
  const pathViews = new Map<string, number>();
  const editorialViews = new Map<string, number>();
  const landingVisitorSessions = new Set<string>();
  let pageviews = 0;
  let signupEvents = 0;

  for (const ev of events) {
    const t = ev.createdAt.getTime();
    const s = sessions.get(ev.sessionId);
    if (s) {
      if (t < s.min) s.min = t;
      if (t > s.max) s.max = t;
    } else {
      sessions.set(ev.sessionId, { min: t, max: t });
    }
    if (ev.userId) loggedUsers.add(ev.userId);
    if (ev.type === "pageview") {
      pageviews++;
      pathViews.set(ev.path, (pathViews.get(ev.path) ?? 0) + 1);
      if (ev.path === "/" && !ev.userId) landingVisitorSessions.add(ev.sessionId);
      const editorialSlug = ev.path.match(/^\/editorial\/([^/]+)/)?.[1];
      if (editorialSlug) {
        editorialViews.set(editorialSlug, (editorialViews.get(editorialSlug) ?? 0) + 1);
      }
    } else if (ev.type === "signup") {
      signupEvents++;
    }
  }

  // Heartbeat a cada 60s: soma-se meia batida por sessão para compensar a cauda
  let totalSeconds = 0;
  for (const s of sessions.values()) {
    totalSeconds += Math.round((s.max - s.min) / 1000) + 30;
  }
  const sessionCount = sessions.size;
  const avgSessionSeconds = sessionCount > 0 ? Math.round(totalSeconds / sessionCount) : 0;

  const topPaths = [...pathViews.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([path, views]) => ({ path, views }));

  const date = new Date(`${dayKey}T00:00:00.000Z`);
  const data = {
    visitors: sessionCount,
    loggedUsers: loggedUsers.size,
    sessions: sessionCount,
    pageviews,
    totalSeconds,
    avgSessionSeconds,
    signups,
    landingVisitors: landingVisitorSessions.size,
    signupEvents,
    topPaths,
  };

  await prisma.analyticsDailyStat.upsert({
    where: { date },
    create: { date, ...data },
    update: data,
  });

  await Promise.all(
    [...editorialViews.entries()].map(([slug, views]) =>
      prisma.editorialPostDailyView.upsert({
        where: { slug_date: { slug, date } },
        create: { slug, date, views },
        update: { views },
      }),
    ),
  );

  return { day: dayKey, ...data };
}

// Consolida os últimos `days` dias fechados (ontem para trás) e purga eventos antigos
export async function runAnalyticsRollup(now = new Date(), days = 1) {
  const results = [];
  for (let i = days; i >= 1; i--) {
    const day = brtDayKey(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
    results.push(await rollupAnalyticsDay(day));
  }

  const cutoff = new Date(now.getTime() - EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const purged = await prisma.analyticsEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  const purgedApiLogs = await purgeOldApiRequestLogs();
  const purgedAuditLogs = await purgeOldSiteAuditLogs();
  const purgedSystemErrorLogs = await purgeOldSystemErrorLogs();

  return { days: results, purgedEvents: purged.count, purgedApiLogs, purgedAuditLogs, purgedSystemErrorLogs };
}

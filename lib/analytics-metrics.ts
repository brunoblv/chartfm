import { prisma } from "@/lib/prisma";

// Semanas alinhadas à cadência do app: terça 0h BRT → segunda (deadline do Global 100)
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const WEEKS_WINDOW = 12;

export type AnalyticsDashboardData = {
  tiles: {
    totalUsers: number;
    signups7d: number;
    wau: number;
    mau: number;
    stickiness: number; // wau/mau em %
    weeklyUpdateRate: number; // % da base ativa (4 sem) que postou chart nos últimos 7d
    avgSessionSeconds7d: number;
    visitorsToday: number;
    loggedToday: number;
    landingVisitors7d: number;
    signupsFromLanding7d: number;
    conversionPct7d: number; // signupsFromLanding7d ÷ landingVisitors7d
  };
  traffic: {
    daily: { day: string; visitors: number; logged: number; avgSession: number; pageviews: number }[];
    topPaths: { path: string; views: number }[];
    hasData: boolean;
  };
  activity: {
    weekly: { week: string; active: number; charts: number }[];
    signupsWeekly: { week: string; count: number }[];
    features: { feature: string; users: number; events: number }[];
    multiFeaturePct: number;
    weekdayActivity: { weekday: string; events: number }[];
  };
  retention: {
    cohorts: { week: string; size: number; cells: (number | null)[] }[];
    paradaHealth: { active: number; cooling: number; churned: number };
  };
};

// Início da semana (terça 0h BRT) como instante UTC
function weekStartTue(d: Date): Date {
  const shifted = new Date(d.getTime() - BRT_OFFSET_MS);
  const dow = shifted.getUTCDay();
  const daysSinceTue = (dow - 2 + 7) % 7;
  const startUtcMidnight = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() - daysSinceTue
  );
  return new Date(startUtcMidnight + BRT_OFFSET_MS);
}

function weekLabel(weekStart: Date): string {
  const d = new Date(weekStart.getTime() - BRT_OFFSET_MS);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function brtWeekday(d: Date): number {
  return new Date(d.getTime() - BRT_OFFSET_MS).getUTCDay();
}

type ActivityEvent = { userId: string; at: Date; feature: string };

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export async function getAnalyticsDashboardData(now = new Date()): Promise<AnalyticsDashboardData> {
  const currentWeekStart = weekStartTue(now);
  const windowStart = new Date(currentWeekStart.getTime() - (WEEKS_WINDOW - 1) * WEEK_MS);
  const d7 = new Date(now.getTime() - 7 * DAY_MS);
  const d28 = new Date(now.getTime() - 28 * DAY_MS);
  const d30 = new Date(now.getTime() - 30 * DAY_MS);
  const todayStartBrt = (() => {
    const s = new Date(now.getTime() - BRT_OFFSET_MS);
    return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()) + BRT_OFFSET_MS);
  })();

  const since = { gte: windowStart };
  const [
    charts,
    chartLikes,
    comments,
    paradaComments,
    posts,
    pushVotes,
    pushSubmissions,
    copaVotes,
    albumReviews,
    songRecs,
    clubVotes,
    totalUsers,
    signups7d,
    usersInWindow,
    lastChartByUser,
    dailyStats,
    topPathsRaw,
    todayEvents,
  ] = await Promise.all([
    prisma.chart.findMany({ where: { postedAt: since }, select: { userId: true, postedAt: true } }),
    prisma.chartLike.findMany({ where: { createdAt: since }, select: { userId: true, createdAt: true } }),
    prisma.comment.findMany({ where: { createdAt: since }, select: { userId: true, createdAt: true } }),
    prisma.paradaComment.findMany({ where: { createdAt: since }, select: { userId: true, createdAt: true } }),
    prisma.post.findMany({ where: { createdAt: since }, select: { userId: true, createdAt: true } }),
    prisma.pushVote.findMany({ where: { submittedAt: since }, select: { userId: true, submittedAt: true } }),
    prisma.pushSubmission.findMany({ where: { createdAt: since }, select: { userId: true, createdAt: true } }),
    prisma.copaVote.findMany({ where: { createdAt: since }, select: { userId: true, createdAt: true } }),
    prisma.albumReview.findMany({ where: { createdAt: since }, select: { userId: true, createdAt: true } }),
    prisma.songRecommendation.findMany({ where: { createdAt: since }, select: { userId: true, createdAt: true } }),
    prisma.albumClubPollVote.findMany({ where: { createdAt: since }, select: { userId: true, createdAt: true } }),
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: d7 } } }),
    prisma.user.findMany({ where: { createdAt: since }, select: { id: true, createdAt: true } }),
    prisma.chart.groupBy({ by: ["userId"], _max: { postedAt: true } }),
    prisma.analyticsDailyStat.findMany({ orderBy: { date: "asc" }, take: 60 }),
    prisma.analyticsEvent.groupBy({
      by: ["path"],
      where: { type: "pageview", createdAt: { gte: d7 } },
      _count: { path: true },
      orderBy: { _count: { path: "desc" } },
      take: 12,
    }),
    prisma.analyticsEvent.findMany({
      where: { createdAt: { gte: todayStartBrt } },
      select: { sessionId: true, userId: true, type: true, path: true },
    }),
  ]);

  const events: ActivityEvent[] = [
    ...charts.map((e) => ({ userId: e.userId, at: e.postedAt, feature: "Paradas" })),
    ...chartLikes.map((e) => ({ userId: e.userId, at: e.createdAt, feature: "Likes em charts" })),
    ...comments.map((e) => ({ userId: e.userId, at: e.createdAt, feature: "Comentários" })),
    ...paradaComments.map((e) => ({ userId: e.userId, at: e.createdAt, feature: "Comentários" })),
    ...posts.map((e) => ({ userId: e.userId, at: e.createdAt, feature: "Comunidades" })),
    ...pushVotes.map((e) => ({ userId: e.userId, at: e.submittedAt, feature: "Push Game" })),
    ...pushSubmissions.map((e) => ({ userId: e.userId, at: e.createdAt, feature: "Push Game" })),
    ...copaVotes.map((e) => ({ userId: e.userId, at: e.createdAt, feature: "Copa" })),
    ...albumReviews.map((e) => ({ userId: e.userId, at: e.createdAt, feature: "CriticsFM" })),
    ...songRecs.map((e) => ({ userId: e.userId, at: e.createdAt, feature: "Recomendações" })),
    ...clubVotes.map((e) => ({ userId: e.userId, at: e.createdAt, feature: "Clube do Álbum" })),
  ];

  // ── Atividade semanal (12 semanas, terça→segunda) ──
  const weeklyActive: Set<string>[] = Array.from({ length: WEEKS_WINDOW }, () => new Set());
  const weeklyCharts: number[] = Array(WEEKS_WINDOW).fill(0);
  const weekIndexOf = (at: Date) => Math.floor((weekStartTue(at).getTime() - windowStart.getTime()) / WEEK_MS);

  for (const ev of events) {
    const wi = weekIndexOf(ev.at);
    if (wi >= 0 && wi < WEEKS_WINDOW) weeklyActive[wi].add(ev.userId);
  }
  for (const c of charts) {
    const wi = weekIndexOf(c.postedAt);
    if (wi >= 0 && wi < WEEKS_WINDOW) weeklyCharts[wi]++;
  }

  const weekly = weeklyActive.map((set, i) => ({
    week: weekLabel(new Date(windowStart.getTime() + i * WEEK_MS)),
    active: set.size,
    charts: weeklyCharts[i],
  }));

  // ── WAU / MAU / stickiness ──
  const wauSet = new Set<string>();
  const mauSet = new Set<string>();
  for (const ev of events) {
    if (ev.at >= d30) mauSet.add(ev.userId);
    if (ev.at >= d7) wauSet.add(ev.userId);
  }
  const wau = wauSet.size;
  const mau = mauSet.size;

  // ── Taxa de atualização semanal da parada ──
  const chartUsers7d = new Set<string>();
  const chartUsers28d = new Set<string>();
  for (const c of charts) {
    if (c.postedAt >= d28) chartUsers28d.add(c.userId);
    if (c.postedAt >= d7) chartUsers7d.add(c.userId);
  }
  const weeklyUpdateRate = chartUsers28d.size > 0 ? Math.round((chartUsers7d.size / chartUsers28d.size) * 100) : 0;

  // ── Cadastros por semana ──
  const signupsWeekly = Array(WEEKS_WINDOW).fill(0);
  for (const u of usersInWindow) {
    const wi = weekIndexOf(u.createdAt);
    if (wi >= 0 && wi < WEEKS_WINDOW) signupsWeekly[wi]++;
  }

  // ── Uso por feature (30d) + multi-feature ──
  const featureUsers = new Map<string, Set<string>>();
  const featureEvents = new Map<string, number>();
  const userFeatures = new Map<string, Set<string>>();
  for (const ev of events) {
    if (ev.at < d30) continue;
    if (!featureUsers.has(ev.feature)) featureUsers.set(ev.feature, new Set());
    featureUsers.get(ev.feature)!.add(ev.userId);
    featureEvents.set(ev.feature, (featureEvents.get(ev.feature) ?? 0) + 1);
    if (!userFeatures.has(ev.userId)) userFeatures.set(ev.userId, new Set());
    userFeatures.get(ev.userId)!.add(ev.feature);
  }
  const features = [...featureUsers.entries()]
    .map(([feature, users]) => ({ feature, users: users.size, events: featureEvents.get(feature) ?? 0 }))
    .sort((a, b) => b.users - a.users);
  const multiFeatureUsers = [...userFeatures.values()].filter((s) => s.size >= 2).length;
  const multiFeaturePct = mau > 0 ? Math.round((multiFeatureUsers / mau) * 100) : 0;

  // ── Atividade por dia da semana (últimas 8 semanas) ──
  const d56 = new Date(now.getTime() - 56 * DAY_MS);
  const weekdayCounts = Array(7).fill(0);
  for (const ev of events) {
    if (ev.at >= d56) weekdayCounts[brtWeekday(ev.at)]++;
  }
  const weekdayActivity = weekdayCounts.map((count, i) => ({ weekday: WEEKDAY_LABELS[i], events: count }));

  // ── Coortes de cadastro × postagem de chart ──
  const chartWeeksByUser = new Map<string, Set<number>>();
  for (const c of charts) {
    const wi = weekIndexOf(c.postedAt);
    if (wi < 0 || wi >= WEEKS_WINDOW) continue;
    if (!chartWeeksByUser.has(c.userId)) chartWeeksByUser.set(c.userId, new Set());
    chartWeeksByUser.get(c.userId)!.add(wi);
  }
  const cohortUsers: { id: string; cohort: number }[] = usersInWindow
    .map((u) => ({ id: u.id, cohort: weekIndexOf(u.createdAt) }))
    .filter((u) => u.cohort >= 0 && u.cohort < WEEKS_WINDOW);

  const cohorts = Array.from({ length: WEEKS_WINDOW }, (_, c) => {
    const members = cohortUsers.filter((u) => u.cohort === c);
    const maxOffset = WEEKS_WINDOW - 1 - c;
    const cells: (number | null)[] = Array.from({ length: WEEKS_WINDOW }, (_, offset) => {
      if (offset > maxOffset || members.length === 0) return null;
      const retained = members.filter((m) => chartWeeksByUser.get(m.id)?.has(c + offset)).length;
      return Math.round((retained / members.length) * 100);
    });
    return { week: weekLabel(new Date(windowStart.getTime() + c * WEEK_MS)), size: members.length, cells };
  });

  // ── Saúde das paradas (tempo desde o último chart) ──
  let active = 0,
    cooling = 0,
    churned = 0;
  for (const row of lastChartByUser) {
    const last = row._max.postedAt;
    if (!last) continue;
    const days = (now.getTime() - last.getTime()) / DAY_MS;
    if (days <= 7) active++;
    else if (days <= 28) cooling++;
    else churned++;
  }

  // ── Tráfego (eventos novos) ──
  const todaySessions = new Set<string>();
  const todayLogged = new Set<string>();
  const todayLandingSessions = new Set<string>();
  let todayPageviews = 0;
  let todaySignupEvents = 0;
  for (const ev of todayEvents) {
    todaySessions.add(ev.sessionId);
    if (ev.userId) todayLogged.add(ev.userId);
    if (ev.type === "pageview") {
      todayPageviews++;
      if (ev.path === "/" && !ev.userId) todayLandingSessions.add(ev.sessionId);
    } else if (ev.type === "signup") {
      todaySignupEvents++;
    }
  }

  const daily = dailyStats.map((s) => ({
    day: weekLabel(new Date(s.date.getTime() + BRT_OFFSET_MS)),
    visitors: s.visitors,
    logged: s.loggedUsers,
    avgSession: s.avgSessionSeconds,
    pageviews: s.pageviews,
  }));
  daily.push({
    day: "hoje",
    visitors: todaySessions.size,
    logged: todayLogged.size,
    avgSession: 0,
    pageviews: todayPageviews,
  });

  const last7 = dailyStats.slice(-7);
  const sumSeconds = last7.reduce((a, s) => a + s.totalSeconds, 0);
  const sumSessions = last7.reduce((a, s) => a + s.sessions, 0);
  const avgSessionSeconds7d = sumSessions > 0 ? Math.round(sumSeconds / sumSessions) : 0;

  const landingVisitors7d = last7.reduce((a, s) => a + s.landingVisitors, 0) + todayLandingSessions.size;
  const signupsFromLanding7d = last7.reduce((a, s) => a + s.signupEvents, 0) + todaySignupEvents;
  const conversionPct7d = landingVisitors7d > 0 ? Math.round((signupsFromLanding7d / landingVisitors7d) * 1000) / 10 : 0;

  return {
    tiles: {
      totalUsers,
      signups7d,
      wau,
      mau,
      stickiness: mau > 0 ? Math.round((wau / mau) * 100) : 0,
      weeklyUpdateRate,
      avgSessionSeconds7d,
      visitorsToday: todaySessions.size,
      loggedToday: todayLogged.size,
      landingVisitors7d,
      signupsFromLanding7d,
      conversionPct7d,
    },
    traffic: {
      daily,
      topPaths: topPathsRaw.map((p) => ({ path: p.path, views: p._count.path })),
      hasData: dailyStats.length > 0 || todayEvents.length > 0,
    },
    activity: { weekly, signupsWeekly: weekly.map((w, i) => ({ week: w.week, count: signupsWeekly[i] })), features, multiFeaturePct, weekdayActivity },
    retention: { cohorts, paradaHealth: { active, cooling, churned } },
  };
}

import { Shell } from "@/components/layout/Shell";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import PostagensClient from "./PostagensClient";

export const dynamic = "force-dynamic";

export default async function AdminPostagensPage() {
  const auth = await requirePrivilegedSession();
  if (!auth) {
    return (
      <Shell title="Admin · Postagens" subtitle="Fila editorial de postagens automáticas">
        <div style={{ color: "var(--text-muted)" }}>Acesso negado. Apenas ADMIN e DEV.</div>
      </Shell>
    );
  }

  const [
    posts,
    platformConfigs,
    automationToggles,
    scheduleConfig,
    pushRounds,
    copaEditions,
    latestGlobal100,
    latestAirplay,
    latestAlbums,
    latestWeeklyPoll,
  ] = await Promise.all([
    prisma.socialPost.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 200,
      include: { publications: true },
    }),
    prisma.socialPlatformConfig.findMany(),
    prisma.socialAutomationToggle.findMany(),
    prisma.socialScheduleConfig.findUnique({ where: { id: "default" } }),
    prisma.pushRound.findMany({ select: { id: true, number: true }, orderBy: { number: "desc" }, take: 10 }),
    prisma.copaEdition.findMany({ select: { id: true, name: true, year: true }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.globalSnapshot.findFirst({ orderBy: { weekIndex: "desc" }, select: { weekIndex: true } }),
    prisma.globalAirplaySnapshot.findFirst({ orderBy: { weekIndex: "desc" }, select: { weekIndex: true } }),
    prisma.globalAlbumsSnapshot.findFirst({ orderBy: { weekIndex: "desc" }, select: { weekIndex: true } }),
    prisma.weeklySpotlightPoll.findFirst({
      where: { communityId: null },
      orderBy: { weekIndex: "desc" },
      select: { weekIndex: true },
    }),
  ]);

  // Última semana com dados congelados por tipo de evento — evita pré-preencher a "semana atual"
  // calendário quando o snapshot da semana ainda não foi gerado (só sai na terça).
  const latestWeekIndex: Record<string, number | null> = {
    GLOBAL100_PUBLISHED: latestGlobal100?.weekIndex ?? null,
    AIRPLAY_PUBLISHED: latestAirplay?.weekIndex ?? null,
    ALBUMS_CHART_PUBLISHED: latestAlbums?.weekIndex ?? null,
    WEEKLY_POLL_OPEN: latestWeeklyPoll?.weekIndex ?? null,
  };

  const serializedPosts = posts.map((p) => ({
    id: p.id,
    eventType: p.eventType,
    entityType: p.entityType,
    entityId: p.entityId,
    priority: p.priority,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    scheduledAt: p.scheduledAt?.toISOString() ?? null,
    expiresAt: p.expiresAt?.toISOString() ?? null,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    platforms: p.platforms,
    captionInstagram: p.captionInstagram,
    captionFacebook: p.captionFacebook,
    captionThreads: p.captionThreads,
    captionTelegram: p.captionTelegram,
    imageFeed45: p.imageFeed45,
    imageTelegram11: p.imageTelegram11,
    imageStory916: p.imageStory916,
    hashtags: p.hashtags,
    retryCount: p.retryCount,
    lastError: p.lastError,
    publications: p.publications.map((pub) => ({
      id: pub.id,
      platform: pub.platform,
      status: pub.status,
      externalId: pub.externalId,
      error: pub.error,
      publishedAt: pub.publishedAt?.toISOString() ?? null,
    })),
  }));

  return (
    <Shell title="Postagens" subtitle="Fila editorial de postagens automáticas nas redes sociais">
      <PostagensClient
        initialPosts={serializedPosts}
        platformConfigs={platformConfigs}
        automationToggles={automationToggles}
        scheduleConfig={scheduleConfig ? { slots: scheduleConfig.slots, timezone: scheduleConfig.timezone } : { slots: ["07:00", "09:00", "13:00", "17:00", "19:00"], timezone: "America/Sao_Paulo" }}
        pushRounds={pushRounds}
        copaEditions={copaEditions}
        latestWeekIndex={latestWeekIndex}
      />
    </Shell>
  );
}

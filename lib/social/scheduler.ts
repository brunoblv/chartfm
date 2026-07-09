import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { SocialPlatform, SocialPostPriority, SocialPostStatus, SocialPublishStatus } from "@prisma/client";
import { upcomingSlots, brtDayKey } from "@/lib/social/slots";
import { renderSocialPostAssets } from "@/lib/social/render";
import { publishToPlatform, publishToTelegram } from "@/lib/social/publish";
import { isSocialPostingEnabled } from "@/lib/social/config";

const DEFAULT_DAILY_LIMITS: Record<SocialPlatform, number> = {
  FACEBOOK: 2,
  INSTAGRAM_FEED: 2,
  INSTAGRAM_STORY: 9999, // sem teto, spec §16
  THREADS: 4,
  TELEGRAM: 3,
};

const PRIORITY_ORDER: Record<SocialPostPriority, number> = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

async function ensureDefaultConfigs() {
  await prisma.socialScheduleConfig.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
  for (const platform of Object.values(SocialPlatform)) {
    await prisma.socialPlatformConfig.upsert({
      where: { platform },
      create: { platform, dailyLimit: DEFAULT_DAILY_LIMITS[platform] },
      update: {},
    });
  }
}

/**
 * Passo 1: encontra posts PENDING e agenda cada um no próximo slot livre,
 * respeitando expiração, diversidade (mesma entidade/tipo não repete no mesmo
 * slot) e o limite diário por plataforma (broadcast para todas as plataformas
 * habilitadas, exceto as que já bateram o teto do dia — Stories não tem teto).
 */
export async function assignSlots(now: Date = new Date()): Promise<{ scheduled: number }> {
  await ensureDefaultConfigs();

  const schedule = await prisma.socialScheduleConfig.findUniqueOrThrow({ where: { id: "default" } });
  const platformConfigs = await prisma.socialPlatformConfig.findMany();
  const enabledPlatforms = platformConfigs.filter((p) => p.enabled);

  const pending = await prisma.socialPost.findMany({
    where: { status: SocialPostStatus.PENDING },
    orderBy: [{ createdAt: "asc" }],
  });
  pending.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.score - a.score);
  if (pending.length === 0) return { scheduled: 0 };

  const upcoming = upcomingSlots(schedule.slots, now, 7);

  // Estado local desta execução: por slot, quais entidades/tipos já foram usados (diversidade);
  // por dia, quantas publicações por plataforma já foram reservadas (teto diário).
  const slotUsage = new Map<number, { entityIds: Set<string>; eventTypes: Set<string> }>();
  const dayPlatformCounts = new Map<string, Map<SocialPlatform, number>>();

  const existingScheduled = await prisma.socialPost.findMany({
    where: { status: { in: [SocialPostStatus.SCHEDULED, SocialPostStatus.GENERATING, SocialPostStatus.READY, SocialPostStatus.PUBLISHING] }, scheduledAt: { not: null } },
    include: { publications: true },
  });
  for (const post of existingScheduled) {
    const slotTime = post.scheduledAt!.getTime();
    if (!slotUsage.has(slotTime)) slotUsage.set(slotTime, { entityIds: new Set(), eventTypes: new Set() });
    slotUsage.get(slotTime)!.entityIds.add(post.entityId);
    slotUsage.get(slotTime)!.eventTypes.add(post.eventType);

    const dayKey = brtDayKey(post.scheduledAt!);
    if (!dayPlatformCounts.has(dayKey)) dayPlatformCounts.set(dayKey, new Map());
    const counts = dayPlatformCounts.get(dayKey)!;
    for (const pub of post.publications) {
      if (pub.status === SocialPublishStatus.PUBLISHED || pub.status === SocialPublishStatus.PENDING) {
        counts.set(pub.platform, (counts.get(pub.platform) ?? 0) + 1);
      }
    }
  }

  let scheduledCount = 0;

  for (const post of pending) {
    let chosenSlot: Date | null = null;
    for (const slot of upcoming) {
      if (post.expiresAt && slot.getTime() > post.expiresAt.getTime()) break; // não adianta olhar slots depois da expiração
      const usage = slotUsage.get(slot.getTime());
      const conflict = usage && (usage.entityIds.has(post.entityId) || usage.eventTypes.has(post.eventType));
      if (!conflict) {
        chosenSlot = slot;
        break;
      }
    }
    // sem slot livre respeitando diversidade antes da expiração: força o primeiro slot disponível mesmo assim
    if (!chosenSlot) chosenSlot = upcoming.find((s) => !post.expiresAt || s.getTime() <= post.expiresAt.getTime()) ?? upcoming[0];
    if (!chosenSlot) continue;

    const slotTime = chosenSlot.getTime();
    if (!slotUsage.has(slotTime)) slotUsage.set(slotTime, { entityIds: new Set(), eventTypes: new Set() });
    slotUsage.get(slotTime)!.entityIds.add(post.entityId);
    slotUsage.get(slotTime)!.eventTypes.add(post.eventType);

    const dayKey = brtDayKey(chosenSlot);
    if (!dayPlatformCounts.has(dayKey)) dayPlatformCounts.set(dayKey, new Map());
    const counts = dayPlatformCounts.get(dayKey)!;

    const assignedPlatforms: SocialPlatform[] = [];
    const publicationsData: { platform: SocialPlatform; status: SocialPublishStatus }[] = [];
    for (const cfg of enabledPlatforms) {
      const used = counts.get(cfg.platform) ?? 0;
      if (used < cfg.dailyLimit) {
        counts.set(cfg.platform, used + 1);
        assignedPlatforms.push(cfg.platform);
        publicationsData.push({ platform: cfg.platform, status: SocialPublishStatus.PENDING });
      } else {
        publicationsData.push({ platform: cfg.platform, status: SocialPublishStatus.SKIPPED_CAP });
      }
    }

    await prisma.socialPost.update({
      where: { id: post.id },
      data: {
        status: SocialPostStatus.SCHEDULED,
        scheduledAt: chosenSlot,
        platforms: assignedPlatforms,
        publications: { create: publicationsData },
      },
    });
    scheduledCount++;
  }

  return { scheduled: scheduledCount };
}

/** Passo 2: gera artes/legendas e publica os posts cujo slot já chegou. */
export async function generateAndPublishDue(now: Date = new Date()): Promise<{ processed: number }> {
  if (!isSocialPostingEnabled()) return { processed: 0 };

  const due = await prisma.socialPost.findMany({
    where: { status: SocialPostStatus.SCHEDULED, scheduledAt: { lte: now } },
    include: { publications: true },
  });

  for (const post of due) {
    await prisma.socialPost.update({ where: { id: post.id }, data: { status: SocialPostStatus.GENERATING } });

    const assets = await renderSocialPostAssets(post.id, post.eventType, post.entityId);
    if (!assets) {
      await prisma.socialPost.update({
        where: { id: post.id },
        data: { status: SocialPostStatus.FAILED, lastError: "Template de arte/legenda ainda não implementado para este tipo de evento ou entidade não elegível mais." },
      });
      continue;
    }

    await prisma.socialPost.update({
      where: { id: post.id },
      data: {
        status: SocialPostStatus.READY,
        captionInstagram: assets.captions.captionInstagram,
        captionFacebook: assets.captions.captionFacebook,
        captionThreads: assets.captions.captionThreads,
        captionTelegram: assets.captions.captionTelegram,
        imageFeed45: assets.imageFeed45,
        imageTelegram11: assets.imageTelegram11,
        imageStory916: assets.imageStory916,
        hashtags: assets.hashtags,
      },
    });

    await publishPost(post.id);
  }

  return { processed: due.length };
}

/** Publica (ou republica falhas) de um SocialPost já com artes/legendas prontas. Usado pelo scheduler e pelas ações manuais do admin. */
export async function publishPost(postId: string): Promise<void> {
  const post = await prisma.socialPost.findUnique({ where: { id: postId }, include: { publications: true } });
  if (!post) return;

  await prisma.socialPost.update({ where: { id: postId }, data: { status: SocialPostStatus.PUBLISHING } });

  const targetUrl =
    post.entityType === "album" ? `/criticsfm/${post.entityId}` : "/";

  let telegramImageBuffer: Buffer | null = null;
  if (post.imageTelegram11) {
    try {
      telegramImageBuffer = await fs.readFile(path.join(process.cwd(), "public", post.imageTelegram11.replace(/^\//, "")));
    } catch {
      telegramImageBuffer = null;
    }
  }

  const pendingPublications = post.publications.filter((p) => p.status === SocialPublishStatus.PENDING);
  const externalIds: Partial<Record<SocialPlatform, string>> = {};

  for (const pub of pendingPublications) {
    const result =
      pub.platform === SocialPlatform.TELEGRAM
        ? await publishToTelegram(post.captionTelegram ?? "", targetUrl, telegramImageBuffer)
        : await publishToPlatform(pub.platform, {
            captionInstagram: post.captionInstagram,
            captionFacebook: post.captionFacebook,
            captionThreads: post.captionThreads,
            captionTelegram: post.captionTelegram,
            imageFeed45: post.imageFeed45,
            imageTelegram11: post.imageTelegram11,
            imageStory916: post.imageStory916,
            targetUrl,
          });

    await prisma.socialPostPublication.update({
      where: { id: pub.id },
      data: {
        status: result.ok ? SocialPublishStatus.PUBLISHED : SocialPublishStatus.FAILED,
        externalId: result.externalId ?? null,
        error: result.error ?? null,
        publishedAt: result.ok ? new Date() : null,
      },
    });
    if (result.ok && result.externalId) externalIds[pub.platform] = result.externalId;
  }

  const finalPublications = await prisma.socialPostPublication.findMany({ where: { socialPostId: postId } });
  const relevant = finalPublications.filter((p) => p.status !== SocialPublishStatus.SKIPPED_CAP);
  const publishedCount = relevant.filter((p) => p.status === SocialPublishStatus.PUBLISHED).length;
  const failedCount = relevant.filter((p) => p.status === SocialPublishStatus.FAILED).length;

  const finalStatus =
    publishedCount === 0 && failedCount > 0
      ? SocialPostStatus.FAILED
      : failedCount > 0
        ? SocialPostStatus.PARTIALLY_PUBLISHED
        : SocialPostStatus.PUBLISHED;

  await prisma.socialPost.update({
    where: { id: postId },
    data: {
      status: finalStatus,
      publishedAt: publishedCount > 0 ? new Date() : post.publishedAt,
      facebookPostId: externalIds.FACEBOOK ?? post.facebookPostId,
      instagramMediaId: externalIds.INSTAGRAM_FEED ?? post.instagramMediaId,
      threadsPostId: externalIds.THREADS ?? post.threadsPostId,
      retryCount: failedCount > 0 ? { increment: 1 } : undefined,
      lastError: failedCount > 0 ? finalPublications.find((p) => p.status === SocialPublishStatus.FAILED)?.error ?? null : null,
    },
  });
}

/** Ponto de entrada do cron: agenda pendentes e publica os que já chegaram no slot. */
export async function runSchedulerTick(now: Date = new Date()) {
  const assigned = await assignSlots(now);
  const published = await generateAndPublishDue(now);
  return { ...assigned, ...published };
}

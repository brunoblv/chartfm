import fs from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { SocialPlatform, SocialPostPriority, SocialPostStatus, SocialPublishStatus } from "@prisma/client";
import { upcomingSlots, weekdayInBrt, timeOfDayInBrt } from "@/lib/social/slots";
import { renderSocialPostAssets } from "@/lib/social/render";
import { publishToPlatform, publishToTelegram } from "@/lib/social/publish";
import { isSocialPostingEnabled } from "@/lib/social/config";
import { socialImageDiskPath } from "@/lib/social/image-path";
import { getEventSchedules } from "@/lib/social/event-schedule";

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
      create: { platform },
      update: {},
    });
  }
}

/**
 * Passo 1: encontra posts PENDING e agenda cada um no próximo slot livre,
 * respeitando expiração e diversidade (mesma entidade/tipo não repete no
 * mesmo slot). Toda plataforma habilitada recebe a mesma publicação — não há
 * teto diário por rede; a única plataforma com tratamento próprio é o
 * Telegram (imagem/legenda em formato/variant diferente, ver publishPost).
 */
export async function assignSlots(now: Date = new Date()): Promise<{ scheduled: number }> {
  await ensureDefaultConfigs();

  const schedule = await prisma.socialScheduleConfig.findUniqueOrThrow({ where: { id: "default" } });
  const platformConfigs = await prisma.socialPlatformConfig.findMany();
  const enabledPlatforms = platformConfigs.filter((p) => p.enabled);
  const eventSchedules = await getEventSchedules();

  const pending = await prisma.socialPost.findMany({
    where: { status: SocialPostStatus.PENDING },
    orderBy: [{ createdAt: "asc" }],
  });
  pending.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.score - a.score);
  if (pending.length === 0) return { scheduled: 0 };

  const upcoming = upcomingSlots(schedule.slots, now, 7);

  // Estado local desta execução: por slot, quais entidades/tipos já foram usados (diversidade).
  const slotUsage = new Map<number, { entityIds: Set<string>; eventTypes: Set<string> }>();

  const existingScheduled = await prisma.socialPost.findMany({
    where: { status: { in: [SocialPostStatus.SCHEDULED, SocialPostStatus.GENERATING, SocialPostStatus.READY, SocialPostStatus.PUBLISHING] }, scheduledAt: { not: null } },
  });
  for (const post of existingScheduled) {
    const slotTime = post.scheduledAt!.getTime();
    if (!slotUsage.has(slotTime)) slotUsage.set(slotTime, { entityIds: new Set(), eventTypes: new Set() });
    slotUsage.get(slotTime)!.entityIds.add(post.entityId);
    slotUsage.get(slotTime)!.eventTypes.add(post.eventType);
  }

  let scheduledCount = 0;

  for (const post of pending) {
    let chosenSlot: Date | null = null;

    // Tipos com dia+horário fixo (ex.: as paradas oficiais — configurável em
    // /admin/postagens, aba "Agenda das Paradas") usam o slot exato sempre
    // que existir, mesmo que outro post já esteja lá: é intencional que
    // saiam juntas. A checagem de diversidade só entra na busca genérica
    // de fallback abaixo.
    const preferredSlot = eventSchedules.get(post.eventType);
    if (preferredSlot) {
      chosenSlot =
        upcoming.find(
          (slot) =>
            (!post.expiresAt || slot.getTime() <= post.expiresAt.getTime()) &&
            weekdayInBrt(slot) === preferredSlot.weekday &&
            timeOfDayInBrt(slot) === preferredSlot.time,
        ) ?? null;
    }

    if (!chosenSlot) {
      for (const slot of upcoming) {
        if (post.expiresAt && slot.getTime() > post.expiresAt.getTime()) break; // não adianta olhar slots depois da expiração
        const usage = slotUsage.get(slot.getTime());
        const conflict = usage && (usage.entityIds.has(post.entityId) || usage.eventTypes.has(post.eventType));
        if (!conflict) {
          chosenSlot = slot;
          break;
        }
      }
    }
    // sem slot livre respeitando diversidade antes da expiração: força o primeiro slot disponível mesmo assim
    if (!chosenSlot) chosenSlot = upcoming.find((s) => !post.expiresAt || s.getTime() <= post.expiresAt.getTime()) ?? upcoming[0];
    if (!chosenSlot) continue;

    const slotTime = chosenSlot.getTime();
    if (!slotUsage.has(slotTime)) slotUsage.set(slotTime, { entityIds: new Set(), eventTypes: new Set() });
    slotUsage.get(slotTime)!.entityIds.add(post.entityId);
    slotUsage.get(slotTime)!.eventTypes.add(post.eventType);

    const assignedPlatforms = enabledPlatforms.map((p) => p.platform);
    const publicationsData = assignedPlatforms.map((platform) => ({ platform, status: SocialPublishStatus.PENDING }));

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

/**
 * Garante que o post tenha plataformas/publicações atribuídas antes de
 * publicar. Necessário para posts criados manualmente (bypassam assignSlots,
 * que é quem normalmente cria as SocialPostPublication) — sem isso, "Publicar
 * agora"/"Tentar de novo" não tinham nada para publicar e o post ficava
 * PUBLISHED sem nada ter sido enviado (nenhuma publicação = nenhuma falha).
 * No-op se o post já tem publicações.
 */
export async function ensurePlatformsAssigned(postId: string): Promise<void> {
  await ensureDefaultConfigs();
  const existing = await prisma.socialPostPublication.count({ where: { socialPostId: postId } });
  if (existing > 0) return;

  const enabledPlatforms = (await prisma.socialPlatformConfig.findMany({ where: { enabled: true } })).map((p) => p.platform);
  await prisma.socialPost.update({
    where: { id: postId },
    data: {
      platforms: enabledPlatforms,
      publications: { create: enabledPlatforms.map((platform) => ({ platform, status: SocialPublishStatus.PENDING })) },
    },
  });
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

  const CHART_TARGET_URL: Partial<Record<string, string>> = {
    GLOBAL100_PUBLISHED: "/global/100",
    AIRPLAY_PUBLISHED: "/global/airplay",
    ALBUMS_CHART_PUBLISHED: "/global/albums",
  };
  const targetUrl =
    post.entityType === "album" ? `/criticsfm/${post.entityId}` : (CHART_TARGET_URL[post.eventType] ?? "/");

  let telegramImageBuffer: Buffer | null = null;
  if (post.imageTelegram11) {
    const diskPath = socialImageDiskPath(post.imageTelegram11);
    if (diskPath) {
      try {
        telegramImageBuffer = await fs.readFile(diskPath);
      } catch {
        telegramImageBuffer = null;
      }
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
  const publishedCount = finalPublications.filter((p) => p.status === SocialPublishStatus.PUBLISHED).length;
  const failedCount = finalPublications.filter((p) => p.status === SocialPublishStatus.FAILED).length;

  // Sem nenhuma publicação (ex.: post criado manualmente sem passar por
  // assignSlots) não é sucesso — nada foi de fato enviado a rede nenhuma.
  const finalStatus =
    finalPublications.length === 0
      ? SocialPostStatus.FAILED
      : publishedCount === 0 && failedCount > 0
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
      lastError:
        finalPublications.length === 0
          ? "Nenhuma plataforma atribuída a este post (ver ação 'Atribuir plataformas')."
          : failedCount > 0
            ? (finalPublications.find((p) => p.status === SocialPublishStatus.FAILED)?.error ?? null)
            : null,
    },
  });
}

/** Ponto de entrada do cron: agenda pendentes e publica os que já chegaram no slot. */
export async function runSchedulerTick(now: Date = new Date()) {
  const assigned = await assignSlots(now);
  const published = await generateAndPublishDue(now);
  return { ...assigned, ...published };
}

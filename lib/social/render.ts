import fs from "node:fs/promises";
import path from "node:path";
import { SocialEventType } from "@prisma/client";
import { renderReviewCard } from "@/lib/social/review-card";
import { renderChartTop3Card } from "@/lib/social/chart-card";
import { loadAlbumReviewContent, toReviewCardInput } from "@/lib/social/content/album-review";
import { loadChartTop3Content, type ChartTop3EventType } from "@/lib/social/content/chart-top3";
import { buildHashtags } from "@/lib/social/hashtags";
import { buildAlbumReviewCaptions, buildChartTop3Captions, type PlatformCaptions } from "@/lib/social/captions";
import { scoreLabel } from "@/lib/album-score";

const CHART_TOP3_EVENT_TYPES: SocialEventType[] = [
  SocialEventType.GLOBAL100_PUBLISHED,
  SocialEventType.AIRPLAY_PUBLISHED,
  SocialEventType.ALBUMS_CHART_PUBLISHED,
];

export type RenderedAssets = {
  captions: PlatformCaptions;
  hashtags: string[];
  imageFeed45: string; // caminho público (/generated/social/...)
  imageTelegram11: string;
  imageStory916: string;
};

async function saveVariant(postId: string, variant: "feed45" | "story916" | "telegram11", png: Buffer): Promise<string> {
  const dir = path.join(process.cwd(), "public", "generated", "social", postId);
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${variant}.png`;
  await fs.writeFile(path.join(dir, fileName), png);
  return `/generated/social/${postId}/${fileName}`;
}

/** Gera as 3 artes + legendas para um SocialPost, de acordo com o tipo de evento. Retorna null se o tipo não tem template implementado ainda. */
export async function renderSocialPostAssets(postId: string, eventType: SocialEventType, entityId: string): Promise<RenderedAssets | null> {
  if (eventType === SocialEventType.ALBUM_REVIEW_MILESTONE || eventType === SocialEventType.ALBUM_CLUB_WINNER) {
    const content = await loadAlbumReviewContent(Number(entityId), eventType);
    if (!content) return null;

    const cardInput = toReviewCardInput(content);
    const [feed45, story916, telegram11] = await Promise.all([
      renderReviewCard(cardInput, "feed45"),
      renderReviewCard(cardInput, "story916"),
      renderReviewCard(cardInput, "telegram11"),
    ]);
    if (!feed45 || !story916 || !telegram11) return null;

    const hashtags = buildHashtags([content.albumArtist]);
    const captions = buildAlbumReviewCaptions({
      kind: eventType,
      albumTitle: content.albumTitle,
      albumArtist: content.albumArtist,
      scoreLabelText: scoreLabel(content.rating),
      rating: content.rating,
      targetUrl: content.targetUrl,
      narrativeLine: content.narrativeLine,
      hashtags,
    });

    const [imageFeed45, imageStory916, imageTelegram11] = await Promise.all([
      saveVariant(postId, "feed45", feed45),
      saveVariant(postId, "story916", story916),
      saveVariant(postId, "telegram11", telegram11),
    ]);

    return { captions, hashtags, imageFeed45, imageTelegram11, imageStory916 };
  }

  if (CHART_TOP3_EVENT_TYPES.includes(eventType)) {
    const content = await loadChartTop3Content(eventType as ChartTop3EventType, Number(entityId));
    if (!content || content.top3.length === 0) return null;

    const [feed45, story916, telegram11] = await Promise.all([
      renderChartTop3Card(content, "feed45"),
      renderChartTop3Card(content, "story916"),
      renderChartTop3Card(content, "telegram11"),
    ]);
    if (!feed45 || !story916 || !telegram11) return null;

    const captions = buildChartTop3Captions({
      chartName: content.chartName,
      weekLabel: content.weekLabel,
      top3: content.top3.slice(0, 3), // legenda continua Top 3 — só a arte do story mostra até 5
      editorialLine: content.editorialLine,
      targetUrl: content.targetUrl,
      hashtags: content.hashtags,
    });

    const [imageFeed45, imageStory916, imageTelegram11] = await Promise.all([
      saveVariant(postId, "feed45", feed45),
      saveVariant(postId, "story916", story916),
      saveVariant(postId, "telegram11", telegram11),
    ]);

    return { captions, hashtags: content.hashtags, imageFeed45, imageTelegram11, imageStory916 };
  }

  // Copa/Push: templates ainda não implementados nesta primeira leva.
  return null;
}

/**
 * Recalcula só as legendas (novo texto narrativo variado), sem regerar as artes — usado pelo botão
 * "gerar nova variação" no admin, para não precisar re-renderizar imagem toda vez que o texto muda.
 */
export async function regenerateSocialPostCaptions(eventType: SocialEventType, entityId: string): Promise<{ captions: PlatformCaptions; hashtags: string[] } | null> {
  if (eventType === SocialEventType.ALBUM_REVIEW_MILESTONE || eventType === SocialEventType.ALBUM_CLUB_WINNER) {
    const content = await loadAlbumReviewContent(Number(entityId), eventType);
    if (!content) return null;

    const hashtags = buildHashtags([content.albumArtist]);
    const captions = buildAlbumReviewCaptions({
      kind: eventType,
      albumTitle: content.albumTitle,
      albumArtist: content.albumArtist,
      scoreLabelText: scoreLabel(content.rating),
      rating: content.rating,
      targetUrl: content.targetUrl,
      narrativeLine: content.narrativeLine,
      hashtags,
    });
    return { captions, hashtags };
  }

  if (CHART_TOP3_EVENT_TYPES.includes(eventType)) {
    const content = await loadChartTop3Content(eventType as ChartTop3EventType, Number(entityId));
    if (!content || content.top3.length === 0) return null;

    const captions = buildChartTop3Captions({
      chartName: content.chartName,
      weekLabel: content.weekLabel,
      top3: content.top3.slice(0, 3),
      editorialLine: content.editorialLine,
      targetUrl: content.targetUrl,
      hashtags: content.hashtags,
    });
    return { captions, hashtags: content.hashtags };
  }

  return null;
}

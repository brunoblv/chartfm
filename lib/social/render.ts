import fs from "node:fs/promises";
import path from "node:path";
import { SocialEventType } from "@prisma/client";
import { renderReviewCard } from "@/lib/social/review-card";
import { loadAlbumReviewContent, toReviewCardInput } from "@/lib/social/content/album-review";
import { buildHashtags } from "@/lib/social/hashtags";
import { buildAlbumReviewCaptions, type PlatformCaptions } from "@/lib/social/captions";
import { scoreLabel } from "@/lib/album-score";

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
    const content = await loadAlbumReviewContent(Number(entityId));
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
      hashtags,
    });

    const [imageFeed45, imageStory916, imageTelegram11] = await Promise.all([
      saveVariant(postId, "feed45", feed45),
      saveVariant(postId, "story916", story916),
      saveVariant(postId, "telegram11", telegram11),
    ]);

    return { captions, hashtags, imageFeed45, imageTelegram11, imageStory916 };
  }

  // Charts/Copa/Push: templates ainda não implementados nesta primeira leva.
  return null;
}

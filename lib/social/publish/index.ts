import type { SocialPlatform } from "@prisma/client";
import { publishToTelegram } from "@/lib/social/publish/telegram";
import { publishToFacebook } from "@/lib/social/publish/facebook";
import { publishToInstagram } from "@/lib/social/publish/instagram";
import { publishToThreads } from "@/lib/social/publish/threads";
import { absoluteSocialUrl } from "@/lib/social/config";
import type { PublishResult } from "@/lib/social/publish/shared";

export type { PublishResult };

export type PostAssets = {
  captionInstagram: string | null;
  captionFacebook: string | null;
  captionThreads: string | null;
  captionTelegram: string | null;
  imageFeed45: string | null;
  imageTelegram11: string | null;
  imageStory916: string | null;
  targetUrl: string;
};

/**
 * Publica um SocialPost em uma plataforma específica. Cada implementação
 * (lib/social/publish/{facebook,instagram,threads,telegram}.ts) é best-effort e
 * nunca lança — o resultado sempre chega como {ok, externalId?, error?}.
 */
export async function publishToPlatform(platform: SocialPlatform, assets: PostAssets): Promise<PublishResult> {
  const feed45Url = assets.imageFeed45 ? absoluteSocialUrl(assets.imageFeed45) : null;
  const story916Url = assets.imageStory916 ? absoluteSocialUrl(assets.imageStory916) : null;

  switch (platform) {
    case "TELEGRAM": {
      // sendTelegramPhoto espera o buffer da imagem; quem chama já tem o Buffer gerado (ver scheduler.ts).
      throw new Error("TELEGRAM deve ser publicado via publishTelegramWithImage, não publishToPlatform");
    }
    case "FACEBOOK": {
      if (!feed45Url || !assets.captionFacebook) return { ok: false, error: "Faltam legenda/arte do Facebook" };
      return publishToFacebook(assets.captionFacebook, feed45Url);
    }
    case "INSTAGRAM_FEED": {
      if (!feed45Url || !assets.captionInstagram) return { ok: false, error: "Faltam legenda/arte do Instagram Feed" };
      return publishToInstagram(assets.captionInstagram, feed45Url, "FEED");
    }
    case "INSTAGRAM_STORY": {
      if (!story916Url) return { ok: false, error: "Falta arte do Story" };
      return publishToInstagram("", story916Url, "STORIES");
    }
    case "THREADS": {
      if (!feed45Url || !assets.captionThreads) return { ok: false, error: "Faltam legenda/arte do Threads" };
      return publishToThreads(assets.captionThreads, feed45Url);
    }
    default:
      return { ok: false, error: `Plataforma desconhecida: ${platform}` };
  }
}

export { publishToTelegram };

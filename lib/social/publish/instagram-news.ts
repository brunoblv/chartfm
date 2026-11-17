import { isInstagramConfigured } from "@/lib/social/config";
import {
  isSocialPlatformConfigured,
  resolveSocialAccessToken,
  resolveSocialAccountId,
} from "@/lib/social/credentials/token-resolver";
import { GRAPH_BASE, publishToInstagram, waitForContainerReady } from "@/lib/social/publish/instagram";
import { timedFetch, type PublishResult } from "@/lib/social/publish/shared";

/**
 * Publicação dos posts da central de notícias: imagem única, carrossel e
 * Reel. Mesmo fluxo de container em 2 passos de instagram.ts; todas as URLs
 * de mídia precisam ser públicas e absolutas.
 */

// Vídeo leva bem mais que imagem para o Instagram processar.
const VIDEO_POLL_ATTEMPTS = 60;
const VIDEO_POLL_DELAY_MS = 5000;

async function credentials(): Promise<{ igUserId: string; token: string } | null> {
  if (!(await isSocialPlatformConfigured("INSTAGRAM")) && !isInstagramConfigured()) return null;
  const igUserId = await resolveSocialAccountId("INSTAGRAM");
  const token = await resolveSocialAccessToken("INSTAGRAM");
  if (!igUserId || !token) return null;
  return { igUserId, token };
}

function errorOf(res: Awaited<ReturnType<typeof timedFetch>>): string {
  return res.json?.error?.message ?? (res as { error?: string }).error ?? `HTTP ${res.status}`;
}

async function createContainer(igUserId: string, body: Record<string, string>): Promise<{ id: string } | { error: string }> {
  const res = await timedFetch(`${GRAPH_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.json?.id) return { error: errorOf(res) };
  return { id: res.json.id as string };
}

async function publishContainer(igUserId: string, token: string, creationId: string): Promise<PublishResult> {
  const res = await timedFetch(`${GRAPH_BASE}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: creationId, access_token: token }),
  });
  if (!res.ok || !res.json?.id) return { ok: false, error: errorOf(res) };
  return { ok: true, externalId: res.json.id as string };
}

export async function publishNewsImage(caption: string, imageUrl: string): Promise<PublishResult> {
  return publishToInstagram(caption, imageUrl, "FEED");
}

export async function publishNewsCarousel(caption: string, imageUrls: string[]): Promise<PublishResult> {
  if (imageUrls.length < 2 || imageUrls.length > 10) return { ok: false, error: "Carrossel precisa de 2 a 10 imagens" };
  const creds = await credentials();
  if (!creds) return { ok: false, error: "Instagram não configurado" };
  const { igUserId, token } = creds;

  const children: string[] = [];
  for (const url of imageUrls) {
    const child = await createContainer(igUserId, { image_url: url, is_carousel_item: "true", access_token: token });
    if ("error" in child) return { ok: false, error: `Slide ${children.length + 1}: ${child.error}` };
    if (!(await waitForContainerReady(child.id, token))) {
      return { ok: false, error: `Slide ${children.length + 1}: container não ficou pronto` };
    }
    children.push(child.id);
  }

  const parent = await createContainer(igUserId, {
    media_type: "CAROUSEL",
    children: children.join(","),
    caption,
    access_token: token,
  });
  if ("error" in parent) return { ok: false, error: parent.error };
  if (!(await waitForContainerReady(parent.id, token))) return { ok: false, error: "Carrossel não ficou pronto (timeout/erro)" };

  return publishContainer(igUserId, token, parent.id);
}

export async function publishNewsReel(caption: string, videoUrl: string, coverUrl: string | null): Promise<PublishResult> {
  const creds = await credentials();
  if (!creds) return { ok: false, error: "Instagram não configurado" };
  const { igUserId, token } = creds;

  const body: Record<string, string> = {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    share_to_feed: "true",
    access_token: token,
  };
  if (coverUrl) body.cover_url = coverUrl;

  const container = await createContainer(igUserId, body);
  if ("error" in container) return { ok: false, error: container.error };
  if (!(await waitForContainerReady(container.id, token, VIDEO_POLL_ATTEMPTS, VIDEO_POLL_DELAY_MS))) {
    return { ok: false, error: "Vídeo não ficou pronto no Instagram (timeout/erro de processamento)" };
  }
  return publishContainer(igUserId, token, container.id);
}

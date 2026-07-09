import { isFacebookConfigured } from "@/lib/social/config";
import { timedFetch, type PublishResult } from "@/lib/social/publish/shared";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

/** Publica uma foto com legenda na Página do Facebook via Graph API. imageUrl precisa ser pública (não localhost). */
export async function publishToFacebook(caption: string, imageUrl: string): Promise<PublishResult> {
  if (!isFacebookConfigured()) return { ok: false, error: "Facebook não configurado" };

  const pageId = process.env.FACEBOOK_PAGE_ID!.trim();
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN!.trim();

  const res = await timedFetch(`${GRAPH_BASE}/${pageId}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: imageUrl, caption, access_token: token }),
  });

  if (!res.ok) {
    const message = res.json?.error?.message ?? (res as any).error ?? `HTTP ${res.status}`;
    console.error("[social/facebook] falha ao publicar", message);
    return { ok: false, error: message };
  }
  return { ok: true, externalId: res.json?.post_id ?? res.json?.id };
}

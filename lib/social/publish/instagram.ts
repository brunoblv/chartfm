import { isInstagramConfigured } from "@/lib/social/config";
import { timedFetch, type PublishResult } from "@/lib/social/publish/shared";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";
const POLL_MAX_ATTEMPTS = 8;
const POLL_DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForContainerReady(containerId: string, token: string): Promise<boolean> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    const res = await timedFetch(`${GRAPH_BASE}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`);
    const status = res.json?.status_code;
    if (status === "FINISHED") return true;
    if (status === "ERROR") return false;
    await sleep(POLL_DELAY_MS);
  }
  return false;
}

/** Publica no Instagram (Feed ou Stories) via Graph API — fluxo de container em 2 passos. imageUrl precisa ser pública. */
export async function publishToInstagram(caption: string, imageUrl: string, target: "FEED" | "STORIES"): Promise<PublishResult> {
  if (!isInstagramConfigured()) return { ok: false, error: "Instagram não configurado" };

  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID!.trim();
  const token = process.env.INSTAGRAM_ACCESS_TOKEN!.trim();

  const createBody: Record<string, string> = { image_url: imageUrl, access_token: token };
  if (target === "FEED") createBody.caption = caption;
  else createBody.media_type = "STORIES";

  const create = await timedFetch(`${GRAPH_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createBody),
  });
  if (!create.ok || !create.json?.id) {
    const message = create.json?.error?.message ?? (create as any).error ?? `HTTP ${create.status}`;
    console.error("[social/instagram] falha ao criar container", message);
    return { ok: false, error: message };
  }

  const containerId = create.json.id as string;
  const ready = await waitForContainerReady(containerId, token);
  if (!ready) return { ok: false, error: "Container do Instagram não ficou pronto (timeout/erro)" };

  const publish = await timedFetch(`${GRAPH_BASE}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerId, access_token: token }),
  });
  if (!publish.ok || !publish.json?.id) {
    const message = publish.json?.error?.message ?? (publish as any).error ?? `HTTP ${publish.status}`;
    console.error("[social/instagram] falha ao publicar container", message);
    return { ok: false, error: message };
  }

  return { ok: true, externalId: publish.json.id };
}

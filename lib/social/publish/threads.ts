import { isThreadsConfigured } from "@/lib/social/config";
import {
  isSocialPlatformConfigured,
  resolveSocialAccessToken,
  resolveSocialAccountId,
} from "@/lib/social/credentials/token-resolver";
import { timedFetch, type PublishResult } from "@/lib/social/publish/shared";

const GRAPH_BASE = "https://graph.threads.net/v1.0";
const POLL_MAX_ATTEMPTS = 8;
const POLL_DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForContainerReady(containerId: string, token: string): Promise<boolean> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    const res = await timedFetch(`${GRAPH_BASE}/${containerId}?fields=status&access_token=${encodeURIComponent(token)}`);
    const status = res.json?.status;
    if (status === "FINISHED") return true;
    if (status === "ERROR") return false;
    await sleep(POLL_DELAY_MS);
  }
  return false;
}

/** Publica no Threads (texto + imagem) via Threads Graph API — fluxo de container em 2 passos. */
export async function publishToThreads(caption: string, imageUrl: string): Promise<PublishResult> {
  if (!(await isSocialPlatformConfigured("THREADS")) && !isThreadsConfigured()) {
    return { ok: false, error: "Threads não configurado" };
  }

  const userId = await resolveSocialAccountId("THREADS");
  const token = await resolveSocialAccessToken("THREADS");
  if (!userId || !token) return { ok: false, error: "Threads não configurado" };

  const create = await timedFetch(`${GRAPH_BASE}/${userId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "IMAGE", image_url: imageUrl, text: caption, access_token: token }),
  });
  if (!create.ok || !create.json?.id) {
    const message = create.json?.error?.message ?? (create as any).error ?? `HTTP ${create.status}`;
    console.error("[social/threads] falha ao criar container", message);
    return { ok: false, error: message };
  }

  const containerId = create.json.id as string;
  const ready = await waitForContainerReady(containerId, token);
  if (!ready) return { ok: false, error: "Container do Threads não ficou pronto (timeout/erro)" };

  const publish = await timedFetch(`${GRAPH_BASE}/${userId}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerId, access_token: token }),
  });
  if (!publish.ok || !publish.json?.id) {
    const message = publish.json?.error?.message ?? (publish as any).error ?? `HTTP ${publish.status}`;
    console.error("[social/threads] falha ao publicar container", message);
    return { ok: false, error: message };
  }

  return { ok: true, externalId: publish.json.id };
}

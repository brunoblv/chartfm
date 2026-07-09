export type PublishResult = { ok: boolean; externalId?: string; error?: string };

const REQUEST_TIMEOUT_MS = 20000;

/** fetch com timeout, sem lançar — quem chama trata o retorno. */
export async function timedFetch(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: any } | { ok: false; status: 0; json: null; error: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
  } catch (err) {
    return { ok: false, status: 0, json: null, error: String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

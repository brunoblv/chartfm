import { loadImage, type Image } from "@napi-rs/canvas";
import { absoluteSocialUrl } from "@/lib/social/config";

/**
 * Carrega uma imagem remota (capa) com timeout explícito. O loadImage do
 * @napi-rs/canvas, quando recebe URL, faz o download sem timeout nenhum —
 * uma capa lenta/travada segurava a requisição até o nginx desistir (504 na
 * geração de imagens das postagens). Aqui o download usa fetch com
 * AbortSignal.timeout, e falha vira placeholder no card em vez de travar.
 *
 * O cache de promises dedupa downloads da mesma capa entre as 3 variantes
 * (feed/story/telegram) renderizadas em paralelo para o mesmo post; a entrada
 * é solta pouco depois de resolver para não segurar memória nem congelar
 * falhas transitórias.
 */

const FETCH_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 30_000;

const cache = new Map<string, Promise<Image | null>>();

export function loadRemoteImage(url: string): Promise<Image | null> {
  const abs = absoluteSocialUrl(url);
  const cached = cache.get(abs);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const res = await fetch(abs, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        // Algumas CDNs de imagem (ex.: Wikimedia) recusam requisições sem User-Agent.
        headers: { "User-Agent": "ChartFM-SocialRenderer/1.0 (+https://chartfm.com.br)" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      return await loadImage(buf);
    } catch (err) {
      console.error("[social/remote-image] falha ao carregar imagem", abs, err);
      return null;
    }
  })();

  cache.set(abs, promise);
  promise.finally(() => {
    const timer = setTimeout(() => cache.delete(abs), CACHE_TTL_MS);
    timer.unref?.();
  });
  return promise;
}

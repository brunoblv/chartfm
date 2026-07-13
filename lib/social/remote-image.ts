import { loadImage, type Image } from "@napi-rs/canvas";
import { absoluteSocialUrl } from "@/lib/social/config";

/**
 * Carrega uma imagem remota (capa) com timeout explícito. O loadImage do
 * @napi-rs/canvas, quando recebe URL, faz o download sem timeout nenhum —
 * uma capa lenta/travada segurava a requisição até o nginx desistir (504 na
 * geração de imagens das postagens). Aqui o download usa fetch com
 * AbortSignal.timeout, e falha vira placeholder no card em vez de travar.
 *
 * Se a conexão direta falhar (ex.: rota quebrada da VPS até um CDN
 * específico — visto em 2026-07-13 com i.scdn.co/Akamai retornando
 * ETIMEDOUT mesmo com o resto da internet acessível), tenta uma vez via
 * images.weserv.nl como proxy de imagem antes de desistir e cair no
 * placeholder.
 *
 * O cache de promises dedupa downloads da mesma capa entre as 3 variantes
 * (feed/story/telegram) renderizadas em paralelo para o mesmo post; a entrada
 * é solta pouco depois de resolver para não segurar memória nem congelar
 * falhas transitórias.
 */

const FETCH_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 30_000;

const cache = new Map<string, Promise<Image | null>>();

async function fetchImage(url: string): Promise<Image> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    // Algumas CDNs de imagem (ex.: Wikimedia) recusam requisições sem User-Agent.
    headers: { "User-Agent": "ChartFM-SocialRenderer/1.0 (+https://chartfm.com.br)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return await loadImage(buf);
}

function weservProxyUrl(url: string): string {
  const noScheme = url.replace(/^https?:\/\//i, "");
  return `https://images.weserv.nl/?url=${encodeURIComponent(noScheme)}`;
}

export function loadRemoteImage(url: string): Promise<Image | null> {
  const abs = absoluteSocialUrl(url);
  const cached = cache.get(abs);
  if (cached) return cached;

  const promise = (async () => {
    try {
      return await fetchImage(abs);
    } catch (directErr) {
      try {
        return await fetchImage(weservProxyUrl(abs));
      } catch (proxyErr) {
        console.error("[social/remote-image] falha ao carregar imagem (direto e via proxy)", abs, { directErr, proxyErr });
        return null;
      }
    }
  })();

  cache.set(abs, promise);
  promise.finally(() => {
    const timer = setTimeout(() => cache.delete(abs), CACHE_TTL_MS);
    timer.unref?.();
  });
  return promise;
}

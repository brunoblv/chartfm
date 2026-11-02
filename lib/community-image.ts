/**
 * Logos e capas de comunidade são gravados no banco como data-URL base64 (até
 * ~1,4 MB / 2 MB). Embutir isso no HTML repetia a imagem no markup e no payload
 * RSC — /communities chegava a ~1,9 MB. Nas páginas, use sempre a URL da rota
 * de imagem, que é cacheável pelo navegador/CDN.
 */

export type CommunityImageKind = "logo" | "cover";

/** Versão barata (sem hash do conteúdo inteiro) para invalidar cache quando a imagem muda. */
function cheapVersion(raw: string): string {
  let h = raw.length;
  const tail = raw.slice(-64);
  for (let i = 0; i < tail.length; i++) h = (h * 31 + tail.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function communityImageSrc(
  slug: string,
  kind: CommunityImageKind,
  raw: string | null | undefined,
): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (!value.startsWith("data:")) return value;
  return `/api/communities/${encodeURIComponent(slug)}/${kind}?v=${cheapVersion(value)}`;
}

export function parseImageDataUrl(raw: string | null | undefined): { mime: string; bytes: Buffer } | null {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(raw?.trim() ?? "");
  if (!m) return null;
  // SVG pode carregar script; só tipos raster.
  if (/svg/i.test(m[1])) return null;
  return { mime: m[1].toLowerCase(), bytes: Buffer.from(m[2], "base64") };
}

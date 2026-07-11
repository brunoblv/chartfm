import path from "node:path";

/**
 * Onde as artes de social ficam no disco. Continua dentro de public/ por
 * compatibilidade, mas em produção o Next só serve estáticos que existiam no
 * build — por isso as imagens são servidas pela rota /api/social-image/... ,
 * que lê daqui em runtime.
 */
export const SOCIAL_IMAGE_ROOT = path.join(process.cwd(), "public", "generated", "social");

const ALLOWED_FILES = new Set(["feed45.png", "story916.png", "telegram11.png"]);

/** URL pública (servida em runtime) para uma variante de arte de um post. */
export function socialImageUrl(postId: string, fileName: string): string {
  return `/api/social-image/${postId}/${fileName}`;
}

/**
 * Resolve a URL de arte (formato novo /api/social-image/... ou legado
 * /generated/social/...) para o caminho no disco. Retorna null se a URL não
 * tem o formato esperado — também serve de sanitização contra path traversal.
 */
export function socialImageDiskPath(urlPath: string): string | null {
  const match = urlPath.match(/^\/(?:api\/social-image|generated\/social)\/([A-Za-z0-9_-]+)\/([a-z0-9]+\.png)$/);
  if (!match) return null;
  const [, postId, fileName] = match;
  if (!ALLOWED_FILES.has(fileName)) return null;
  return path.join(SOCIAL_IMAGE_ROOT, postId, fileName);
}

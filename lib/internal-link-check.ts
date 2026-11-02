import { prisma } from "@/lib/prisma";
import { getAlbumMaturity, getArtistMaturity, getSongMaturity } from "@/lib/entity-maturity";

/**
 * Valida links internos antes de publicar um destaque/editorial: o destino tem
 * que existir como entidade e o link é reescrito para a URL canônica. Destaques
 * apontando para fichas ainda não importadas geravam 404 na home.
 */

export type LinkCheck =
  | { ok: true; href: string }
  | { ok: false; href: string; reason: string };

function internalPath(href: string): string | null {
  const value = href.trim();
  if (value.startsWith("/")) return value;
  try {
    const url = new URL(value);
    if (url.hostname === "chartfm.com.br" || url.hostname === "www.chartfm.com.br") {
      return url.pathname + url.search;
    }
  } catch {
    // não é URL absoluta
  }
  return null;
}

export async function checkInternalLink(href: string): Promise<LinkCheck> {
  const path = internalPath(href);
  if (path === null) return { ok: true, href: href.trim() }; // externo: fora do escopo
  const [pathname] = path.split("?");
  const parts = pathname.split("/").filter(Boolean);
  const [kind, slug] = parts;

  if (kind === "song" && slug) {
    const m = await getSongMaturity(slug, "pt-BR");
    return m ? { ok: true, href: m.canonicalPath } : { ok: false, href, reason: "música não encontrada" };
  }
  if (kind === "album" && slug) {
    const m = await getAlbumMaturity(slug, "pt-BR");
    return m
      ? { ok: true, href: m.canonicalPath }
      : { ok: false, href, reason: "álbum não encontrado (use a URL /album/<artistaId>_<albumId>)" };
  }
  if (kind === "artist" && slug) {
    const m = await getArtistMaturity(slug, "pt-BR");
    return m ? { ok: true, href: m.canonicalPath } : { ok: false, href, reason: "artista não encontrado" };
  }
  if (kind === "editorial" && slug) {
    const post = await prisma.editorialPost.findFirst({ where: { slug, published: true }, select: { id: true } });
    return post ? { ok: true, href: pathname } : { ok: false, href, reason: "editorial não publicado" };
  }
  if (kind === "criticsfm" && slug && /^\d+$/.test(slug)) {
    const album = await prisma.album.findUnique({ where: { id: Number(slug) }, select: { id: true } });
    return album ? { ok: true, href: pathname } : { ok: false, href, reason: "álbum não encontrado no CriticsFM" };
  }
  if (kind === "profile" && slug) {
    const user = await prisma.user.findUnique({ where: { handle: decodeURIComponent(slug) }, select: { id: true } });
    return user ? { ok: true, href: path } : { ok: false, href, reason: "perfil não encontrado" };
  }
  return { ok: true, href: path };
}

export async function checkRelatedLinks<T extends { label: string; href: string }>(
  links: T[],
): Promise<{ links: T[]; broken: { label: string; href: string; reason: string }[] }> {
  const results = await Promise.all(links.map((l) => checkInternalLink(l.href)));
  const broken = results.flatMap((r, i) => (r.ok ? [] : [{ label: links[i].label, href: r.href, reason: r.reason }]));
  return { links: links.map((l, i) => ({ ...l, href: results[i].href })), broken };
}

export function brokenLinksMessage(broken: { label: string; href: string; reason: string }[]): string {
  return `Links quebrados — importe a entidade antes de publicar: ${broken
    .map((b) => `"${b.label}" (${b.href}): ${b.reason}`)
    .join("; ")}`;
}

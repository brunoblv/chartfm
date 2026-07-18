import { redirect } from "next/navigation";

/**
 * A tela antiga de abas foi substituída pela seção /admin/dados
 * (uma tela por assunto, com paginação e layout fixo).
 * Mantemos só o mapeamento das URLs antigas.
 */
export default async function AdminDataEditRedirect({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; filtro?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const page = params.page ? `&page=${encodeURIComponent(params.page)}` : "";
  const withQ = (base: string) => (q ? `${base}?q=${encodeURIComponent(q)}` : base);

  switch (params.tab) {
    case "albums":
      redirect(q ? `/admin/dados/albuns-pendencias?filtro=todas&q=${encodeURIComponent(q)}` : "/admin/dados/albuns-pendencias");
    case "artists":
      redirect(q ? `/admin/dados/artistas-pendencias?filtro=todas&q=${encodeURIComponent(q)}` : "/admin/dados/artistas-pendencias");
    case "no-album":
      redirect(`/admin/dados/catalogo?filtro=sem-album${page}`);
    case "no-cover":
      redirect(`/admin/dados/catalogo?filtro=album-sem-capa${page}`);
    case "no-mbid":
      redirect(`/admin/dados/catalogo?filtro=sem-mbid${page}`);
    case "missing-music":
      redirect("/admin/dados/catalogo?filtro=problemas");
    case "missing-artists":
      redirect("/admin/dados/artistas-pendencias?filtro=pendencias");
    case "missing-albums":
      redirect("/admin/dados/albuns-pendencias?filtro=pendencias");
    case "music":
    default:
      redirect(withQ("/admin/dados/catalogo"));
  }
}

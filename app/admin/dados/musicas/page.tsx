import { redirect } from "next/navigation";

/**
 * A antiga "busca livre" foi unificada em /admin/dados/catalogo
 * (busca + filtros + badges de pendência numa só view).
 */
export default async function DadosMusicasRedirect({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; semSpotify?: string }>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  const q = (params.q ?? "").trim();
  if (q) qs.set("q", q);
  // semSpotify não tem equivalente exato; abre em "todas" com a busca.
  qs.set("filtro", q ? "todas" : "problemas");
  const suffix = qs.toString();
  redirect(`/admin/dados/catalogo${suffix ? `?${suffix}` : ""}`);
}

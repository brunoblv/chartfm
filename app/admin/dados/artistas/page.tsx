import { redirect } from "next/navigation";

/**
 * A antiga "busca livre" de artistas foi unificada em /admin/dados/artistas-pendencias.
 */
export default async function DadosArtistasRedirect({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const qs = new URLSearchParams();
  if (q) {
    qs.set("q", q);
    qs.set("filtro", "todas");
  } else {
    qs.set("filtro", "pendencias");
  }
  redirect(`/admin/dados/artistas-pendencias?${qs.toString()}`);
}

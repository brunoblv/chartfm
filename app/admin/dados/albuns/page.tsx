import { redirect } from "next/navigation";

/**
 * A antiga "busca livre" de álbuns foi unificada em /admin/dados/albuns-pendencias.
 */
export default async function DadosAlbunsRedirect({
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
  redirect(`/admin/dados/albuns-pendencias?${qs.toString()}`);
}

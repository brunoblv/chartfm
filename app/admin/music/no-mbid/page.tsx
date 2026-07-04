import { redirect } from "next/navigation";

export default async function AdminSongsNoMbidPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams({ filtro: "sem-mbid" });
  if (sp.page) params.set("page", sp.page);
  redirect(`/admin/dados/catalogo?${params.toString()}`);
}

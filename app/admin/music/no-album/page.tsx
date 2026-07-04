import { redirect } from "next/navigation";

export default async function AdminSongsNoAlbumPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams({ filtro: "sem-album" });
  if (sp.page) params.set("page", sp.page);
  redirect(`/admin/dados/catalogo?${params.toString()}`);
}

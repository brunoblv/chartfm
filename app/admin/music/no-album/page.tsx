import { redirect } from "next/navigation";

export default async function AdminSongsNoAlbumPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams({ tab: "no-album" });
  if (sp.filtro) params.set("filtro", sp.filtro);
  if (sp.page) params.set("page", sp.page);
  redirect(`/admin/edicao-de-dados?${params.toString()}`);
}

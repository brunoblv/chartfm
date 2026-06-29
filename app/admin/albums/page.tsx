import { redirect } from "next/navigation";

export default async function AdminAlbumsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  redirect(`/admin/edicao-de-dados?tab=albums${q ? `&q=${encodeURIComponent(q)}` : ""}`);
}

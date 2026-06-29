import { redirect } from "next/navigation";

export default async function AdminArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  redirect(`/admin/edicao-de-dados?tab=artists${q ? `&q=${encodeURIComponent(q)}` : ""}`);
}

import { redirect } from "next/navigation";

export default async function AdminArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  redirect(`/admin/dados/artistas${q ? `?q=${encodeURIComponent(q)}` : ""}`);
}

import { redirect } from "next/navigation";

export default async function AdminAlbumsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  redirect(`/admin/dados/albuns${q ? `?q=${encodeURIComponent(q)}` : ""}`);
}

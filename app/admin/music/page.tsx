import { redirect } from "next/navigation";

export default async function AdminMusicPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  redirect(`/admin/edicao-de-dados?tab=music${q ? `&q=${encodeURIComponent(q)}` : ""}`);
}

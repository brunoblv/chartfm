import { redirect } from "next/navigation";

export default async function AdminSongsNoCoverPage() {
  redirect("/admin/edicao-de-dados?tab=no-cover");
}

import { redirect } from "next/navigation";

export default async function AdminMissingInfoPage() {
  redirect("/admin/edicao-de-dados?tab=missing-info");
}

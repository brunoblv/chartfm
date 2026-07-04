import { redirect } from "next/navigation";

export default async function AdminMissingInfoPage() {
  redirect("/admin/dados/catalogo?filtro=problemas");
}

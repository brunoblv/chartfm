import { redirect } from "next/navigation";

export default async function AdminSongsNoCoverPage() {
  redirect("/admin/dados/catalogo?filtro=album-sem-capa");
}

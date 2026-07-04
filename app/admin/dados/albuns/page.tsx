import Link from "next/link";
import { adminNavChipStyle } from "@/components/admin/admin-styles";
import { CreateAlbumClient } from "../../albums/CreateAlbumClient";
import { getAdminAccess } from "../lib";
import { AccessDenied, DadosShell } from "../ui";
import { DataSearchClient } from "../DataSearchClient";

export const dynamic = "force-dynamic";

export default async function DadosAlbunsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const access = await getAdminAccess();
  if (!access) return <AccessDenied />;
  const params = await searchParams;

  return (
    <DadosShell active="albuns" subtitle="Buscar e editar álbuns" showMinhasParadas={access.isOwner}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Link href="/admin/duplicates/albums" style={adminNavChipStyle}>
          Mergear duplicados (Deluxe, Bonus…)
        </Link>
        <Link href="/admin/dados/albuns-pendencias" style={adminNavChipStyle}>
          Pendências (capa, data…)
        </Link>
      </div>
      <CreateAlbumClient />
      <DataSearchClient kind="albums" initialQuery={(params.q ?? "").trim()} />
    </DadosShell>
  );
}

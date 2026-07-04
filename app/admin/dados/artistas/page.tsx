import Link from "next/link";
import { adminNavChipStyle } from "@/components/admin/admin-styles";
import { ArtistCreatePanel } from "../../artists/ArtistCreatePanel";
import { getAdminAccess } from "../lib";
import { AccessDenied, DadosShell } from "../ui";
import { DataSearchClient } from "../DataSearchClient";

export const dynamic = "force-dynamic";

export default async function DadosArtistasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const access = await getAdminAccess();
  if (!access) return <AccessDenied />;
  const params = await searchParams;

  return (
    <DadosShell active="artistas" subtitle="Buscar e editar artistas" showMinhasParadas={access.isOwner}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Link href="/admin/dados/artistas-pendencias" style={adminNavChipStyle}>
          Pendências (imagem, gêneros…)
        </Link>
      </div>
      <ArtistCreatePanel />
      <DataSearchClient kind="artists" initialQuery={(params.q ?? "").trim()} />
    </DadosShell>
  );
}

import Link from "next/link";
import { adminNavChipStyle } from "@/components/admin/admin-styles";
import { getAdminAccess } from "../lib";
import { AccessDenied, DadosShell } from "../ui";
import { DataSearchClient } from "../DataSearchClient";

export const dynamic = "force-dynamic";

export default async function DadosMusicasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; semSpotify?: string }>;
}) {
  const access = await getAdminAccess();
  if (!access) return <AccessDenied />;
  const params = await searchParams;

  return (
    <DadosShell active="musicas" subtitle="Buscar e editar músicas" showMinhasParadas={access.isOwner}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Link href="/admin/music/versions" style={adminNavChipStyle}>
          Versões (live, remix, acoustic…)
        </Link>
        <Link href="/admin/song-genres" style={adminNavChipStyle}>
          Tags de gênero
        </Link>
        <Link href="/admin/songs/youtube-clips" style={adminNavChipStyle}>
          Video Clipes (YouTube)
        </Link>
        <Link
          href="/admin/music/new"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "7px 14px",
            borderRadius: 999,
            background: "#FA243C",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          + Adicionar música
        </Link>
      </div>
      <DataSearchClient
        kind="music"
        initialQuery={(params.q ?? "").trim()}
        initialNoSpotify={params.semSpotify === "1"}
      />
    </DadosShell>
  );
}

import { prisma } from "@/lib/prisma";
import { spotifyConfigured } from "@/lib/spotify-server";
import { SongCoversBackfillClient } from "../../albums/no-cover/SongCoversBackfillClient";
import { countSongsSemDatas, getAdminAccess, parsePage, parseSongFiltro, semCapaWhere } from "../lib";
import { AccessDenied, DadosShell } from "../ui";
import { SongAuditView } from "../SongAuditView";
import { DatesBackfillClient } from "../DatesBackfillClient";

export const dynamic = "force-dynamic";

export default async function CatalogoAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; page?: string }>;
}) {
  const access = await getAdminAccess();
  if (!access) return <AccessDenied />;

  const params = await searchParams;
  const filtro = parseSongFiltro(params.filtro, "problemas");
  const page = parsePage(params.page);

  const mostrarBackfillCapas = filtro === "sem-album" || filtro === "album-sem-capa";
  const [totalSemCapa, semDatas] = await Promise.all([
    mostrarBackfillCapas ? prisma.song.count({ where: semCapaWhere }) : Promise.resolve(0),
    countSongsSemDatas(),
  ]);

  return (
    <DadosShell active="catalogo" subtitle="Auditoria do catálogo" showMinhasParadas={access.isOwner}>
      <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--text-muted)", maxWidth: 720, lineHeight: 1.5 }}>
        A mesma auditoria das minhas paradas, aplicada a todas as músicas do catálogo.
      </p>
      <div style={{ maxWidth: 720 }}>
        <DatesBackfillClient initialTotal={semDatas} scope="catalogo" />
      </div>
      {mostrarBackfillCapas && (
        <div style={{ maxWidth: 720, marginBottom: 14 }}>
          <SongCoversBackfillClient
            initialTotal={totalSemCapa}
            spotifyConfigured={spotifyConfigured()}
          />
        </div>
      )}
      <SongAuditView basePath="/admin/dados/catalogo" filtro={filtro} page={page} />
    </DadosShell>
  );
}

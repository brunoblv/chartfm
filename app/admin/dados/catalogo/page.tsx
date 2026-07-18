import Link from "next/link";
import { adminNavChipStyle } from "@/components/admin/admin-styles";
import { prisma } from "@/lib/prisma";
import { spotifyConfigured } from "@/lib/spotify-server";
import { SongCoversBackfillClient } from "../../albums/no-cover/SongCoversBackfillClient";
import {
  countSongsProblemas,
  countSongsSemDatas,
  dadosSortQuery,
  getAdminAccess,
  parseDadosSort,
  parsePage,
  parseQuery,
  parseSongFiltro,
  semCapaWhere,
} from "../lib";
import { AccessDenied, DadosShell } from "../ui";
import { SongAuditView } from "../SongAuditView";
import { DatesBackfillClient } from "../DatesBackfillClient";

export const dynamic = "force-dynamic";

export default async function CatalogoAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; page?: string; q?: string; sort?: string; dir?: string }>;
}) {
  const access = await getAdminAccess();
  if (!access) return <AccessDenied />;

  const params = await searchParams;
  // Com busca textual, prioriza "todas"; sem busca, foca em pendências.
  const defaultFiltro = parseQuery(params.q) ? "todas" : "problemas";
  const filtro = parseSongFiltro(params.filtro, defaultFiltro);
  const page = parsePage(params.page);
  const q = parseQuery(params.q);
  const sort = parseDadosSort(params.sort, params.dir);

  const mostrarBackfillCapas = filtro === "sem-album" || filtro === "album-sem-capa";
  const [totalSemCapa, semDatas, problemCount] = await Promise.all([
    mostrarBackfillCapas ? prisma.song.count({ where: semCapaWhere }) : Promise.resolve(0),
    countSongsSemDatas(),
    countSongsProblemas(),
  ]);

  return (
    <DadosShell active="catalogo" subtitle="Busque, filtre e corrija músicas do catálogo.">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Link href="/admin/music/new" style={{ ...adminNavChipStyle, background: "#FA243C", color: "#fff", border: "none" }}>
          + Nova música
        </Link>
        <Link href="/admin/music/versions" style={adminNavChipStyle}>
          Versões
        </Link>
        <Link href="/admin/song-genres" style={adminNavChipStyle}>
          Gêneros
        </Link>
        <Link href="/admin/songs/youtube-clips" style={adminNavChipStyle}>
          Clipe YouTube
        </Link>
      </div>

      {(filtro === "sem-single" || filtro === "sem-clipe" || filtro === "datas-nao-encontradas") && (
        <div style={{ maxWidth: 720, marginBottom: 14 }}>
          <DatesBackfillClient initialTotal={semDatas} scope="catalogo" />
        </div>
      )}
      {mostrarBackfillCapas && (
        <div style={{ maxWidth: 720, marginBottom: 14 }}>
          <SongCoversBackfillClient
            initialTotal={totalSemCapa}
            spotifyConfigured={spotifyConfigured()}
          />
        </div>
      )}

      <SongAuditView
        basePath="/admin/dados/catalogo"
        filtro={filtro}
        page={page}
        q={q}
        sort={sort}
        problemCount={problemCount}
        scopeToggle={
          access.isOwner
            ? {
                href: `/admin/dados/minhas-paradas?filtro=${filtro}&page=1&${dadosSortQuery(sort)}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
                checked: false,
              }
            : undefined
        }
      />
    </DadosShell>
  );
}

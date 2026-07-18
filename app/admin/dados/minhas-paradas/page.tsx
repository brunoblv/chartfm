import {
  countSongsProblemas,
  countSongsSemDatas,
  dadosSortQuery,
  getAdminAccess,
  parseDadosSort,
  parsePage,
  parseQuery,
  parseSongFiltro,
} from "../lib";
import { AccessDenied, DadosShell } from "../ui";
import { SongAuditView } from "../SongAuditView";
import { DatesBackfillClient } from "../DatesBackfillClient";

export const dynamic = "force-dynamic";

export default async function MinhasParadasAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; page?: string; q?: string; sort?: string; dir?: string }>;
}) {
  const access = await getAdminAccess();
  if (!access) return <AccessDenied />;
  if (!access.isOwner) return <AccessDenied message="Esta seção é restrita ao @bruno." />;

  const params = await searchParams;
  const q = parseQuery(params.q);
  const defaultFiltro = q ? "todas" : "problemas";
  const filtro = parseSongFiltro(params.filtro, defaultFiltro);
  const page = parsePage(params.page);
  const sort = parseDadosSort(params.sort, params.dir);
  const [semDatas, problemCount] = await Promise.all([
    countSongsSemDatas(access.userId),
    countSongsProblemas(),
  ]);

  return (
    <DadosShell active="minhas-paradas" subtitle="Músicas das minhas paradas">
      {(filtro === "sem-single" || filtro === "sem-clipe" || filtro === "datas-nao-encontradas") && (
        <div style={{ maxWidth: 720, marginBottom: 14 }}>
          <DatesBackfillClient initialTotal={semDatas} scope="minhas" />
        </div>
      )}
      <SongAuditView
        basePath="/admin/dados/minhas-paradas"
        userId={access.userId}
        filtro={filtro}
        page={page}
        q={q}
        sort={sort}
        problemCount={problemCount}
        scopeToggle={{
          href: `/admin/dados/catalogo?filtro=${filtro}&page=1&${dadosSortQuery(sort)}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
          checked: true,
        }}
      />
    </DadosShell>
  );
}

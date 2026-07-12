import { countSongsSemDatas, getAdminAccess, parsePage, parseQuery, parseSongFiltro } from "../lib";
import { AccessDenied, DadosShell } from "../ui";
import { SongAuditView } from "../SongAuditView";
import { DatesBackfillClient } from "../DatesBackfillClient";

export const dynamic = "force-dynamic";

export default async function MinhasParadasAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; page?: string; q?: string }>;
}) {
  const access = await getAdminAccess();
  if (!access) return <AccessDenied />;
  if (!access.isOwner) return <AccessDenied message="Esta seção é restrita ao @bruno." />;

  const params = await searchParams;
  const filtro = parseSongFiltro(params.filtro, "todas");
  const page = parsePage(params.page);
  const q = parseQuery(params.q);
  const semDatas = await countSongsSemDatas(access.userId);

  return (
    <DadosShell active="minhas-paradas" subtitle="Músicas das minhas paradas" showMinhasParadas>
      <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--text-muted)", maxWidth: 720, lineHeight: 1.5 }}>
        Todas as músicas que já apareceram em alguma das suas paradas (paradas de comunidade e
        excluídas ficam de fora), com o status de álbum, capa, MBID e datas de lançamento.
      </p>
      <div style={{ maxWidth: 720 }}>
        <DatesBackfillClient initialTotal={semDatas} scope="minhas" />
      </div>
      <SongAuditView
        basePath="/admin/dados/minhas-paradas"
        userId={access.userId}
        filtro={filtro}
        page={page}
        q={q}
        scopeToggle={{
          href: `/admin/dados/catalogo?filtro=${filtro}&page=1${q ? `&q=${encodeURIComponent(q)}` : ""}`,
          checked: true,
        }}
      />
    </DadosShell>
  );
}

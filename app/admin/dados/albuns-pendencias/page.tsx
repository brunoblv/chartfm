import {
  ALBUM_FILTROS,
  fetchAlbumAudit,
  getAdminAccess,
  parseAlbumFiltro,
  parsePage,
  type AlbumFiltro,
} from "../lib";
import { AccessDenied, AlbumAuditTable, DadosShell, FilterChips, Pagination, ResultInfo } from "../ui";

export const dynamic = "force-dynamic";

const DESCRICAO: Record<AlbumFiltro, string> = {
  pendencias: "Álbuns sem capa, sem data, sem tipo ou sem total de faixas.",
  "sem-capa": "Álbuns sem capa (regra: todo álbum tem uma capa).",
  "sem-data": "Álbuns sem data de lançamento.",
  "data-01-01": "Datas em 01/01 — pode indicar data incompleta na fonte.",
  todas: "Todos os álbuns do catálogo.",
};

export default async function AlbunsPendenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; page?: string }>;
}) {
  const access = await getAdminAccess();
  if (!access) return <AccessDenied />;

  const params = await searchParams;
  const filtro = parseAlbumFiltro(params.filtro);
  const page = parsePage(params.page);
  const result = await fetchAlbumAudit({ filtro, page });
  const hrefFor = (f: AlbumFiltro, p: number) => `/admin/dados/albuns-pendencias?filtro=${f}&page=${p}`;

  return (
    <DadosShell active="albuns-pendencias" subtitle="Álbuns · pendências" showMinhasParadas={access.isOwner}>
      <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--text-muted)", maxWidth: 720, lineHeight: 1.5 }}>
        Corrigir a capa ou a data de um álbum aqui resolve o problema para todas as músicas dele
        de uma vez.
      </p>
      <FilterChips
        items={ALBUM_FILTROS.map((f) => ({
          key: f.key,
          label: f.label,
          href: hrefFor(f.key, 1),
          active: f.key === filtro,
        }))}
      />
      <ResultInfo
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
        descricao={DESCRICAO[filtro]}
      />
      <AlbumAuditTable rows={result.rows} emptyLabel="Nenhum álbum neste filtro. 🎉" />
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        hrefFor={(p) => hrefFor(filtro, p)}
      />
    </DadosShell>
  );
}

import {
  SONG_FILTROS,
  SONG_FILTRO_DESCRICAO,
  fetchSongAudit,
  type SongFiltro,
} from "./lib";
import { FilterChips, Pagination, ResultInfo, SongAuditTable } from "./ui";

/**
 * Corpo compartilhado das telas de auditoria de músicas
 * (Minhas paradas = escopo do usuário; Catálogo = tudo).
 */
export async function SongAuditView({
  basePath,
  userId,
  filtro,
  page,
}: {
  basePath: string;
  userId?: string;
  filtro: SongFiltro;
  page: number;
}) {
  const result = await fetchSongAudit({ userId, filtro, page });
  const hrefFor = (f: SongFiltro, p: number) => `${basePath}?filtro=${f}&page=${p}`;

  return (
    <>
      <FilterChips
        items={SONG_FILTROS.map((f) => ({
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
        descricao={SONG_FILTRO_DESCRICAO[filtro]}
      />
      <SongAuditTable rows={result.rows} emptyLabel="Nenhuma música neste filtro. 🎉" />
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        hrefFor={(p) => hrefFor(filtro, p)}
      />
    </>
  );
}

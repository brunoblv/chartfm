import Link from "next/link";
import { adminNavChipStyle } from "@/components/admin/admin-styles";
import {
  ALBUM_FILTROS,
  countAlbunsPendencias,
  fetchAlbumAudit,
  getAdminAccess,
  parseAlbumFiltro,
  parseDadosSort,
  parsePage,
  parseQuery,
  type AlbumFiltro,
  type DadosSort,
} from "../lib";
import {
  AccessDenied,
  AlbumAuditTable,
  DadosShell,
  FilterChips,
  Pagination,
  ResultInfo,
  SearchBox,
  SortChips,
  dadosListQuery,
} from "../ui";
import { BackfillDrawerButton } from "../SourceBatchBackfillClient";

export const dynamic = "force-dynamic";

const DESCRICAO: Record<AlbumFiltro, string> = {
  pendencias: "Álbuns sem capa, sem data, sem tipo ou sem total de faixas.",
  "sem-capa": "Álbuns sem capa (regra: todo álbum tem uma capa).",
  "sem-data": "Álbuns sem data de lançamento.",
  "data-01-01": "Datas em 01/01 — pode indicar data incompleta na fonte.",
  "metadados-nao-encontrados": "Backfill automático (Spotify) já tentou e não achou capa, data, tipo ou total de faixas.",
  todas: "Todos os álbuns do catálogo.",
};

export default async function AlbunsUnificadosPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; page?: string; q?: string; sort?: string; dir?: string }>;
}) {
  const access = await getAdminAccess();
  if (!access) return <AccessDenied />;

  const params = await searchParams;
  const q = parseQuery(params.q);
  const defaultFiltro: AlbumFiltro = q ? "todas" : "pendencias";
  const filtro = parseAlbumFiltro(params.filtro, defaultFiltro);
  const page = parsePage(params.page);
  const sort = parseDadosSort(params.sort, params.dir);
  const [result, problemCount] = await Promise.all([
    fetchAlbumAudit({ filtro, page, q, sort }),
    countAlbunsPendencias(),
  ]);
  const hrefFor = (f: AlbumFiltro, p: number, s: DadosSort = sort) =>
    `/admin/dados/albuns-pendencias${dadosListQuery({ filtro: f, q, sort: s, page: p })}`;

  return (
    <DadosShell active="albuns-pendencias" subtitle="Busque, filtre e corrija álbuns.">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Link href="/admin/albums" style={{ ...adminNavChipStyle, background: "#FA243C", color: "#fff", border: "none" }}>
          + Novo álbum
        </Link>
        <Link href="/admin/duplicates/albums" style={adminNavChipStyle}>
          Mergear duplicados
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <SearchBox
          action="/admin/dados/albuns-pendencias"
          q={q}
          filtro={filtro}
          sort={sort}
          placeholder="Buscar álbum ou artista"
          hideSubmit
        />
        <BackfillDrawerButton
          kind="albums"
          initialTotal={problemCount}
          description="Roda todas as APIs juntas ou uma de cada vez para todos os álbuns com pendência (capa, data, tipo, faixas). Fontes já marcadas como «sem resultado» são puladas."
        />
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginLeft: "auto", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {result.total.toLocaleString("pt-BR")} resultado{result.total === 1 ? "" : "s"}
          </span>
          <SortChips sort={sort} hrefFor={(next) => hrefFor(filtro, 1, next)} />
        </div>
      </div>

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
      <AlbumAuditTable
        rows={result.rows}
        emptyLabel={q || filtro !== "todas" ? "Nenhum resultado para esses filtros." : "Nenhum álbum neste filtro. 🎉"}
      />
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        hrefFor={(p) => hrefFor(filtro, p)}
      />
    </DadosShell>
  );
}

import Link from "next/link";
import {
  SONG_FILTROS,
  SONG_FILTRO_DESCRICAO,
  fetchSongAudit,
  type DadosSort,
  type SongFiltro,
} from "./lib";
import { FilterChips, Pagination, ResultInfo, SearchBox, SongAuditTable, SortChips, dadosListQuery } from "./ui";
import { BackfillDrawerButton } from "./SourceBatchBackfillClient";

/**
 * Corpo compartilhado das telas unificadas de músicas
 * (busca + filtros + ordenação + badges; backfill em lote no drawer).
 */
export async function SongAuditView({
  basePath,
  userId,
  filtro,
  page,
  q = "",
  sort,
  scopeToggle,
  problemCount = 0,
}: {
  basePath: string;
  userId?: string;
  filtro: SongFiltro;
  page: number;
  q?: string;
  sort: DadosSort;
  /** Alterna entre catálogo completo e "minhas paradas" — só aparece para o dono. */
  scopeToggle?: { href: string; checked: boolean };
  /** Total de músicas com pendência — usado no botão do drawer de backfill. */
  problemCount?: number;
}) {
  const result = await fetchSongAudit({ userId, filtro, page, q, sort });
  const hrefFor = (f: SongFiltro, p: number, s: DadosSort = sort) =>
    `${basePath}${dadosListQuery({ filtro: f, q, sort: s, page: p })}`;

  return (
    <>
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
          action={basePath}
          q={q}
          filtro={filtro}
          sort={sort}
          placeholder="Buscar por música ou artista"
          hideSubmit
        />
        <BackfillDrawerButton
          kind="music"
          initialTotal={problemCount}
          description="Roda todas as APIs juntas ou uma de cada vez para todas as músicas com pendência (álbum, capa, MBID, datas, gêneros). Fontes já marcadas como «sem resultado» são puladas."
        />
        {scopeToggle && (
          <Link
            href={scopeToggle.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              fontSize: 13,
              fontWeight: 600,
              color: scopeToggle.checked ? "#FA243C" : "var(--text-muted)",
              textDecoration: "none",
              padding: "8px 12px",
              borderRadius: 10,
              border: scopeToggle.checked
                ? "1px solid rgba(250,36,60,0.35)"
                : "1px solid var(--divider-strong)",
              background: scopeToggle.checked ? "rgba(250,36,60,0.1)" : "var(--surface)",
            }}
          >
            <input type="checkbox" readOnly checked={scopeToggle.checked} style={{ accentColor: "#FA243C" }} />
            Só minhas paradas
          </Link>
        )}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginLeft: "auto", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {result.total.toLocaleString("pt-BR")} resultado{result.total === 1 ? "" : "s"}
          </span>
          <SortChips sort={sort} hrefFor={(next) => hrefFor(filtro, 1, next)} />
        </div>
      </div>
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
      <SongAuditTable
        rows={result.rows}
        emptyLabel={q || filtro !== "todas" ? "Nenhum resultado para esses filtros." : "Nenhuma música neste filtro. 🎉"}
      />
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        hrefFor={(p) => hrefFor(filtro, p)}
      />
    </>
  );
}

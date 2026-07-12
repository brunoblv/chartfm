import Link from "next/link";
import {
  SONG_FILTROS,
  SONG_FILTRO_DESCRICAO,
  fetchSongAudit,
  type SongFiltro,
} from "./lib";
import { FilterChips, Pagination, ResultInfo, SearchBox, SongAuditTable } from "./ui";

/**
 * Corpo compartilhado das telas de auditoria de músicas
 * (Minhas paradas = escopo do usuário; Catálogo = tudo).
 */
export async function SongAuditView({
  basePath,
  userId,
  filtro,
  page,
  q = "",
  scopeToggle,
}: {
  basePath: string;
  userId?: string;
  filtro: SongFiltro;
  page: number;
  q?: string;
  /** Alterna entre catálogo completo e "minhas paradas" — só aparece para o dono. */
  scopeToggle?: { href: string; checked: boolean };
}) {
  const result = await fetchSongAudit({ userId, filtro, page, q });
  const hrefFor = (f: SongFiltro, p: number) =>
    `${basePath}?filtro=${f}&page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <SearchBox action={basePath} q={q} filtro={filtro} />
        </div>
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
              border: scopeToggle.checked ? "1px solid rgba(250,36,60,0.35)" : "1px solid var(--divider-strong)",
              background: scopeToggle.checked ? "rgba(250,36,60,0.1)" : "var(--surface)",
              marginBottom: 14,
            }}
          >
            <input type="checkbox" readOnly checked={scopeToggle.checked} style={{ accentColor: "#FA243C" }} />
            Só minhas paradas
          </Link>
        )}
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
      <SongAuditTable rows={result.rows} emptyLabel="Nenhuma música neste filtro. 🎉" />
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        hrefFor={(p) => hrefFor(filtro, p)}
      />
    </>
  );
}

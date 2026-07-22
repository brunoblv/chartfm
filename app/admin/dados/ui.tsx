import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Shell } from "@/components/layout/Shell";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { adminCompactTdStyle, adminCompactThStyle } from "@/components/admin/admin-styles";
import {
  AdminAlbumLinks,
  AdminArtistLinks,
  AdminArtistNameLink,
  AdminSongLinks,
  AdminSongNameLink,
} from "@/components/admin/AdminEntityLinks";
import type { AlbumAuditRow, ArtistAuditRow, DadosSort, DadosSortBy, SongAuditRow } from "./lib";
import { dadosSortQuery, nextDadosSort } from "./lib";
import { SourceFetchButtons } from "./SourceFetchButtons";
import { InlineDate, ReadonlyDate, EditableTagBadges } from "./InlineEdit";
import { AlbumPicker } from "./AlbumPicker";
import { YouTubeClipFetchButton } from "./YouTubeClipFetchButton";
import { ArtistRefreshImageButton } from "../artists/ArtistRefreshImageButton";
import { chartGenreSlugsForTags, getChartGenreBySlug } from "@/lib/genre-taxonomy";

// ---------------------------------------------------------------------------
// Navegação da seção
// ---------------------------------------------------------------------------

export type DadosTab =
  | "geral"
  | "minhas-paradas"
  | "catalogo"
  | "musicas"
  | "albuns"
  | "artistas"
  | "albuns-pendencias"
  | "artistas-pendencias"
  | "tags"
  | "flags";

/** Nav de 1ª classe: visão única por entidade (busca + filtros + badges de pendência). */
type DadosGroup = "geral" | "musicas" | "albuns" | "artistas" | "tags" | "flags";

const GROUP_OF: Record<DadosTab, DadosGroup> = {
  geral: "geral",
  "minhas-paradas": "musicas",
  catalogo: "musicas",
  musicas: "musicas",
  albuns: "albuns",
  "albuns-pendencias": "albuns",
  artistas: "artistas",
  "artistas-pendencias": "artistas",
  tags: "tags",
  flags: "flags",
};

const GROUPS: { key: DadosGroup; label: string; href: string }[] = [
  { key: "geral", label: "Visão geral", href: "/admin/dados" },
  { key: "musicas", label: "Músicas", href: "/admin/dados/catalogo" },
  { key: "albuns", label: "Álbuns", href: "/admin/dados/albuns-pendencias" },
  { key: "artistas", label: "Artistas", href: "/admin/dados/artistas-pendencias" },
  { key: "tags", label: "Tags", href: "/admin/dados/tags" },
  { key: "flags", label: "Sinalizações", href: "/admin/dados/flags" },
];

function navChipStyle(active: boolean): CSSProperties {
  return {
    display: "inline-block",
    padding: "9px 16px",
    borderRadius: 999,
    fontSize: 13.5,
    fontWeight: 700,
    textDecoration: "none",
    whiteSpace: "nowrap",
    border: active ? "1px solid #FA243C" : "1px solid var(--divider-strong)",
    color: active ? "#fff" : "var(--text)",
    background: active ? "#FA243C" : "var(--surface)",
  };
}

export function DadosNav({ active }: { active: DadosTab }) {
  const group = GROUP_OF[active];
  return (
    <nav style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {GROUPS.map((g) => (
          <Link key={g.key} href={g.href} style={navChipStyle(g.key === group)}>
            {g.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function DadosShell({
  active,
  subtitle,
  children,
}: {
  active: DadosTab;
  subtitle: string;
  /** A seção "Minhas paradas" hoje é acessada via toggle dentro de Músicas (não é mais aba própria). */
  showMinhasParadas?: boolean;
  children: ReactNode;
}) {
  return (
    <Shell title="Edição de dados" subtitle={subtitle}>
      <div style={{ width: "100%" }}>
        <DadosNav active={active} />
        {children}
      </div>
    </Shell>
  );
}

export function AccessDenied({ message }: { message?: string }) {
  return (
    <Shell title="Edição de dados" subtitle="Acesso">
      <div>{message ?? "Acesso negado. Faça login com uma conta de admin."}</div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Filtros e paginação
// ---------------------------------------------------------------------------

const searchFormInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 240,
  maxWidth: 420,
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 13.5,
  boxSizing: "border-box",
};

const searchFormButtonStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  color: "var(--text)",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};

/** Busca por texto (título/artista/álbum) via query string — GET simples, sem JS. */
export function SearchBox({
  action,
  q,
  filtro,
  sort,
  placeholder = "Buscar por música, artista ou álbum",
  hideSubmit = false,
}: {
  action: string;
  q: string;
  /** Filtro atual, preservado como campo oculto ao pesquisar. */
  filtro?: string;
  /** Ordenação atual, preservada ao pesquisar. */
  sort?: DadosSort;
  placeholder?: string;
  /** Quando true, só o input (submit implícito com Enter) — para toolbars densas. */
  hideSubmit?: boolean;
}) {
  const clearQs = new URLSearchParams();
  if (filtro) clearQs.set("filtro", filtro);
  if (sort) {
    clearQs.set("sort", sort.by);
    clearQs.set("dir", sort.dir);
  }
  const clearHref = clearQs.toString() ? `${action}?${clearQs}` : action;

  return (
    <form
      action={action}
      method="GET"
      style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", flex: 1, minWidth: 240 }}
    >
      {filtro && <input type="hidden" name="filtro" value={filtro} />}
      {sort && (
        <>
          <input type="hidden" name="sort" value={sort.by} />
          <input type="hidden" name="dir" value={sort.dir} />
        </>
      )}
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        style={searchFormInputStyle}
      />
      {!hideSubmit && (
        <button type="submit" style={searchFormButtonStyle}>
          Buscar
        </button>
      )}
      {q && (
        <Link href={clearHref} style={{ ...pageLinkStyle, padding: "10px 14px" }}>
          Limpar
        </Link>
      )}
    </form>
  );
}

/** Chips "Ordenar: Nome / Cadastro" — clique no ativo inverte a direção. */
export function SortChips({
  sort,
  hrefFor,
}: {
  sort: DadosSort;
  hrefFor: (next: DadosSort) => string;
}) {
  const options: { key: DadosSortBy; label: string }[] = [
    { key: "alpha", label: "Nome" },
    { key: "data", label: "Cadastro" },
  ];
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Ordenar:</span>
      {options.map((opt) => {
        const active = sort.by === opt.key;
        const arrow = active ? (sort.dir === "asc" ? "↑" : "↓") : "";
        const next = nextDadosSort(sort, opt.key);
        return (
          <Link
            key={opt.key}
            href={hrefFor(next)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 11px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 650,
              textDecoration: "none",
              whiteSpace: "nowrap",
              border: active ? "1px solid rgba(250,36,60,0.4)" : "1px solid var(--divider-strong)",
              color: active ? "#FA243C" : "var(--text)",
              background: active ? "rgba(250,36,60,0.1)" : "var(--surface)",
            }}
          >
            {`${opt.label}${arrow ? ` ${arrow}` : ""}`}
          </Link>
        );
      })}
    </div>
  );
}

/** Helper para montar query string de lista (filtro/q/sort/page). */
export function dadosListQuery(opts: {
  filtro?: string;
  q?: string;
  sort?: DadosSort;
  page?: number;
}): string {
  const qs = new URLSearchParams();
  if (opts.filtro) qs.set("filtro", opts.filtro);
  if (opts.q) qs.set("q", opts.q);
  if (opts.sort) {
    qs.set("sort", opts.sort.by);
    qs.set("dir", opts.sort.dir);
  }
  if (opts.page && opts.page > 1) qs.set("page", String(opts.page));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

// re-export para páginas que montam URLs
export { dadosSortQuery };

export function FilterChips({
  items,
}: {
  items: { key: string; label: string; href: string; active: boolean; count?: number }[];
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "7px 12px",
            borderRadius: 999,
            fontSize: 12.5,
            fontWeight: 650,
            textDecoration: "none",
            whiteSpace: "nowrap",
            background: item.active ? "rgba(250,36,60,0.1)" : "var(--surface)",
            color: item.active ? "#FA243C" : "var(--text)",
            border: item.active
              ? "1px solid rgba(250,36,60,0.4)"
              : "1px solid var(--divider-strong)",
          }}
        >
          {item.label}
          {item.count != null && (
            <span style={{ opacity: 0.7 }}>{item.count.toLocaleString("pt-BR")}</span>
          )}
        </Link>
      ))}
    </div>
  );
}

const pageLinkStyle: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  color: "var(--text)",
  fontWeight: 600,
  textDecoration: "none",
  fontSize: 13,
};

export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        marginTop: 14,
        justifyContent: "center",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      {page > 2 && (
        <Link href={hrefFor(1)} style={pageLinkStyle}>
          « Primeira
        </Link>
      )}
      {page > 1 && (
        <Link href={hrefFor(page - 1)} style={pageLinkStyle}>
          ← Anterior
        </Link>
      )}
      <span style={{ fontSize: 13, color: "var(--text-muted)", padding: "0 6px" }}>
        Página {page} de {totalPages}
      </span>
      {page < totalPages && (
        <Link href={hrefFor(page + 1)} style={pageLinkStyle}>
          Próxima →
        </Link>
      )}
      {page < totalPages - 1 && (
        <Link href={hrefFor(totalPages)} style={pageLinkStyle}>
          Última »
        </Link>
      )}
    </div>
  );
}

export function ResultInfo({ total, page, totalPages, descricao }: {
  total: number;
  page: number;
  totalPages: number;
  descricao?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
        {total.toLocaleString("pt-BR")} resultado{total === 1 ? "" : "s"}
        {descricao ? ` — ${descricao}` : ""}
      </span>
      <span style={{ fontSize: 13, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
        Página {page} / {totalPages}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Células de status
// ---------------------------------------------------------------------------

const okStyle: CSSProperties = { color: "#2D7A32", fontWeight: 700, fontSize: 12 };
const missStyle: CSSProperties = { color: "#C41E3A", fontWeight: 700, fontSize: 12 };

export function OkFlag({ ok, okLabel = "OK", missLabel = "falta" }: {
  ok: boolean;
  okLabel?: string;
  missLabel?: string;
}) {
  return <span style={ok ? okStyle : missStyle}>{ok ? okLabel : missLabel}</span>;
}

export function CoverThumb({ url, size = 32, round = false }: { url: string | null | undefined; size?: number; round?: boolean }) {
  if (url?.trim()) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        style={{ borderRadius: round ? 999 : 6, objectFit: "cover", display: "block", flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      title="Sem capa"
      style={{
        width: size,
        height: size,
        borderRadius: round ? 999 : 6,
        border: "1.5px dashed #C41E3A",
        flexShrink: 0,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Coluna única "Pendências" — mostra só o que falta, em vez de uma coluna por campo
// ---------------------------------------------------------------------------

const pendOkPillStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "#2D7A32",
  background: "var(--up-bg, #e8f6ee)",
  padding: "3px 9px",
  borderRadius: 99,
  whiteSpace: "nowrap",
};

const pendMissPillStyle: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 800,
  letterSpacing: "0.02em",
  color: "#C41E3A",
  background: "var(--down-bg, #fdeeee)",
  padding: "3px 8px",
  borderRadius: 99,
  whiteSpace: "nowrap",
};

const pendWarnPillStyle: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 800,
  color: "#B45309",
  background: "rgba(180,83,9,0.1)",
  padding: "3px 8px",
  borderRadius: 99,
  whiteSpace: "nowrap",
};

function isJan1(d: Date | string | null | undefined): boolean {
  if (!d) return false;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return false;
  return date.getUTCMonth() === 0 && date.getUTCDate() === 1;
}

/** Chips de pendência: "✓ completa" quando ok, senão um chip por campo faltando. */
export function PendBadges({
  missing,
  suspeita,
  esgotada,
}: {
  missing: string[];
  /** Data suspeita (01/01) — o MusicBrainz pode ter tido só o ano. */
  suspeita?: boolean;
  /** Backfill automático já tentou todas as fontes sem resultado. */
  esgotada?: boolean;
}) {
  if (missing.length === 0 && !suspeita && !esgotada) {
    return <span style={pendOkPillStyle}>✓ completa</span>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {missing.map((label) => (
        <span key={label} style={pendMissPillStyle}>
          {label}
        </span>
      ))}
      {suspeita && (
        <span style={pendWarnPillStyle} title="Data em 01/01 — pode ser só o ano">
          01/01?
        </span>
      )}
      {esgotada && (
        <span style={pendWarnPillStyle} title="Backfill automático já tentou todas as fontes sem resultado">
          busca esgotada
        </span>
      )}
    </div>
  );
}

/** Destaca (em vermelho) tags que mapeiam para uma categoria de parada, igual à busca livre antiga. */
function chartTagBadgeStyle(tag: string): CSSProperties {
  const cats = chartGenreSlugsForTags([tag])
    .map((slug) => getChartGenreBySlug(slug)?.name)
    .filter((n): n is string => Boolean(n));
  if (cats.length === 0) return {};
  return {
    background: "rgba(250,36,60,0.1)",
    color: "#C41E3A",
    border: "1px solid rgba(250,36,60,0.25)",
  };
}

function songMissing(s: SongAuditRow): string[] {
  const missing: string[] = [];
  const semAlbum = !s.albumSpotifyId || !s.albumRef;
  if (semAlbum) missing.push(s.album?.trim() ? "álbum não vinculado" : "sem álbum");
  else if (!s.albumRef?.coverUrl?.trim()) missing.push("capa");
  if (!s.recordingMbid?.trim()) missing.push("MBID");
  if (!s.singleReleaseDate) missing.push("single");
  if (!s.musicVideoReleaseDate && !s.youtubeReleaseDate) missing.push("clipe");
  return missing;
}

function albumMissing(a: AlbumAuditRow): string[] {
  const missing: string[] = [];
  if (!a.coverUrl?.trim()) missing.push("capa");
  if (!a.releaseDate) missing.push("data");
  if (!a.albumType) missing.push("tipo");
  if (a.totalTracks == null) missing.push("faixas");
  return missing;
}

// ---------------------------------------------------------------------------
// Tabela de auditoria de músicas (layout fixo)
// ---------------------------------------------------------------------------

const fixedTableStyle: CSSProperties = {
  width: "100%",
  minWidth: 920,
  tableLayout: "fixed",
  borderCollapse: "collapse",
};

const wideFixedTableStyle: CSSProperties = { ...fixedTableStyle, minWidth: 1100 };

const compactTh: CSSProperties = {
  ...adminCompactThStyle,
  padding: "10px 14px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const compactTd: CSSProperties = {
  ...adminCompactTdStyle,
  padding: "7px 14px",
  fontSize: 12.5,
  verticalAlign: "middle",
  borderTop: "1px solid var(--divider-soft, var(--divider))",
};

function shortChartTag(name: string | null | undefined): string {
  if (!name?.trim()) return "BB";
  const t = name.trim();
  return t.length > 12 ? `${t.slice(0, 11)}…` : t;
}

function BillboardDebutCell({
  hot100,
  genre,
  genreName,
}: {
  hot100: Date | string | null | undefined;
  genre: Date | string | null | undefined;
  genreName: string | null | undefined;
}) {
  if (!hot100 && !genre) {
    return <span style={{ color: "var(--text-muted)", fontSize: 12.5 }}>—</span>;
  }
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {hot100 ? (
        <ReadonlyDate value={hot100} title="Estreia na Billboard Hot 100" tag="H100" />
      ) : null}
      {genre ? (
        <ReadonlyDate
          value={genre}
          title={genreName ? `Estreia em ${genreName}` : "Estreia em chart Billboard"}
          tag={hot100 ? "BB" : shortChartTag(genreName)}
        />
      ) : null}
    </span>
  );
}

export function SongAuditTable({ rows, emptyLabel }: { rows: SongAuditRow[]; emptyLabel: string }) {
  return (
    <AdminPanel maxWidth={1320}>
      <div style={{ overflowX: "auto" }}>
        <table style={wideFixedTableStyle}>
          <colgroup>
            <col style={{ width: 220 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 180 }} />
            <col style={{ width: 190 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 180 }} />
          </colgroup>
          <thead>
            <tr style={{ background: "var(--fill-inset)" }}>
              <th style={compactTh}>Música</th>
              <th style={compactTh}>Pendências</th>
              <th style={compactTh}>Álbum</th>
              <th style={compactTh}>Gêneros</th>
              <th style={compactTh}>Single</th>
              <th style={compactTh}>Clipe</th>
              <th style={compactTh}>Billboard</th>
              <th style={compactTh}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const missing = songMissing(s);
              const suspeita = isJan1(s.singleReleaseDate) || isJan1(s.musicVideoReleaseDate);
              return (
                <tr key={s.id}>
                  <td style={compactTd} title={s.title}>
                    <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                      <CoverThumb url={s.albumRef?.coverUrl} size={30} />
                      <span style={{ minWidth: 0 }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: 13,
                            fontWeight: 650,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <AdminSongNameLink song={s} />
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: 11.5,
                            color: "var(--text-muted)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {s.artist}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td style={compactTd}>
                    <PendBadges missing={missing} suspeita={suspeita} esgotada={Boolean(s.releaseDatesNotFoundAt)} />
                  </td>
                  <td style={{ ...compactTd, verticalAlign: "top" }} title={s.albumRef?.title ?? s.album ?? undefined}>
                    <AlbumPicker
                      songId={s.id}
                      album={s.albumRef ? { title: s.albumRef.title, spotifyId: s.albumSpotifyId ?? "" } : null}
                      albumText={s.album}
                    />
                  </td>
                  <td style={{ ...compactTd, maxWidth: 190 }}>
                    <EditableTagBadges kind="music" id={s.id} field="genres" tags={s.genres} badgeStyle={chartTagBadgeStyle} />
                  </td>
                  <td style={compactTd}>
                    <InlineDate kind="music" id={s.id} field="singleReleaseDate" value={s.singleReleaseDate} />
                  </td>
                  <td style={compactTd}>
                    <InlineDate
                      kind="music"
                      id={s.id}
                      field="musicVideoReleaseDate"
                      value={s.musicVideoReleaseDate}
                      fallback={s.youtubeReleaseDate}
                      fallbackTag="YT"
                    />
                  </td>
                  <td style={compactTd}>
                    <BillboardDebutCell
                      hot100={s.billboardHot100DebutDate}
                      genre={s.billboardGenreChartDebutDate}
                      genreName={s.billboardGenreChartName}
                    />
                  </td>
                  <td style={compactTd}>
                    <AdminSongLinks song={s} />
                    <SourceFetchButtons kind="music" id={s.id} notFound={s.sourcesNotFound} />
                    <YouTubeClipFetchButton songId={s.id} title={s.title} artist={s.artist} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div style={{ padding: 28, textAlign: "center", color: "var(--text-muted)", fontSize: 13.5 }}>
          {emptyLabel}
        </div>
      )}
    </AdminPanel>
  );
}

// ---------------------------------------------------------------------------
// Tabela de pendências de álbuns (layout fixo)
// ---------------------------------------------------------------------------

export function AlbumAuditTable({ rows, emptyLabel }: { rows: AlbumAuditRow[]; emptyLabel: string }) {
  return (
    <AdminPanel maxWidth={1320}>
      <div style={{ overflowX: "auto" }}>
        <table style={fixedTableStyle}>
          <colgroup>
            <col style={{ width: 240 }} />
            <col style={{ width: 180 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 160 }} />
          </colgroup>
          <thead>
            <tr style={{ background: "var(--fill-inset)" }}>
              <th style={compactTh}>Álbum</th>
              <th style={compactTh}>Pendências</th>
              <th style={compactTh}>Tipo</th>
              <th style={compactTh}>Lançamento</th>
              <th style={compactTh}>Faixas</th>
              <th style={compactTh}>Músicas</th>
              <th style={compactTh}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const missing = albumMissing(a);
              const suspeita = isJan1(a.releaseDate);
              return (
                <tr key={a.id}>
                  <td style={compactTd} title={a.title}>
                    <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                      <CoverThumb url={a.coverUrl} size={30} />
                      <span style={{ minWidth: 0 }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: 13,
                            fontWeight: 650,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {a.title}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: 11.5,
                            color: "var(--text-muted)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {a.artist.name}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td style={compactTd}>
                    <PendBadges missing={missing} suspeita={suspeita} esgotada={Boolean(a.metadataNotFoundAt)} />
                  </td>
                  <td style={compactTd}>
                    {a.albumType ?? <span style={missStyle}>—</span>}
                  </td>
                  <td style={compactTd}>
                    <InlineDate kind="albums" id={a.id} field="releaseDate" value={a.releaseDate} />
                  </td>
                  <td style={compactTd}>
                    {a.totalTracks ?? <span style={missStyle}>—</span>}
                  </td>
                  <td style={{ ...compactTd, color: "var(--text-muted)" }}>
                    {a._count.songs}
                  </td>
                  <td style={compactTd}>
                    <AdminAlbumLinks album={a} />
                    <SourceFetchButtons kind="albums" id={a.id} notFound={a.sourcesNotFound} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div style={{ padding: 28, textAlign: "center", color: "var(--text-muted)", fontSize: 13.5 }}>
          {emptyLabel}
        </div>
      )}
    </AdminPanel>
  );
}

// ---------------------------------------------------------------------------
// Tabela de pendências de artistas (layout fixo)
// ---------------------------------------------------------------------------

export function ArtistAuditTable({ rows, emptyLabel }: { rows: ArtistAuditRow[]; emptyLabel: string }) {
  return (
    <AdminPanel maxWidth={1320}>
      <div style={{ overflowX: "auto" }}>
        <table style={fixedTableStyle}>
          <colgroup>
            <col style={{ width: 220 }} />
            <col style={{ width: 180 }} />
            <col style={{ width: 200 }} />
            <col style={{ width: 240 }} />
            <col style={{ width: 180 }} />
          </colgroup>
          <thead>
            <tr style={{ background: "var(--fill-inset)" }}>
              <th style={compactTh}>Artista</th>
              <th style={compactTh}>Pendências</th>
              <th style={compactTh}>Gêneros</th>
              <th style={compactTh}>Bio</th>
              <th style={compactTh}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const missing: string[] = [];
              if (!r.imageUrl) missing.push("imagem");
              if (!r.spotifyUrl) missing.push("link Spotify");
              if (r.genres.length === 0) missing.push("gêneros");
              if (!r.bio?.trim()) missing.push("bio");
              const esgotada = Boolean(r.bioNotFoundAt) || Boolean(r.metadataNotFoundAt);
              return (
                <tr key={r.id}>
                  <td style={compactTd} title={r.name}>
                    <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                      <CoverThumb url={r.imageUrl} size={30} round />
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 650,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          minWidth: 0,
                        }}
                      >
                        <AdminArtistNameLink artist={r} />
                      </span>
                    </span>
                  </td>
                  <td style={compactTd}>
                    <PendBadges missing={missing} esgotada={esgotada} />
                  </td>
                  <td style={{ ...compactTd, maxWidth: 200 }}>
                    <EditableTagBadges kind="artists" id={r.id} field="genres" tags={r.genres} badgeStyle={chartTagBadgeStyle} />
                  </td>
                  <td
                    style={{
                      ...compactTd,
                      color: "var(--text-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={r.bio ?? undefined}
                  >
                    {r.bio?.trim() ? r.bio : <span style={{ color: "var(--text-disabled)" }}>—</span>}
                  </td>
                  <td style={compactTd}>
                    <AdminArtistLinks artist={r} />
                    <ArtistRefreshImageButton artistId={r.id} />
                    <SourceFetchButtons kind="artists" id={r.id} notFound={r.sourcesNotFound} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div style={{ padding: 28, textAlign: "center", color: "var(--text-muted)", fontSize: 13.5 }}>
          {emptyLabel}
        </div>
      )}
    </AdminPanel>
  );
}

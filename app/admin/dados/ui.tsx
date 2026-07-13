import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Shell } from "@/components/layout/Shell";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { adminTdStyle, adminThStyle } from "@/components/admin/admin-styles";
import {
  AdminAlbumLinks,
  AdminArtistLinks,
  AdminArtistNameLink,
  AdminSongLinks,
  AdminSongNameLink,
} from "@/components/admin/AdminEntityLinks";
import type { AlbumAuditRow, ArtistAuditRow, SongAuditRow } from "./lib";
import { SourceFetchButtons } from "./SourceFetchButtons";
import { InlineDate } from "./InlineEdit";
import { AlbumPicker } from "./AlbumPicker";
import { YouTubeClipFetchButton } from "./YouTubeClipFetchButton";
import { ArtistRefreshImageButton } from "../artists/ArtistRefreshImageButton";

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
  | "flags";

/** Cada aba pertence a um grupo de 1ª classe — a nav mostra 5 grupos, não 9 abas soltas. */
type DadosGroup = "geral" | "musicas" | "albuns" | "artistas" | "flags";

const GROUP_OF: Record<DadosTab, DadosGroup> = {
  geral: "geral",
  "minhas-paradas": "musicas",
  catalogo: "musicas",
  musicas: "musicas",
  albuns: "albuns",
  "albuns-pendencias": "albuns",
  artistas: "artistas",
  "artistas-pendencias": "artistas",
  flags: "flags",
};

const GROUPS: { key: DadosGroup; label: string; href: string }[] = [
  { key: "geral", label: "Visão geral", href: "/admin/dados" },
  { key: "musicas", label: "Músicas", href: "/admin/dados/catalogo" },
  { key: "albuns", label: "Álbuns", href: "/admin/dados/albuns-pendencias" },
  { key: "artistas", label: "Artistas", href: "/admin/dados/artistas-pendencias" },
  { key: "flags", label: "Sinalizações", href: "/admin/dados/flags" },
];

/** Dentro de cada grupo: pendências (auditoria), busca livre (edição por texto) e cadastro (páginas fora de /admin/dados). */
const SUB_TABS: Partial<Record<DadosGroup, { key: DadosTab | "criar"; label: string; href: string }[]>> = {
  musicas: [
    { key: "catalogo", label: "Pendências", href: "/admin/dados/catalogo" },
    { key: "musicas", label: "Busca livre", href: "/admin/dados/musicas" },
    { key: "criar", label: "+ Criar música", href: "/admin/music/new" },
  ],
  albuns: [
    { key: "albuns-pendencias", label: "Pendências", href: "/admin/dados/albuns-pendencias" },
    { key: "albuns", label: "Busca livre", href: "/admin/dados/albuns" },
    { key: "criar", label: "+ Criar álbum", href: "/admin/albums" },
  ],
  artistas: [
    { key: "artistas-pendencias", label: "Pendências", href: "/admin/dados/artistas-pendencias" },
    { key: "artistas", label: "Busca livre", href: "/admin/dados/artistas" },
    { key: "criar", label: "+ Criar artista", href: "/admin/artists" },
  ],
};

function navChipStyle(active: boolean): CSSProperties {
  return {
    display: "inline-block",
    padding: "8px 14px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    textDecoration: "none",
    whiteSpace: "nowrap",
    border: active ? "1px solid #FA243C" : "1px solid var(--divider-strong)",
    color: active ? "#fff" : "var(--text)",
    background: active ? "#FA243C" : "var(--surface)",
  };
}

function subTabStyle(active: boolean): CSSProperties {
  return {
    display: "inline-block",
    padding: "6px 13px",
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 700,
    textDecoration: "none",
    whiteSpace: "nowrap",
    border: active ? "1px solid rgba(250,36,60,0.35)" : "1px solid var(--divider-strong)",
    color: active ? "#FA243C" : "var(--text-muted)",
    background: active ? "rgba(250,36,60,0.1)" : "var(--surface)",
  };
}

export function DadosNav({ active }: { active: DadosTab }) {
  const group = GROUP_OF[active];
  const subTabs = SUB_TABS[group];
  return (
    <nav style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {GROUPS.map((g) => (
          <Link key={g.key} href={g.href} style={navChipStyle(g.key === group)}>
            {g.label}
          </Link>
        ))}
      </div>
      {subTabs && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {subTabs.map((tab) => (
            <Link key={tab.key} href={tab.href} style={subTabStyle(tab.key === active)}>
              {tab.label}
            </Link>
          ))}
        </div>
      )}
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
  minWidth: 220,
  maxWidth: 420,
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 13,
  boxSizing: "border-box",
};

const searchFormButtonStyle: CSSProperties = {
  padding: "8px 14px",
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
  placeholder = "Buscar por música, artista ou álbum",
}: {
  action: string;
  q: string;
  /** Filtro atual, preservado como campo oculto ao pesquisar. */
  filtro?: string;
  placeholder?: string;
}) {
  return (
    <form
      action={action}
      method="GET"
      style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}
    >
      {filtro && <input type="hidden" name="filtro" value={filtro} />}
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        style={searchFormInputStyle}
      />
      <button type="submit" style={searchFormButtonStyle}>
        Buscar
      </button>
      {q && (
        <Link href={action} style={{ ...pageLinkStyle, padding: "8px 14px" }}>
          Limpar
        </Link>
      )}
    </form>
  );
}

export function FilterChips({
  items,
}: {
  items: { key: string; label: string; href: string; active: boolean }[];
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          style={{
            display: "inline-block",
            padding: "7px 12px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            whiteSpace: "nowrap",
            background: item.active ? "rgba(250,36,60,0.12)" : "var(--surface)",
            color: item.active ? "#FA243C" : "var(--text)",
            border: item.active
              ? "1px solid rgba(250,36,60,0.35)"
              : "1px solid var(--divider-strong)",
          }}
        >
          {item.label}
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
  minWidth: 1100,
  tableLayout: "fixed",
  borderCollapse: "collapse",
};

const cellEllipsis: CSSProperties = {
  ...adminTdStyle,
  verticalAlign: "middle",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export function SongAuditTable({ rows, emptyLabel }: { rows: SongAuditRow[]; emptyLabel: string }) {
  return (
    <AdminPanel maxWidth={1240}>
      <table style={fixedTableStyle}>
        <colgroup>
          <col style={{ width: 260 }} />
          <col style={{ width: 190 }} />
          <col style={{ width: 210 }} />
          <col style={{ width: 118 }} />
          <col style={{ width: 118 }} />
          <col style={{ width: 220 }} />
        </colgroup>
        <thead>
          <tr style={{ background: "var(--fill-inset)" }}>
            <th style={adminThStyle}>Música</th>
            <th style={adminThStyle}>Pendências</th>
            <th style={adminThStyle}>Álbum</th>
            <th style={adminThStyle}>Single</th>
            <th style={adminThStyle}>Clipe</th>
            <th style={adminThStyle}>Corrigir</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const missing = songMissing(s);
            const suspeita = isJan1(s.singleReleaseDate) || isJan1(s.musicVideoReleaseDate);
            return (
              <tr key={s.id}>
                <td style={{ ...adminTdStyle, verticalAlign: "middle" }} title={s.title}>
                  <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                    <CoverThumb url={s.albumRef?.coverUrl} size={32} />
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
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
                          fontSize: 12,
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
                <td style={{ ...adminTdStyle, verticalAlign: "middle" }}>
                  <PendBadges missing={missing} suspeita={suspeita} esgotada={Boolean(s.releaseDatesNotFoundAt)} />
                </td>
                <td style={{ ...adminTdStyle, verticalAlign: "top" }} title={s.albumRef?.title ?? s.album ?? undefined}>
                  <AlbumPicker
                    songId={s.id}
                    album={s.albumRef ? { title: s.albumRef.title, spotifyId: s.albumSpotifyId ?? "" } : null}
                    albumText={s.album}
                  />
                </td>
                <td style={{ ...adminTdStyle, verticalAlign: "middle" }}>
                  <InlineDate kind="music" id={s.id} field="singleReleaseDate" value={s.singleReleaseDate} />
                </td>
                <td style={{ ...adminTdStyle, verticalAlign: "middle" }}>
                  <InlineDate
                    kind="music"
                    id={s.id}
                    field="musicVideoReleaseDate"
                    value={s.musicVideoReleaseDate}
                    fallback={s.youtubeReleaseDate}
                    fallbackTag="YT"
                  />
                </td>
                <td style={{ ...adminTdStyle, verticalAlign: "middle" }}>
                  <AdminSongLinks song={s} />
                  <SourceFetchButtons kind="music" id={s.id} notFound={s.sourcesNotFound} />
                  <YouTubeClipFetchButton songId={s.id} title={s.title} artist={s.artist} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div style={{ padding: 16, color: "var(--text-muted)" }}>{emptyLabel}</div>
      )}
    </AdminPanel>
  );
}

// ---------------------------------------------------------------------------
// Tabela de pendências de álbuns (layout fixo)
// ---------------------------------------------------------------------------

export function AlbumAuditTable({ rows, emptyLabel }: { rows: AlbumAuditRow[]; emptyLabel: string }) {
  return (
    <AdminPanel maxWidth={1240}>
      <table style={{ ...fixedTableStyle, minWidth: 1000 }}>
        <colgroup>
          <col style={{ width: 260 }} />
          <col style={{ width: 190 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 118 }} />
          <col style={{ width: 70 }} />
          <col style={{ width: 90 }} />
          <col style={{ width: 160 }} />
        </colgroup>
        <thead>
          <tr style={{ background: "var(--fill-inset)" }}>
            <th style={adminThStyle}>Álbum</th>
            <th style={adminThStyle}>Pendências</th>
            <th style={adminThStyle}>Tipo</th>
            <th style={adminThStyle}>Lançamento</th>
            <th style={adminThStyle}>Faixas</th>
            <th style={adminThStyle}>Músicas</th>
            <th style={adminThStyle}>Corrigir</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const missing = albumMissing(a);
            const suspeita = isJan1(a.releaseDate);
            return (
              <tr key={a.id}>
                <td style={{ ...adminTdStyle, verticalAlign: "middle" }} title={a.title}>
                  <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                    <CoverThumb url={a.coverUrl} size={32} />
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
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
                          fontSize: 12,
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
                <td style={{ ...adminTdStyle, verticalAlign: "middle" }}>
                  <PendBadges missing={missing} suspeita={suspeita} esgotada={Boolean(a.metadataNotFoundAt)} />
                </td>
                <td style={{ ...adminTdStyle, verticalAlign: "middle", fontSize: 12 }}>
                  {a.albumType ?? <span style={missStyle}>falta</span>}
                </td>
                <td style={{ ...adminTdStyle, verticalAlign: "middle" }}>
                  <InlineDate kind="albums" id={a.id} field="releaseDate" value={a.releaseDate} />
                </td>
                <td style={{ ...adminTdStyle, verticalAlign: "middle" }}>
                  {a.totalTracks ?? <span style={missStyle}>falta</span>}
                </td>
                <td style={{ ...adminTdStyle, verticalAlign: "middle", color: "var(--text-muted)", fontSize: 13 }}>
                  {a._count.songs}
                </td>
                <td style={{ ...adminTdStyle, verticalAlign: "middle" }}>
                  <AdminAlbumLinks album={a} />
                  <SourceFetchButtons kind="albums" id={a.id} notFound={a.sourcesNotFound} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div style={{ padding: 16, color: "var(--text-muted)" }}>{emptyLabel}</div>
      )}
    </AdminPanel>
  );
}

// ---------------------------------------------------------------------------
// Tabela de pendências de artistas (layout fixo)
// ---------------------------------------------------------------------------

export function ArtistAuditTable({ rows, emptyLabel }: { rows: ArtistAuditRow[]; emptyLabel: string }) {
  return (
    <AdminPanel maxWidth={1240}>
      <table style={{ ...fixedTableStyle, minWidth: 1000 }}>
        <colgroup>
          <col style={{ width: 240 }} />
          <col style={{ width: 190 }} />
          <col style={{ width: 220 }} />
          <col style={{ width: 260 }} />
          <col style={{ width: 190 }} />
        </colgroup>
        <thead>
          <tr style={{ background: "var(--fill-inset)" }}>
            <th style={adminThStyle}>Artista</th>
            <th style={adminThStyle}>Pendências</th>
            <th style={adminThStyle}>Gêneros</th>
            <th style={adminThStyle}>Bio</th>
            <th style={adminThStyle}>Corrigir</th>
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
                <td style={{ ...adminTdStyle, verticalAlign: "middle" }} title={r.name}>
                  <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                    <CoverThumb url={r.imageUrl} size={32} round />
                    <span
                      style={{
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
                <td style={{ ...adminTdStyle, verticalAlign: "middle" }}>
                  <PendBadges missing={missing} esgotada={esgotada} />
                </td>
                <td style={{ ...adminTdStyle, verticalAlign: "middle", maxWidth: 220 }}>
                  {r.genres.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {r.genres.map((g) => (
                        <span
                          key={g}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "var(--text-muted)",
                            background: "var(--fill-subtle)",
                            padding: "3px 9px",
                            borderRadius: 99,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--text-disabled)" }}>—</span>
                  )}
                </td>
                <td
                  style={{
                    ...adminTdStyle,
                    verticalAlign: "middle",
                    fontSize: 12.5,
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={r.bio ?? undefined}
                >
                  {r.bio?.trim() ? r.bio : <span style={{ color: "var(--text-disabled)" }}>—</span>}
                </td>
                <td style={{ ...adminTdStyle, verticalAlign: "middle" }}>
                  <AdminArtistLinks artist={r} />
                  <ArtistRefreshImageButton artistId={r.id} />
                  <SourceFetchButtons kind="artists" id={r.id} notFound={r.sourcesNotFound} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div style={{ padding: 16, color: "var(--text-muted)" }}>{emptyLabel}</div>
      )}
    </AdminPanel>
  );
}

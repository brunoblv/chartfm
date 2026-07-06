import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Shell } from "@/components/layout/Shell";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { adminTdStyle, adminThStyle } from "@/components/admin/admin-styles";
import {
  AdminAlbumLinks,
  AdminSongLinks,
  AdminSongNameLink,
} from "@/components/admin/AdminEntityLinks";
import type { AlbumAuditRow, SongAuditRow } from "./lib";
import { SourceFetchButtons } from "./SourceFetchButtons";
import { InlineDate } from "./InlineEdit";

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
  | "artistas-pendencias";

const NAV: { key: DadosTab; label: string; href: string }[] = [
  { key: "geral", label: "Visão geral", href: "/admin/dados" },
  { key: "minhas-paradas", label: "Minhas paradas", href: "/admin/dados/minhas-paradas" },
  { key: "catalogo", label: "Catálogo", href: "/admin/dados/catalogo" },
  { key: "musicas", label: "Músicas", href: "/admin/dados/musicas" },
  { key: "albuns", label: "Álbuns", href: "/admin/dados/albuns" },
  { key: "artistas", label: "Artistas", href: "/admin/dados/artistas" },
  { key: "albuns-pendencias", label: "Álbuns · pendências", href: "/admin/dados/albuns-pendencias" },
  { key: "artistas-pendencias", label: "Artistas · pendências", href: "/admin/dados/artistas-pendencias" },
];

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

export function DadosNav({ active, showMinhasParadas }: { active: DadosTab; showMinhasParadas: boolean }) {
  const items = showMinhasParadas ? NAV : NAV.filter((item) => item.key !== "minhas-paradas");
  return (
    <nav style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
      {items.map((item) => (
        <Link key={item.key} href={item.href} style={navChipStyle(item.key === active)}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function DadosShell({
  active,
  subtitle,
  showMinhasParadas,
  children,
}: {
  active: DadosTab;
  subtitle: string;
  /** A aba "Minhas paradas" é exclusiva do dono (@bruno). */
  showMinhasParadas: boolean;
  children: ReactNode;
}) {
  return (
    <Shell title="Edição de dados" subtitle={subtitle}>
      <div style={{ width: "100%" }}>
        <DadosNav active={active} showMinhasParadas={showMinhasParadas} />
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

export function CoverThumb({ url, size = 32 }: { url: string | null | undefined; size?: number }) {
  if (url?.trim()) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        style={{ borderRadius: 6, objectFit: "cover", display: "block", flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      title="Sem capa"
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        border: "1.5px dashed #C41E3A",
        flexShrink: 0,
      }}
    />
  );
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
          <col style={{ width: 230 }} />
          <col style={{ width: 160 }} />
          <col style={{ width: 230 }} />
          <col style={{ width: 56 }} />
          <col style={{ width: 64 }} />
          <col style={{ width: 118 }} />
          <col style={{ width: 118 }} />
          <col style={{ width: 110 }} />
        </colgroup>
        <thead>
          <tr style={{ background: "var(--fill-inset)" }}>
            <th style={adminThStyle}>Música</th>
            <th style={adminThStyle}>Artista</th>
            <th style={adminThStyle}>Álbum</th>
            <th style={adminThStyle}>Capa</th>
            <th style={adminThStyle}>MBID</th>
            <th style={adminThStyle}>Single</th>
            <th style={adminThStyle}>Clipe</th>
            <th style={adminThStyle}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            return (
              <tr key={s.id}>
                <td style={cellEllipsis} title={s.title}>
                  <span style={{ fontWeight: 650 }}>
                    <AdminSongNameLink song={s} />
                  </span>
                </td>
                <td style={cellEllipsis} title={s.artist}>
                  {s.artist}
                </td>
                <td style={cellEllipsis} title={s.albumRef?.title ?? s.album ?? undefined}>
                  {s.albumRef ? (
                    s.albumRef.title
                  ) : s.album?.trim() ? (
                    <>
                      {s.album}{" "}
                      <span style={{ ...missStyle, fontSize: 11 }}>(só texto)</span>
                    </>
                  ) : (
                    <span style={missStyle}>sem álbum</span>
                  )}
                </td>
                <td style={{ ...adminTdStyle, verticalAlign: "middle" }}>
                  <CoverThumb url={s.albumRef?.coverUrl} />
                </td>
                <td style={{ ...adminTdStyle, verticalAlign: "middle" }}>
                  <OkFlag ok={Boolean(s.recordingMbid?.trim())} />
                </td>
                <td style={{ ...adminTdStyle, verticalAlign: "middle" }}>
                  <InlineDate kind="music" id={s.id} field="singleReleaseDate" value={s.singleReleaseDate} />
                  {s.releaseDatesNotFoundAt && (
                    <div style={{ marginTop: 3, fontSize: 10, fontWeight: 700, color: "#B45309" }} title="Backfill automático sem resultado">
                      busca esgotada
                    </div>
                  )}
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
                  <SourceFetchButtons kind="music" id={s.id} />
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
          <col style={{ width: 56 }} />
          <col style={{ width: 260 }} />
          <col style={{ width: 180 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 118 }} />
          <col style={{ width: 70 }} />
          <col style={{ width: 90 }} />
          <col style={{ width: 110 }} />
        </colgroup>
        <thead>
          <tr style={{ background: "var(--fill-inset)" }}>
            <th style={adminThStyle}>Capa</th>
            <th style={adminThStyle}>Álbum</th>
            <th style={adminThStyle}>Artista</th>
            <th style={adminThStyle}>Tipo</th>
            <th style={adminThStyle}>Lançamento</th>
            <th style={adminThStyle}>Faixas</th>
            <th style={adminThStyle}>Músicas</th>
            <th style={adminThStyle}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td style={{ ...adminTdStyle, verticalAlign: "middle" }}>
                <CoverThumb url={a.coverUrl} />
              </td>
              <td style={cellEllipsis} title={a.title}>
                <span style={{ fontWeight: 650 }}>{a.title}</span>
              </td>
              <td style={cellEllipsis} title={a.artist.name}>
                {a.artist.name}
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
                <SourceFetchButtons kind="albums" id={a.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div style={{ padding: 16, color: "var(--text-muted)" }}>{emptyLabel}</div>
      )}
    </AdminPanel>
  );
}

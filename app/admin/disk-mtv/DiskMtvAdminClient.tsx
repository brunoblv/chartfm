"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Youtube,
} from "lucide-react";
import { AdminSongNameLink } from "@/components/admin/AdminEntityLinks";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { AdminTablePagination } from "@/components/admin/AdminTablePagination";
import {
  adminCellEllipsis,
  adminCompactTableStyle,
  adminCompactTdStyle,
  adminCompactThStyle,
  adminInputStyle,
  adminPageWrapStyle,
} from "@/components/admin/admin-styles";
import type { DiskMtvClipPreview, DiskMtvClipPreviewRow } from "@/lib/disk-mtv-clip-preview";

type FilterMode = "all" | "missing" | "has" | "official";

const PAGE_SIZE = 25;

const chipBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "4px 8px",
  borderRadius: 8,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 11,
  fontWeight: 700,
  fontFamily: "inherit",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const pill = (ok: boolean): CSSProperties => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.03em",
  background: ok ? "rgba(45,122,50,0.12)" : "rgba(196,30,58,0.12)",
  color: ok ? "#2D7A32" : "#C41E3A",
});

function ytSearchUrl(artist: string, title: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${artist} ${title} official music video`,
  )}`;
}

function ytWatchUrl(id: string) {
  return `https://www.youtube.com/watch?v=${id}`;
}

function movLabel(r: DiskMtvClipPreviewRow): string {
  if (r.status === "new") return "NEW";
  if (r.status === "same" || r.delta === 0) return "=";
  if (r.delta == null) return r.status;
  return r.delta > 0 ? `+${r.delta}` : String(r.delta);
}

type RowState = {
  busy?: "search" | "save" | "clear" | "missing";
  message?: string;
  error?: string;
  draftUrl?: string;
};

export function DiskMtvAdminClient() {
  const [data, setData] = useState<DiskMtvClipPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("missing");
  const [page, setPage] = useState(1);
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [batchBusy, setBatchBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/disk-mtv/preview?limit=200", { cache: "no-store" });
      const json = (await res.json()) as DiskMtvClipPreview & { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) {
        setLoadError(json.error ?? "Falha ao carregar preview");
        setData(null);
        return;
      }
      setData(json);
      setRowState({});
    } catch {
      setLoadError("Erro de rede");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    switch (filter) {
      case "missing":
        return data.rows.filter((r) => !r.hasClip);
      case "has":
        return data.rows.filter((r) => r.hasClip);
      case "official":
        return data.rows.filter((r) => r.inOfficialTop);
      default:
        return data.rows;
    }
  }, [data, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  function patchRow(songId: string, patch: Partial<RowState>) {
    setRowState((prev) => ({ ...prev, [songId]: { ...prev[songId], ...patch } }));
  }

  function applyClipToLocal(songId: string, videoId: string | null, publishedAt?: string | null) {
    setData((prev) => {
      if (!prev) return prev;
      let eligiblePos = 0;
      const rows = prev.rows.map((r) => {
        if (r.songId !== songId) {
          if (!r.hasClip) return r;
          const ep = ++eligiblePos;
          return {
            ...r,
            eligiblePosition: ep,
            inOfficialTop: ep <= prev.maxSongs,
          };
        }
        const hasClip = Boolean(videoId);
        const ep = hasClip ? ++eligiblePos : null;
        return {
          ...r,
          hasClip,
          youtubeId: videoId,
          youtubeReleaseDate: publishedAt?.slice(0, 10) ?? (hasClip ? r.youtubeReleaseDate : null),
          musicVideoReleaseDate: publishedAt?.slice(0, 10) ?? (hasClip ? r.musicVideoReleaseDate : null),
          clipPublishedAt: publishedAt?.slice(0, 10) ?? null,
          sourcesNotFound: hasClip
            ? r.sourcesNotFound.filter((s) => s !== "youtube_clip")
            : r.sourcesNotFound.includes("youtube_clip")
              ? r.sourcesNotFound
              : [...r.sourcesNotFound, "youtube_clip"],
          eligiblePosition: ep,
          inOfficialTop: ep != null && ep <= prev.maxSongs,
        };
      });
      // Recalcula elegíveis em ordem de posição da lista (não só a linha tocada)
      eligiblePos = 0;
      const recalculated = rows.map((r) => {
        if (!r.hasClip) {
          return { ...r, eligiblePosition: null, inOfficialTop: false };
        }
        const ep = ++eligiblePos;
        return { ...r, eligiblePosition: ep, inOfficialTop: ep <= prev.maxSongs };
      });
      const withClip = recalculated.filter((r) => r.hasClip).length;
      return {
        ...prev,
        rows: recalculated,
        withClip,
        withoutClip: recalculated.length - withClip,
        officialEligibleCount: eligiblePos,
      };
    });
  }

  async function searchClip(row: DiskMtvClipPreviewRow) {
    if (rowState[row.songId]?.busy) return;
    patchRow(row.songId, { busy: "search", error: undefined, message: undefined });
    try {
      const res = await fetch(`/api/admin/songs/${row.songId}/youtube-clip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        found?: boolean;
        videoId?: string;
        publishedAt?: string | null;
        message?: string;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        patchRow(row.songId, { busy: undefined, error: json.error ?? "Falha na busca" });
        return;
      }
      if (json.found && json.videoId) {
        applyClipToLocal(
          row.songId,
          json.videoId,
          typeof json.publishedAt === "string" ? json.publishedAt : null,
        );
      } else {
        applyClipToLocal(row.songId, null);
      }
      patchRow(row.songId, { busy: undefined, message: json.message });
    } catch {
      patchRow(row.songId, { busy: undefined, error: "Erro de rede" });
    }
  }

  async function saveManual(row: DiskMtvClipPreviewRow) {
    const raw = rowState[row.songId]?.draftUrl?.trim() ?? "";
    if (!raw || rowState[row.songId]?.busy) return;
    patchRow(row.songId, { busy: "save", error: undefined, message: undefined });
    try {
      const res = await fetch(`/api/admin/songs/${row.songId}/youtube-clip`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeIdOrUrl: raw }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        videoId?: string;
        publishedAt?: string | null;
        message?: string;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.videoId) {
        patchRow(row.songId, { busy: undefined, error: json.error ?? "Falha ao salvar" });
        return;
      }
      applyClipToLocal(
        row.songId,
        json.videoId,
        typeof json.publishedAt === "string" ? json.publishedAt : null,
      );
      patchRow(row.songId, {
        busy: undefined,
        message: json.message,
        draftUrl: "",
      });
    } catch {
      patchRow(row.songId, { busy: undefined, error: "Erro de rede" });
    }
  }

  async function markMissing(row: DiskMtvClipPreviewRow) {
    if (rowState[row.songId]?.busy) return;
    patchRow(row.songId, { busy: "missing", error: undefined, message: undefined });
    try {
      const res = await fetch(`/api/admin/songs/${row.songId}/youtube-clip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markMissing" }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !json.ok) {
        patchRow(row.songId, { busy: undefined, error: json.error ?? "Falha" });
        return;
      }
      patchRow(row.songId, { busy: undefined, message: json.message });
    } catch {
      patchRow(row.songId, { busy: undefined, error: "Erro de rede" });
    }
  }

  async function clearClip(row: DiskMtvClipPreviewRow) {
    if (rowState[row.songId]?.busy) return;
    if (!confirm(`Remover clipe de "${row.title}"?`)) return;
    patchRow(row.songId, { busy: "clear", error: undefined, message: undefined });
    try {
      const res = await fetch(`/api/admin/songs/${row.songId}/youtube-clip`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !json.ok) {
        patchRow(row.songId, { busy: undefined, error: json.error ?? "Falha ao remover" });
        return;
      }
      applyClipToLocal(row.songId, null);
      patchRow(row.songId, { busy: undefined, message: json.message });
    } catch {
      patchRow(row.songId, { busy: undefined, error: "Erro de rede" });
    }
  }

  async function batchSearchMissing() {
    if (!data || batchBusy) return;
    const targets = data.rows.filter((r) => !r.hasClip).slice(0, 15);
    if (!targets.length) return;
    if (
      !confirm(
        `Buscar clipe no YouTube para as próximas ${targets.length} sem clipe?\n(Cuidado: gasta cota da API — máx. ~15 por rodada.)`,
      )
    ) {
      return;
    }
    setBatchBusy(true);
    for (const row of targets) {
      await searchClip(row);
      await new Promise((r) => setTimeout(r, 400));
    }
    setBatchBusy(false);
  }

  const filterChip = (mode: FilterMode, label: string, count?: number) => (
    <button
      type="button"
      onClick={() => setFilter(mode)}
      style={{
        ...chipBtn,
        background: filter === mode ? "var(--accent-tint)" : "var(--surface)",
        borderColor: filter === mode ? "#FA243C" : "var(--divider-strong)",
        color: filter === mode ? "#FA243C" : "var(--text)",
      }}
    >
      {label}
      {count != null ? ` (${count})` : ""}
    </button>
  );

  return (
    <div style={adminPageWrapStyle}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800 }}>Disk MTV — clipes</h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55, maxWidth: 720 }}>
          Preview da semana <strong>sem filtro de clipe</strong>. Use para pré-preencher MVs antes do
          freeze oficial (top {data?.maxSongs ?? 20} só com clipe).
        </p>
      </div>

      {loading && !data ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)" }}>
          <Loader2 size={16} className="spin" /> Carregando preview…
        </div>
      ) : null}
      {loadError ? (
        <div style={{ color: "#C41E3A", marginBottom: 12, fontSize: 13 }}>{loadError}</div>
      ) : null}

      {data ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 10,
              marginBottom: 16,
            }}
          >
            {[
              { label: "Semana", value: String(data.weekIndex) },
              { label: "Contribuidores", value: `${data.contributorCount}/${data.memberCount}` },
              { label: "Na lista", value: String(data.entryCount) },
              { label: "Com clipe", value: String(data.withClip) },
              { label: "Sem clipe", value: String(data.withoutClip) },
              {
                label: "Elegíveis ao top",
                value: `${Math.min(data.officialEligibleCount, data.maxSongs)}/${data.maxSongs}`,
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--divider)",
                  background: "var(--surface)",
                }}
              >
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
            {data.weekLabel} · {data.dateRange}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {filterChip("missing", "Sem clipe", data.withoutClip)}
            {filterChip("has", "Com clipe", data.withClip)}
            {filterChip("official", "Top oficial", Math.min(data.officialEligibleCount, data.maxSongs))}
            {filterChip("all", "Todas", data.entryCount)}
            <button type="button" onClick={() => void load()} disabled={loading} style={chipBtn}>
              <RefreshCw size={12} /> Atualizar
            </button>
            <button
              type="button"
              onClick={() => void batchSearchMissing()}
              disabled={batchBusy || data.withoutClip === 0}
              style={chipBtn}
              title="Busca automática nas próximas 15 sem clipe"
            >
              {batchBusy ? <Loader2 size={12} /> : <Search size={12} />} Buscar lote (15)
            </button>
          </div>

          <AdminPanel maxWidth={1100} scroll>
            <table style={adminCompactTableStyle}>
              <colgroup>
                <col style={{ width: 36 }} />
                <col style={{ width: 44 }} />
                <col />
                <col style={{ width: 56 }} />
                <col style={{ width: 72 }} />
                <col style={{ width: 88 }} />
                <col style={{ width: 280 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={adminCompactThStyle}>#</th>
                  <th style={adminCompactThStyle}>Mov</th>
                  <th style={adminCompactThStyle}>Música</th>
                  <th style={{ ...adminCompactThStyle, textAlign: "right" }}>Pts</th>
                  <th style={adminCompactThStyle}>Clipe</th>
                  <th style={adminCompactThStyle}>Top of.</th>
                  <th style={adminCompactThStyle}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => {
                  const st = rowState[r.songId] ?? {};
                  const busy = Boolean(st.busy);
                  return (
                    <tr key={r.songId} style={{ background: r.hasClip ? undefined : "rgba(196,30,58,0.04)" }}>
                      <td style={adminCompactTdStyle}>{r.position}</td>
                      <td style={adminCompactTdStyle}>{movLabel(r)}</td>
                      <td style={adminCompactTdStyle}>
                        <div style={adminCellEllipsis} title={`${r.title} — ${r.artist}`}>
                          <AdminSongNameLink song={{ id: r.songId, title: r.title, artist: r.artist }}>
                            {r.title}
                          </AdminSongNameLink>
                        </div>
                        <div
                          style={{
                            ...adminCellEllipsis,
                            fontSize: 11,
                            color: "var(--text-muted)",
                            marginTop: 2,
                          }}
                          title={r.artist}
                        >
                          {r.artist}
                        </div>
                      </td>
                      <td style={{ ...adminCompactTdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {r.points.toLocaleString("pt-BR")}
                      </td>
                      <td style={adminCompactTdStyle}>
                        <span style={pill(r.hasClip)}>{r.hasClip ? "SIM" : "NÃO"}</span>
                        {r.youtubeId ? (
                          <div style={{ marginTop: 4 }}>
                            <a
                              href={ytWatchUrl(r.youtubeId)}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontSize: 10, color: "#FF0000", fontWeight: 700 }}
                            >
                              {r.youtubeId}
                            </a>
                            {(r.clipPublishedAt || r.musicVideoReleaseDate || r.youtubeReleaseDate) && (
                              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                                {r.clipPublishedAt ?? r.musicVideoReleaseDate ?? r.youtubeReleaseDate}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </td>
                      <td style={adminCompactTdStyle}>
                        {r.inOfficialTop ? (
                          <span style={{ fontWeight: 800, color: "#2D7A32" }}>#{r.eligiblePosition}</span>
                        ) : r.hasClip ? (
                          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>#{r.eligiblePosition}</span>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>
                        )}
                      </td>
                      <td style={adminCompactTdStyle}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                          <button
                            type="button"
                            style={chipBtn}
                            disabled={busy}
                            onClick={() => void searchClip(r)}
                            title="Buscar clipe oficial via API YouTube"
                          >
                            {st.busy === "search" ? <Loader2 size={11} /> : <Youtube size={11} />} Buscar
                          </button>
                          <a
                            href={ytSearchUrl(r.artist, r.title)}
                            target="_blank"
                            rel="noreferrer"
                            style={{ ...chipBtn, textDecoration: "none" }}
                            title="Abrir busca no YouTube"
                          >
                            <ExternalLink size={11} /> YT
                          </a>
                          {!r.hasClip ? (
                            <button
                              type="button"
                              style={chipBtn}
                              disabled={busy}
                              onClick={() => void markMissing(r)}
                              title="Marcar como sem clipe (pula backfill)"
                            >
                              Sem MV
                            </button>
                          ) : (
                            <button
                              type="button"
                              style={chipBtn}
                              disabled={busy}
                              onClick={() => void clearClip(r)}
                              title="Remover clipe do banco"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <input
                            value={st.draftUrl ?? ""}
                            onChange={(e) => patchRow(r.songId, { draftUrl: e.target.value })}
                            placeholder="ID ou URL YouTube"
                            disabled={busy}
                            style={{
                              ...adminInputStyle,
                              padding: "4px 8px",
                              fontSize: 11,
                              borderRadius: 8,
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void saveManual(r);
                            }}
                          />
                          <button
                            type="button"
                            style={chipBtn}
                            disabled={busy || !(st.draftUrl ?? "").trim()}
                            onClick={() => void saveManual(r)}
                          >
                            {st.busy === "save" ? <Loader2 size={11} /> : "Salvar"}
                          </button>
                        </div>
                        {st.message ? (
                          <div style={{ marginTop: 4, fontSize: 10, color: "var(--text-muted)" }}>{st.message}</div>
                        ) : null}
                        {st.error ? (
                          <div style={{ marginTop: 4, fontSize: 10, color: "#C41E3A" }}>{st.error}</div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {!pageRows.length ? (
                  <tr>
                    <td colSpan={7} style={{ ...adminCompactTdStyle, color: "var(--text-muted)" }}>
                      Nenhuma faixa neste filtro.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </AdminPanel>

          <div style={{ marginTop: 12 }}>
            <AdminTablePagination
              page={pageSafe}
              totalPages={totalPages}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              onChange={setPage}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

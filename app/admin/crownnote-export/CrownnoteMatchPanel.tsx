"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSpotifySearch } from "@/hooks/useSpotifySearch";
import { ManualSongCreateModal } from "@/components/create/ManualSongCreateModal";
import type { CrownnoteUserExport } from "@/lib/crownnote-export";
import type {
  CrownnoteCatalogSong,
  CrownnoteMappedExport,
  CrownnoteSongMapping,
  CrownnoteSongMatchRow,
} from "@/lib/crownnote-song-match";
import { buildMappedExport, mappingsFromMatchRows } from "@/lib/crownnote-song-match";
import { buildSongPath } from "@/lib/music-routes";

type DbSearchHit = {
  id: string;
  title: string;
  artist: string;
  album: string;
  spotifyId: string | null;
};

const card: React.CSSProperties = {
  border: "1px solid var(--divider)",
  borderRadius: 12,
  padding: 16,
  background: "var(--surface, transparent)",
};

const btn = (disabled = false, variant: "primary" | "ghost" = "primary"): React.CSSProperties => ({
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--divider)",
  background: variant === "ghost" ? "transparent" : disabled ? "var(--accent-tint)" : "var(--accent, #1db954)",
  color: variant === "ghost" ? "var(--text)" : disabled ? "var(--text-muted)" : "#fff",
  fontWeight: 600,
  fontSize: 13,
  cursor: disabled ? "default" : "pointer",
});

function downloadMappedJson(data: CrownnoteMappedExport, username: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `crownnote-${username}-mapped-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function SongResolver({
  row,
  onResolved,
}: {
  row: CrownnoteSongMatchRow;
  onResolved: (match: CrownnoteCatalogSong, source: "manual_db" | "manual_spotify" | "manual_create") => void;
}) {
  const [query, setQuery] = useState(`${row.crownnoteTitle} ${row.crownnoteArtist}`);
  const [dbHits, setDbHits] = useState<DbSearchHit[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const spotify = useSpotifySearch(query, false, "crownnote");

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setDbHits([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setDbLoading(true);
      try {
        const res = await fetch(
          `/api/admin/edicao-de-dados/search?kind=music&q=${encodeURIComponent(q)}`,
          { signal: ctrl.signal, cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { items: DbSearchHit[] };
        setDbHits(data.items ?? []);
      } catch {
        // ignore
      } finally {
        if (!ctrl.signal.aborted) setDbLoading(false);
      }
    }, 220);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [query]);

  async function pickDb(songId: string) {
    setResolvingId(songId);
    setError(null);
    try {
      const res = await fetch("/api/admin/crownnote-export/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId }),
      });
      const data = (await res.json()) as { match?: CrownnoteCatalogSong; error?: string };
      if (!res.ok || !data.match) throw new Error(data.error ?? "Falha ao vincular.");
      onResolved(data.match, "manual_db");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao vincular.");
    } finally {
      setResolvingId(null);
    }
  }

  async function pickSpotify(spotifyId: string) {
    setResolvingId(spotifyId);
    setError(null);
    try {
      const res = await fetch("/api/admin/crownnote-export/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spotifyId,
          crownnoteArtist: row.crownnoteArtist,
          crownnoteTitle: row.crownnoteTitle,
        }),
      });
      const data = (await res.json()) as { match?: CrownnoteCatalogSong; error?: string };
      if (!res.ok || !data.match) throw new Error(data.error ?? "Falha ao importar do Spotify.");
      onResolved(data.match, "manual_spotify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao importar.");
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--divider)" }}>
      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
          Buscar correspondência no catálogo ou Spotify
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--divider)",
            background: "var(--bg)",
            color: "var(--text)",
            fontSize: 13,
          }}
        />
      </label>

      {error && <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--danger, #e74c3c)" }}>{error}</p>}

      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Catálogo ChartFM</div>
          {dbLoading && <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Buscando…</p>}
          {!dbLoading && dbHits.length === 0 && (
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Nenhum resultado no banco.</p>
          )}
          <div style={{ display: "grid", gap: 6 }}>
            {dbHits.map((hit) => (
              <div
                key={hit.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--divider)",
                  fontSize: 13,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>
                    {hit.artist} – {hit.title}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    ID {hit.id}
                    {hit.spotifyId ? ` · Spotify ${hit.spotifyId}` : ""}
                    {hit.album ? ` · ${hit.album}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  style={btn(resolvingId === hit.id)}
                  disabled={Boolean(resolvingId)}
                  onClick={() => pickDb(hit.id)}
                >
                  Usar esta
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Spotify</div>
          {!spotify.configured && (
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Spotify não configurado.</p>
          )}
          {spotify.loading && <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Buscando…</p>}
          <div style={{ display: "grid", gap: 6 }}>
            {spotify.tracks.map((track) => {
              const spotifyId = track.spotifyId;
              if (!spotifyId) return null;
              return (
                <div
                  key={spotifyId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--divider)",
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    {track.imageUrl && (
                      <img
                        src={track.imageUrl}
                        alt=""
                        width={36}
                        height={36}
                        style={{ borderRadius: 4, objectFit: "cover", flexShrink: 0 }}
                      />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>
                        {track.artist} – {track.title}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Spotify {spotifyId}
                        {track.album ? ` · ${track.album}` : ""}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    style={btn(resolvingId === spotifyId)}
                    disabled={Boolean(resolvingId)}
                    onClick={() => pickSpotify(spotifyId)}
                  >
                    Importar e usar
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ paddingTop: 4, borderTop: "1px solid var(--divider)" }}>
          <p style={{ margin: "10px 0 8px", fontSize: 12, color: "var(--text-muted)" }}>
            Não achou em nenhum dos dois? Cadastre a música manualmente.
          </p>
          <button type="button" style={btn(false, "ghost")} onClick={() => setShowCreateModal(true)}>
            Criar artista e música
          </button>
        </div>
      </div>

      {showCreateModal && (
        <ManualSongCreateModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(song) => {
            if (!song.id) return;
            onResolved(
              {
                songId: song.id,
                title: song.title,
                artist: song.artist,
                spotifyId: song.spotifyId ?? null,
                albumSpotifyId: null,
              },
              "manual_create",
            );
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}

function MatchRow({
  row,
  onResolved,
  onClear,
}: {
  row: CrownnoteSongMatchRow;
  onResolved: (match: CrownnoteCatalogSong, source: "manual_db" | "manual_spotify" | "manual_create") => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(row.status === "unmatched");

  return (
    <div style={{ ...card, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>
            {row.crownnoteArtist} – {row.crownnoteTitle}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            {row.occurrences} {row.occurrences === 1 ? "aparição" : "aparições"} na parada
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {row.match ? (
            <div style={{ fontSize: 13, color: "var(--accent, #1db954)", fontWeight: 700 }}>✓ encontrada</div>
          ) : (
            <div style={{ fontSize: 13, color: "#d97706", fontWeight: 700 }}>⚠ pendente</div>
          )}
        </div>
      </div>

      {row.match && (
        <div
          style={{
            marginTop: 10,
            padding: "8px 10px",
            borderRadius: 8,
            background: "var(--accent-tint)",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <div>
            <strong>ChartFM:</strong> {row.match.artist} – {row.match.title}
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
            track_id {row.match.songId}
            {row.match.spotifyId ? ` · Spotify ${row.match.spotifyId}` : ""}
            {row.confidence === "fuzzy" ? " · correspondência aproximada" : ""}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <Link
              href={buildSongPath({
                id: row.match.songId,
                title: row.match.title,
                artist: row.match.artist,
              })}
              style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}
            >
              Ver no site
            </Link>
            <button type="button" style={{ ...btn(false, "ghost"), padding: "4px 8px", fontSize: 12 }} onClick={onClear}>
              Trocar
            </button>
            {row.status === "unmatched" && (
              <button
                type="button"
                style={{ ...btn(false, "ghost"), padding: "4px 8px", fontSize: 12 }}
                onClick={() => setOpen((v) => !v)}
              >
                {open ? "Ocultar busca" : "Corrigir"}
              </button>
            )}
          </div>
        </div>
      )}

      {(!row.match || open) && (
        <SongResolver
          row={row}
          onResolved={(match, source) => {
            onResolved(match, source);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default function CrownnoteMatchPanel({
  exportData,
  initialRows,
  onBack,
}: {
  exportData: CrownnoteUserExport;
  initialRows: CrownnoteSongMatchRow[];
  onBack: () => void;
}) {
  const [rows, setRows] = useState(initialRows);
  const [manualSources, setManualSources] = useState<
    Record<string, CrownnoteSongMapping["source"]>
  >({});
  const [onlyPending, setOnlyPending] = useState(true);
  const [showMatched, setShowMatched] = useState(false);
  const [bulkLoading, setBulkLoading] = useState<"rematch" | "spotify" | null>(null);
  const [bulkProgress, setBulkProgress] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const matched = rows.filter((r) => r.match).length;
    return {
      uniqueSongs: rows.length,
      matched,
      unmatched: rows.length - matched,
    };
  }, [rows]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (Boolean(a.match) !== Boolean(b.match)) return a.match ? 1 : -1;
      if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
      return `${a.crownnoteArtist} ${a.crownnoteTitle}`.localeCompare(
        `${b.crownnoteArtist} ${b.crownnoteTitle}`,
      );
    });
  }, [rows]);

  const visibleRows = useMemo(() => {
    if (onlyPending) return sortedRows.filter((r) => !r.match);
    if (!showMatched) return sortedRows.filter((r) => !r.match);
    return sortedRows;
  }, [onlyPending, showMatched, sortedRows]);

  async function runBulkResolve(mode: "rematch" | "spotify") {
    setBulkLoading(mode);
    setBulkError(null);
    setBulkProgress(mode === "spotify" ? "Iniciando importação via Spotify…" : "Refinando busca no catálogo…");

    try {
      const res = await fetch("/api/admin/crownnote-export/bulk-resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, mode, stream: true }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Erro ${res.status}`);
      }
      if (!res.body) throw new Error("Resposta vazia.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let nextRows: CrownnoteSongMatchRow[] | null = null;
      let resolved = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            type: string;
            rows?: CrownnoteSongMatchRow[];
            resolved?: number;
            failed?: number;
            current?: number;
            total?: number;
            key?: string;
            ok?: boolean;
            message?: string;
          };

          if (event.type === "progress" && event.total) {
            setBulkProgress(
              `${mode === "spotify" ? "Spotify" : "Catálogo"}: ${event.current}/${event.total}${
                event.ok === false ? " (não encontrada)" : ""
              }`,
            );
          } else if (event.type === "done" && event.rows) {
            nextRows = event.rows;
            resolved = event.resolved ?? 0;
          } else if (event.type === "error") {
            throw new Error(event.message ?? "Erro.");
          }
        }
      }

      if (!nextRows) throw new Error("Processamento não retornou dados.");
      setRows(nextRows);
      if (mode === "spotify") {
        setManualSources((prev) => {
          const next = { ...prev };
          for (const row of nextRows!) {
            if (row.match && !next[row.key]) next[row.key] = "auto_spotify";
          }
          return next;
        });
      }
      setBulkProgress(`Concluído: ${resolved} resolvida(s).`);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Erro no processamento em lote.");
    } finally {
      setBulkLoading(null);
    }
  }

  function applyMatch(
    key: string,
    match: CrownnoteCatalogSong,
    source: CrownnoteSongMapping["source"],
  ) {
    setRows((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, status: "matched", match, confidence: null } : row,
      ),
    );
    setManualSources((prev) => ({ ...prev, [key]: source }));
  }

  function clearMatch(key: string) {
    setRows((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, status: "unmatched", match: null, confidence: null } : row,
      ),
    );
    setManualSources((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function buildMappings(): CrownnoteSongMapping[] {
    return mappingsFromMatchRows(rows, manualSources);
  }

  function handleDownloadMapped() {
    const mapped = buildMappedExport(exportData, buildMappings());
    downloadMappedJson(mapped, exportData.username);
  }

  const canFinish = stats.unmatched === 0;

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 900 }}>
      <div style={card}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Correspondência com o catálogo</h3>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
          A maioria das pendentes provavelmente não está no catálogo ainda (paradas desde 2000). Use a
          resolução automática via Spotify antes de revisar manualmente — você só precisa corrigir o que
          sobrar.
        </p>
        <div style={{ display: "flex", gap: 16, fontSize: 14, flexWrap: "wrap", marginBottom: 12 }}>
          <span>
            <strong>{stats.matched}</strong> encontradas
          </span>
          <span style={{ color: stats.unmatched ? "#d97706" : "var(--text-muted)" }}>
            <strong>{stats.unmatched}</strong> pendentes
          </span>
          <span style={{ color: "var(--text-muted)" }}>
            <strong>{stats.uniqueSongs}</strong> músicas únicas
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            style={btn(Boolean(bulkLoading))}
            disabled={Boolean(bulkLoading) || stats.unmatched === 0}
            onClick={() => runBulkResolve("rematch")}
          >
            {bulkLoading === "rematch" ? "Refinando…" : "Refinar busca no catálogo"}
          </button>
          <button
            type="button"
            style={btn(Boolean(bulkLoading))}
            disabled={Boolean(bulkLoading) || stats.unmatched === 0}
            onClick={() => runBulkResolve("spotify")}
          >
            {bulkLoading === "spotify" ? "Importando…" : "Resolver pendentes via Spotify"}
          </button>
        </div>

        {bulkProgress && (
          <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--text-muted)" }}>{bulkProgress}</p>
        )}
        {bulkError && (
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--danger, #e74c3c)" }}>{bulkError}</p>
        )}
      </div>

      <div style={{ ...card, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={onlyPending}
            onChange={(e) => {
              setOnlyPending(e.target.checked);
              if (e.target.checked) setShowMatched(false);
            }}
          />
          Mostrar só pendentes
        </label>
        {!onlyPending && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={showMatched}
              onChange={(e) => setShowMatched(e.target.checked)}
            />
            Incluir já encontradas ({stats.matched})
          </label>
        )}
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Ordenadas por impacto (mais aparições primeiro)
        </span>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {visibleRows.length === 0 ? (
          <div style={{ ...card, color: "var(--text-muted)", fontSize: 14 }}>
            Nenhuma pendência visível. {stats.unmatched > 0 ? "Desmarque o filtro para ver todas." : "Tudo resolvido!"}
          </div>
        ) : (
          visibleRows.map((row) => (
            <MatchRow
              key={row.key}
              row={row}
              onResolved={(match, source) => applyMatch(row.key, match, source)}
              onClear={() => clearMatch(row.key)}
            />
          ))
        )}
      </div>

      <div style={{ ...card, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" style={btn(false, "ghost")} onClick={onBack}>
          Voltar
        </button>
        <button type="button" style={btn(!canFinish)} disabled={!canFinish} onClick={handleDownloadMapped}>
          {canFinish ? "Baixar JSON mapeado" : `Resolva ${stats.unmatched} pendência(s) primeiro`}
        </button>
        {canFinish && (
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            O JSON inclui <code>songMappings</code> com os IDs do ChartFM para cada faixa do Crownnote.
          </span>
        )}
      </div>
    </div>
  );
}

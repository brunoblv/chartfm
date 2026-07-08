"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ReleaseNotificationAdminItem,
  ReleaseRadarAdminData,
  ReleaseWatchAdminItem,
} from "@/lib/release-radar";

type SpotifyArtistHit = {
  spotifyId: string;
  name: string;
  genres: string[];
  imageUrl: string | null;
  spotifyUrl: string | null;
};

const PAGE_SIZE = 20;

const inputStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const smallButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  padding: "5px 10px",
  fontSize: 12,
};

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 18,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  padding: "8px 10px",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text)",
  padding: "8px 10px",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "middle",
};

function Avatar({ src, name, size = 32 }: { src: string | null; name: string; size?: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.4, fontWeight: 700, color: "var(--text-muted)",
      }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  const isGlobal = source === "global";
  return (
    <span
      style={{
        fontSize: 11, fontWeight: 600, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap",
        color: isGlobal ? "#1DB954" : "var(--text-muted)",
        border: `1px solid ${isGlobal ? "#1DB95455" : "var(--border)"}`,
      }}
    >
      {isGlobal ? "Global 200" : "Manual"}
    </span>
  );
}

function formatDateTimeBr(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatDateBr(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso ?? "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function RadarLancamentosClient({ initialData }: { initialData: ReleaseRadarAdminData }) {
  const [watches, setWatches] = useState<ReleaseWatchAdminItem[]>(initialData.watches);
  const [recent, setRecent] = useState<ReleaseNotificationAdminItem[]>(initialData.recent);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SpotifyArtistHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const watchedIds = new Set(watches.map((w) => w.spotifyId));

  const filteredWatches = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? watches.filter((w) => w.name.toLowerCase().includes(f)) : watches;
  }, [watches, filter]);

  const totalPages = Math.max(1, Math.ceil(filteredWatches.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageWatches = filteredWatches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function reload() {
    const res = await fetch("/api/admin/release-radar");
    if (!res.ok) return;
    const data = (await res.json()) as ReleaseRadarAdminData;
    setWatches(data.watches);
    setRecent(data.recent);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/release-radar/search?q=${encodeURIComponent(q.trim())}`);
        const data = (await res.json()) as { artists: SpotifyArtistHit[] };
        setResults(data.artists ?? []);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q]);

  async function addArtist(hit: SpotifyArtistHit) {
    setAdding(hit.spotifyId);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/release-radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotifyId: hit.spotifyId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(`Erro ao adicionar: ${data.error ?? res.status}`);
        return;
      }
      setNotice(`${hit.name} adicionado ao radar. Lançamentos a partir de agora serão avisados no Telegram.`);
      await reload();
    } finally {
      setAdding(null);
    }
  }

  async function toggleActive(watch: ReleaseWatchAdminItem) {
    setBusyId(watch.id);
    try {
      await fetch(`/api/admin/release-radar/${watch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !watch.active }),
      });
      setWatches((prev) => prev.map((w) => (w.id === watch.id ? { ...w, active: !w.active } : w)));
    } finally {
      setBusyId(null);
    }
  }

  async function removeWatch(watch: ReleaseWatchAdminItem) {
    if (!confirm(`Remover ${watch.name} do radar? O histórico de avisos também será apagado.`)) return;
    setBusyId(watch.id);
    try {
      await fetch(`/api/admin/release-radar/${watch.id}`, { method: "DELETE" });
      setWatches((prev) => prev.filter((w) => w.id !== watch.id));
      setRecent((prev) => prev.filter((n) => n.artistName !== watch.name));
    } finally {
      setBusyId(null);
    }
  }

  async function runNow() {
    setRunning(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/release-radar/run", { method: "POST" });
      const data = (await res.json()) as { checked?: number; announced?: number; errors?: string[] };
      const parts = [`${data.checked ?? 0} artista(s) checado(s)`, `${data.announced ?? 0} aviso(s) enviado(s)`];
      if (data.errors?.length) parts.push(`${data.errors.length} erro(s): ${data.errors[0]}`);
      setNotice(`Verificação concluída — ${parts.join(", ")}.`);
      await reload();
    } finally {
      setRunning(false);
    }
  }

  async function importGlobal() {
    if (!confirm("Importar os 200 artistas que mais pontuaram no Global da semana? Artistas importados anteriormente que saíram do top 200 serão removidos (os adicionados manualmente ficam).")) return;
    setImporting(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/release-radar/import", { method: "POST" });
      const data = (await res.json()) as {
        error?: string; weekLabel?: string; added?: number; kept?: number; removed?: number; withSpotify?: number;
      };
      if (!res.ok) {
        setNotice(`Erro na importação: ${data.error ?? res.status}`);
        return;
      }
      setNotice(
        `Importação do Global (${data.weekLabel}) concluída — ${data.added ?? 0} adicionado(s), ` +
        `${data.kept ?? 0} já monitorado(s), ${data.removed ?? 0} removido(s) por sair do top 200.`,
      );
      await reload();
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 980 }}>
      <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
        O radar checa os artistas ativos de hora em hora e publica no grupo do Telegram quando sai
        álbum ou single novo no Spotify. Toda terça às 12h a lista é sincronizada automaticamente com
        os 200 artistas que mais pontuaram no Global da semana (os adicionados manualmente nunca saem
        na sincronização). Lançamentos anteriores ao monitoramento não são anunciados retroativamente.
      </div>

      {notice && (
        <div style={{ ...cardStyle, padding: "12px 16px", fontSize: 13, color: "var(--text)" }}>{notice}</div>
      )}

      {/* Busca de artistas */}
      <div style={cardStyle}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>Adicionar artista</div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar artista no Spotify…"
          style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
        />
        {searching && <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "12px 0 0" }}>Buscando…</div>}
        {!searching && results.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {results.map((hit) => {
              const already = watchedIds.has(hit.spotifyId);
              return (
                <div key={hit.spotifyId} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar src={hit.imageUrl} name={hit.name} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{hit.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {hit.genres.slice(0, 3).join(", ") || "—"}
                    </div>
                  </div>
                  <button
                    onClick={() => !already && adding !== hit.spotifyId && addArtist(hit)}
                    disabled={already || adding === hit.spotifyId}
                    style={{ ...buttonStyle, opacity: already ? 0.5 : 1, cursor: already ? "default" : "pointer" }}
                  >
                    {already ? "Monitorado" : adding === hit.spotifyId ? "Adicionando…" : "Monitorar"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Artistas monitorados */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
            Artistas monitorados <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>({watches.length})</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={importGlobal} disabled={importing} style={{ ...buttonStyle, color: "#1DB954", borderColor: "#1DB95455" }}>
              {importing ? "Importando…" : "Importar Top 200 do Global"}
            </button>
            <button onClick={runNow} disabled={running || watches.length === 0} style={buttonStyle}>
              {running ? "Verificando…" : "Verificar agora"}
            </button>
          </div>
        </div>

        {watches.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Nenhum artista monitorado ainda. Use a busca acima ou importe o Top 200 do Global.
          </div>
        ) : (
          <>
            <input
              value={filter}
              onChange={(e) => { setFilter(e.target.value); setPage(1); }}
              placeholder="Filtrar por nome…"
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginBottom: 12, padding: "8px 12px", fontSize: 13 }}
            />
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Artista</th>
                    <th style={thStyle}>Origem</th>
                    <th style={thStyle}>Último lançamento</th>
                    <th style={thStyle}>Checado</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pageWatches.map((w) => (
                    <tr key={w.id}>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar src={w.imageUrl} name={w.name} />
                          <span style={{ fontWeight: 600 }}>{w.name}</span>
                        </div>
                      </td>
                      <td style={tdStyle}><SourceBadge source={w.source} /></td>
                      <td style={{ ...tdStyle, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {w.lastRelease ? `${w.lastRelease.title} (${formatDateBr(w.lastRelease.releaseDate)})` : "—"}
                      </td>
                      <td style={{ ...tdStyle, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{formatDateTimeBr(w.lastCheckedAt)}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: w.active ? "#1DB954" : "var(--text-muted)" }}>
                          {w.active ? "ativo" : "pausado"}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                        <button onClick={() => toggleActive(w)} disabled={busyId === w.id} style={{ ...smallButtonStyle, marginRight: 6 }}>
                          {w.active ? "Pausar" : "Ativar"}
                        </button>
                        <button
                          onClick={() => removeWatch(w)}
                          disabled={busyId === w.id}
                          style={{ ...smallButtonStyle, color: "#e5484d", borderColor: "#e5484d55" }}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 14 }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  style={{ ...smallButtonStyle, opacity: currentPage <= 1 ? 0.5 : 1 }}
                >
                  ← Anterior
                </button>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Página {currentPage} de {totalPages} · {filteredWatches.length} artista(s)
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  style={{ ...smallButtonStyle, opacity: currentPage >= totalPages ? 0.5 : 1 }}
                >
                  Próxima →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Últimos lançamentos registrados */}
      <div style={cardStyle}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>Últimos lançamentos registrados</div>
        {recent.length === 0 && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nada registrado ainda.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {recent.map((n) => (
            <div key={n.id} style={{ display: "flex", alignItems: "baseline", gap: 10, fontSize: 13 }}>
              <span style={{ color: "var(--text-muted)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                {formatDateTimeBr(n.notifiedAt)}
              </span>
              <span style={{ color: "var(--text)", fontWeight: 600 }}>{n.artistName}</span>
              <span style={{ color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {n.title}
              </span>
              <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>
                {n.announced ? "✓ avisado" : "baseline"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

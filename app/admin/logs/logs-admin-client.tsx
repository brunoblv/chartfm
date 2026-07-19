"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { adminTdStyle, adminThStyle, adminInputStyle } from "@/components/admin/admin-styles";
import type { SourceFilter, StatusFilter } from "./page";

type LogRow = {
  id: string;
  createdAt: string;
  method: string;
  path: string;
  source: string;
  ok: boolean;
  statusCode: number | null;
  errorMessage: string | null;
  userName: string | null;
  userHandle: string | null;
};

function formatBrasilia(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

type SpotifyProbeResult = {
  ok: boolean;
  status?: number;
  retryAfterMs?: number | null;
  error?: string;
};

function formatWaitTime(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "";
  const totalMinutes = Math.ceil(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}min`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}min`;
}

function SpotifyProbeButton({
  target,
  label,
}: {
  target: "primary" | "backup" | "backup2" | "backup3";
  label: string;
}) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<SpotifyProbeResult | null>(null);

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/spotify-status?target=${target}`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as SpotifyProbeResult | { error: string } | null;
      if (!data || "error" in data) {
        setResult({ ok: false, error: (data as { error?: string })?.error ?? "Erro ao testar." });
      } else {
        setResult(data);
      }
    } catch {
      setResult({ ok: false, error: "Erro de conexão ao testar." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={test}
        disabled={testing}
        style={{
          border: "1px solid var(--divider-strong)",
          background: "var(--fill-subtle)",
          color: "var(--text)",
          borderRadius: 8,
          padding: "7px 12px",
          fontSize: 13,
          fontWeight: 600,
          cursor: testing ? "not-allowed" : "pointer",
          opacity: testing ? 0.6 : 1,
        }}
      >
        {testing ? "Testando…" : `Testar ${label}`}
      </button>
      {result && (
        result.ok ? (
          <span style={{ color: "#16a34a", fontSize: 13, fontWeight: 600 }}>OK — sem rate limit</span>
        ) : result.status === 429 ? (
          <span style={{ color: "#dc2626", fontSize: 13, fontWeight: 600 }}>
            429 — esperar {formatWaitTime(result.retryAfterMs) || "alguns minutos"}
          </span>
        ) : (
          <span style={{ color: "#dc2626", fontSize: 13, fontWeight: 600 }}>
            Erro{result.status ? ` (${result.status})` : ""}{result.error ? `: ${result.error}` : ""}
          </span>
        )
      )}
    </div>
  );
}

type UsageSummary = {
  totalCalls: number;
  total429: number;
  byEndpoint: { endpoint: string; total: number; e429: number; topCallers: { caller: string; count: number }[] }[];
  byApp: { app: string; total: number; e429: number }[];
  byHour: { hourIso: string; total: number; e429: number }[];
  recent429s: { ts: number; endpoint: string; app: string; retryAfterS: number | null; caller: string }[];
  recentCalls: { ts: number; endpoint: string; app: string; status: number | null; caller: string }[];
};

function appLabel(app: string): string {
  switch (app) {
    case "primary":
      return "Principal";
    case "backup":
      return "Reserva (BACKUP)";
    case "backup2":
      return "Reserva 2 (criação de paradas)";
    case "backup3":
      return "Reserva 3 (crownnote)";
    case "token":
      return "Token (auth)";
    case "browser":
      return "Browser (legado)";
    default:
      return app;
  }
}

function SpotifyUsagePanel() {
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<UsageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(h: number) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/spotify-status?target=usage&hours=${h}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as UsageSummary);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminPanel maxWidth={1200}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Uso da API do Spotify</div>
        <select
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          style={{ ...adminInputStyle, width: "auto", padding: "4px 8px", fontSize: 13 }}
        >
          <option value={6}>Últimas 6h</option>
          <option value={24}>Últimas 24h</option>
          <option value={48}>Últimas 48h</option>
        </select>
        <button
          type="button"
          onClick={() => load(hours)}
          disabled={loading}
          style={{
            border: "1px solid var(--divider-strong)",
            background: "var(--fill-subtle)",
            color: "var(--text)",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 13,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Carregando…" : "Atualizar"}
        </button>
        {data && (
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {data.totalCalls} chamadas, {data.total429} × 429 — desde o último restart do app
          </span>
        )}
      </div>

      {error && <div style={{ color: "#dc2626", fontSize: 13 }}>{error}</div>}

      {data && data.byEndpoint.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Nenhuma chamada registrada na janela (o log zera quando o app reinicia).
        </div>
      )}

      {data && data.byEndpoint.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {data.byApp.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Por app</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={adminThStyle}>App</th>
                    <th style={adminThStyle}>Chamadas</th>
                    <th style={adminThStyle}>429</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byApp.map((a) => (
                    <tr key={a.app}>
                      <td style={adminTdStyle}>{appLabel(a.app)}</td>
                      <td style={adminTdStyle}>{a.total}</td>
                      <td
                        style={{
                          ...adminTdStyle,
                          color: a.e429 > 0 ? "#dc2626" : undefined,
                          fontWeight: a.e429 > 0 ? 700 : undefined,
                        }}
                      >
                        {a.e429}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={adminThStyle}>Endpoint</th>
                <th style={adminThStyle}>Chamadas</th>
                <th style={adminThStyle}>429</th>
                <th style={adminThStyle}>Principais origens</th>
              </tr>
            </thead>
            <tbody>
              {data.byEndpoint.map((e) => (
                <tr key={e.endpoint}>
                  <td style={{ ...adminTdStyle, fontFamily: "monospace", fontSize: 12 }}>{e.endpoint}</td>
                  <td style={adminTdStyle}>{e.total}</td>
                  <td style={{ ...adminTdStyle, color: e.e429 > 0 ? "#dc2626" : undefined, fontWeight: e.e429 > 0 ? 700 : undefined }}>
                    {e.e429}
                  </td>
                  <td style={{ ...adminTdStyle, fontSize: 12 }}>
                    {e.topCallers.map((c) => `${c.caller} (${c.count})`).join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data.byHour.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Por hora</div>
              <div style={{ display: "flex", gap: 4, alignItems: "flex-end", flexWrap: "wrap" }}>
                {data.byHour.map((h) => {
                  const max = Math.max(...data.byHour.map((x) => x.total), 1);
                  const height = Math.max(4, Math.round((h.total / max) * 60));
                  const hourLabel = new Date(h.hourIso).toLocaleTimeString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    hour: "2-digit",
                  });
                  return (
                    <div key={h.hourIso} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{h.total}</span>
                      <div
                        title={`${hourLabel}h — ${h.total} chamadas, ${h.e429} × 429`}
                        style={{
                          width: 18,
                          height,
                          borderRadius: 3,
                          background: h.e429 > 0 ? "#dc2626" : "var(--accent, #2563eb)",
                        }}
                      />
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{hourLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {data.recent429s.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: "#dc2626" }}>Últimos 429</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={adminThStyle}>Horário</th>
                    <th style={adminThStyle}>Endpoint</th>
                    <th style={adminThStyle}>App</th>
                    <th style={adminThStyle}>Retry-After</th>
                    <th style={adminThStyle}>Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent429s.map((r, i) => (
                    <tr key={`${r.ts}-${i}`}>
                      <td style={{ ...adminTdStyle, whiteSpace: "nowrap" }}>{formatBrasilia(new Date(r.ts).toISOString())}</td>
                      <td style={{ ...adminTdStyle, fontFamily: "monospace", fontSize: 12 }}>{r.endpoint}</td>
                      <td style={adminTdStyle}>{r.app}</td>
                      <td style={adminTdStyle}>{r.retryAfterS ? formatWaitTime(r.retryAfterS * 1000) : "—"}</td>
                      <td style={{ ...adminTdStyle, fontSize: 12 }}>{r.caller}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </AdminPanel>
  );
}

function sourceLabel(source: string): string {
  if (source === "system") return "Sistema (cron)";
  if (source === "user") return "Usuário";
  return "Anônimo";
}

function sourceBadgeStyle(source: string) {
  const colors: Record<string, string> = {
    system: "#8b5cf6",
    user: "#2563eb",
    anonymous: "#6b7280",
  };
  const color = colors[source] ?? colors.anonymous;
  return {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    color: "white",
    background: color,
    whiteSpace: "nowrap" as const,
  };
}

export function LogsAdminClient({
  logs,
  page,
  totalPages,
  total,
  query,
  source,
  status,
}: {
  logs: LogRow[];
  page: number;
  totalPages: number;
  total: number;
  query: string;
  source: SourceFilter;
  status: StatusFilter;
}) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(query);

  function pushParams(next: { q?: string; source?: string; status?: string; page?: number }) {
    const params = new URLSearchParams();
    const q = next.q ?? query;
    const src = next.source ?? source;
    const st = next.status ?? status;
    const pg = next.page ?? 1;
    if (q) params.set("q", q);
    if (src !== "all") params.set("source", src);
    if (st !== "all") params.set("status", st);
    if (pg > 1) params.set("page", String(pg));
    router.push(`/admin/logs${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    pushParams({ q: searchInput.trim() });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <AdminPanel maxWidth={1200}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Status do Spotify</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
          Principal e reserva (BACKUP) servem o app inteiro. BACKUP2 só entra na criação/import de paradas de
          usuário, quando as duas primeiras estão fora.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SpotifyProbeButton target="primary" label="API principal" />
          <SpotifyProbeButton target="backup" label="API reserva (BACKUP)" />
          <SpotifyProbeButton target="backup2" label="API reserva 2 (criação de paradas)" />
          <SpotifyProbeButton target="backup3" label="API reserva 3 (crownnote)" />
        </div>
      </AdminPanel>

      <SpotifyUsagePanel />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <form onSubmit={onSearchSubmit} style={{ flex: 1, minWidth: 220 }}>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por rota (ex: /api/admin/lancamentos)"
            style={adminInputStyle}
          />
        </form>

        <select
          value={source}
          onChange={(e) => pushParams({ source: e.target.value })}
          style={{ ...adminInputStyle, width: "auto" }}
        >
          <option value="all">Todas as origens</option>
          <option value="user">Usuário</option>
          <option value="system">Sistema (cron)</option>
          <option value="anonymous">Anônimo</option>
        </select>

        <select
          value={status}
          onChange={(e) => pushParams({ status: e.target.value })}
          style={{ ...adminInputStyle, width: "auto" }}
        >
          <option value="all">Ok e erro</option>
          <option value="ok">Só ok</option>
          <option value="error">Só erro</option>
        </select>

        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{total} chamadas</div>
      </div>

      <AdminPanel maxWidth={1200}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={adminThStyle}>Horário (Brasília)</th>
              <th style={adminThStyle}>Método</th>
              <th style={adminThStyle}>Rota</th>
              <th style={adminThStyle}>Quem</th>
              <th style={adminThStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td style={adminTdStyle} colSpan={5}>Nenhuma chamada encontrada.</td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id}>
                <td style={{ ...adminTdStyle, whiteSpace: "nowrap" }}>{formatBrasilia(log.createdAt)}</td>
                <td style={adminTdStyle}>{log.method}</td>
                <td style={{ ...adminTdStyle, fontFamily: "monospace", fontSize: 12 }}>{log.path}</td>
                <td style={adminTdStyle}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={sourceBadgeStyle(log.source)}>{sourceLabel(log.source)}</span>
                    {log.source === "user" && (
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {log.userName ?? "?"} {log.userHandle ? `(@${log.userHandle})` : ""}
                      </span>
                    )}
                  </div>
                </td>
                <td style={adminTdStyle}>
                  {log.ok ? (
                    <span style={{ color: "#16a34a", fontWeight: 700 }}>OK{log.statusCode ? ` (${log.statusCode})` : ""}</span>
                  ) : (
                    <span style={{ color: "#dc2626", fontWeight: 700 }} title={log.errorMessage ?? undefined}>
                      Erro{log.statusCode ? ` (${log.statusCode})` : ""}
                      {log.errorMessage ? `: ${log.errorMessage.slice(0, 80)}` : ""}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminPanel>

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center" }}>
          {page > 1 && (
            <Link href="#" onClick={(e) => { e.preventDefault(); pushParams({ page: page - 1 }); }}>
              ← Anterior
            </Link>
          )}
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Página {page} de {totalPages}
          </span>
          {page < totalPages && (
            <Link href="#" onClick={(e) => { e.preventDefault(); pushParams({ page: page + 1 }); }}>
              Próxima →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

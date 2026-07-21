"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { adminTdStyle, adminThStyle, adminInputStyle } from "@/components/admin/admin-styles";
import type { SourceFilter, StatusFilter } from "./page";
import {
  consumptionPlainSummary,
  friendlyApiPath,
  friendlyBudgetCategory,
  friendlySpotifyApp,
  friendlySpotifyCaller,
  friendlySpotifyEndpoint,
  sourceWhoLabel,
  triggerLabel,
} from "@/lib/api-log-labels";

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

type SystemErrorRow = {
  id: string;
  createdAt: string;
  scope: string;
  message: string;
  stack: string | null;
  path: string | null;
};

type AuditRow = {
  id: string;
  createdAt: string;
  action: string;
  summary: string;
  trigger: string;
  userName: string | null;
  userHandle: string | null;
  spotifyCalls: number;
  entityType: string | null;
  entityId: string | null;
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

function formatDuration(ms: number | null | undefined): string {
  if (ms == null || ms < 0) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
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
          <span style={{ color: "#16a34a", fontSize: 13, fontWeight: 600 }}>OK — respondendo normalmente</span>
        ) : result.status === 429 ? (
          <span style={{ color: "#dc2626", fontSize: 13, fontWeight: 600 }}>
            Limite atingido — esperar {formatWaitTime(result.retryAfterMs) || "alguns minutos"}
          </span>
        ) : (
          <span style={{ color: "#dc2626", fontSize: 13, fontWeight: 600 }}>
            Problema{result.status ? ` (código ${result.status})` : ""}{result.error ? `: ${result.error}` : ""}
          </span>
        )
      )}
    </div>
  );
}

type UsageSummary = {
  totalCalls: number;
  total429: number;
  avgDurationMs: number | null;
  byEndpoint: {
    endpoint: string;
    total: number;
    e429: number;
    avgDurationMs: number | null;
    topCallers: { caller: string; count: number }[];
  }[];
  byApp: { app: string; total: number; e429: number }[];
  byWho: { who: string; trigger: "manual" | "automatic"; total: number; e429: number }[];
  byHour: { hourIso: string; total: number; e429: number }[];
  recent429s: {
    ts: number;
    endpoint: string;
    app: string;
    retryAfterS: number | null;
    caller: string;
    who: string;
    trigger: "manual" | "automatic";
    durationMs: number | null;
  }[];
  recentCalls: {
    ts: number;
    endpoint: string;
    app: string;
    status: number | null;
    caller: string;
    who: string;
    trigger: "manual" | "automatic";
    path: string | null;
    durationMs: number | null;
  }[];
  budgets?: { category: string; used: number; limit: number }[];
};

function triggerBadgeStyle(trigger: string) {
  const automatic = trigger === "automatic";
  return {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    color: "white",
    background: automatic ? "#8b5cf6" : "#2563eb",
    whiteSpace: "nowrap" as const,
  };
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
      if (!res.ok) throw new Error(`Não foi possível carregar (código ${res.status})`);
      setData((await res.json()) as UsageSummary);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminPanel maxWidth={1200}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Consumo do Spotify</div>
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
      </div>

      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.45 }}>
        Cada linha mostra uma consulta que o ChartFM fez ao Spotify: quem pediu, se foi um clique
        (manual) ou uma tarefa do sistema (automática), e quanto tempo levou. O contador zera quando
        o app reinicia.
      </div>

      {error && <div style={{ color: "#dc2626", fontSize: 13 }}>{error}</div>}

      {data && (
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 14,
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--fill-subtle)",
            border: "1px solid var(--divider)",
          }}
        >
          {consumptionPlainSummary({
            totalCalls: data.totalCalls,
            total429: data.total429,
            avgDurationMs: data.avgDurationMs,
          })}
        </div>
      )}

      {data && data.byEndpoint.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Nenhuma consulta registrada neste período (ou o app acabou de reiniciar).
        </div>
      )}

      {data && data.byEndpoint.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {data.byWho && data.byWho.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Quem pediu (e quanto consumiu)</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={adminThStyle}>Quem</th>
                    <th style={adminThStyle}>Tipo</th>
                    <th style={adminThStyle}>Consultas</th>
                    <th style={adminThStyle}>Pediu espera</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byWho.map((w) => (
                    <tr key={w.who}>
                      <td style={adminTdStyle}>{w.who}</td>
                      <td style={adminTdStyle}>
                        <span style={triggerBadgeStyle(w.trigger)}>{triggerLabel(w.trigger)}</span>
                      </td>
                      <td style={adminTdStyle}>{w.total}</td>
                      <td
                        style={{
                          ...adminTdStyle,
                          color: w.e429 > 0 ? "#dc2626" : undefined,
                          fontWeight: w.e429 > 0 ? 700 : undefined,
                        }}
                      >
                        {w.e429 > 0 ? `${w.e429}×` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.budgets && data.budgets.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Orçamento do dia (tarefas automáticas)</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                Limite diário para tarefas de fundo — buscas e publicações feitas por pessoas não entram aqui.
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={adminThStyle}>Área</th>
                    <th style={adminThStyle}>Usado</th>
                    <th style={adminThStyle}>Limite</th>
                  </tr>
                </thead>
                <tbody>
                  {data.budgets.map((b) => (
                    <tr key={b.category}>
                      <td style={adminTdStyle}>{friendlyBudgetCategory(b.category)}</td>
                      <td
                        style={{
                          ...adminTdStyle,
                          color: b.used >= b.limit ? "#dc2626" : undefined,
                          fontWeight: b.used >= b.limit ? 700 : undefined,
                        }}
                      >
                        {b.used}
                      </td>
                      <td style={adminTdStyle}>{b.limit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.byApp.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Por conta Spotify</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={adminThStyle}>Conta</th>
                    <th style={adminThStyle}>Consultas</th>
                    <th style={adminThStyle}>Pediu espera</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byApp.map((a) => (
                    <tr key={a.app}>
                      <td style={adminTdStyle}>{friendlySpotifyApp(a.app)}</td>
                      <td style={adminTdStyle}>{a.total}</td>
                      <td
                        style={{
                          ...adminTdStyle,
                          color: a.e429 > 0 ? "#dc2626" : undefined,
                          fontWeight: a.e429 > 0 ? 700 : undefined,
                        }}
                      >
                        {a.e429 > 0 ? `${a.e429}×` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Por tipo de consulta</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={adminThStyle}>O que pediu</th>
                  <th style={adminThStyle}>Consultas</th>
                  <th style={adminThStyle}>Tempo médio</th>
                  <th style={adminThStyle}>Pediu espera</th>
                  <th style={adminThStyle}>Motivos mais comuns</th>
                </tr>
              </thead>
              <tbody>
                {data.byEndpoint.map((e) => (
                  <tr key={e.endpoint}>
                    <td style={adminTdStyle}>
                      <div>{friendlySpotifyEndpoint(e.endpoint)}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{e.endpoint}</div>
                    </td>
                    <td style={adminTdStyle}>{e.total}</td>
                    <td style={adminTdStyle}>{formatDuration(e.avgDurationMs)}</td>
                    <td
                      style={{
                        ...adminTdStyle,
                        color: e.e429 > 0 ? "#dc2626" : undefined,
                        fontWeight: e.e429 > 0 ? 700 : undefined,
                      }}
                    >
                      {e.e429 > 0 ? `${e.e429}×` : "—"}
                    </td>
                    <td style={{ ...adminTdStyle, fontSize: 12 }}>
                      {e.topCallers
                        .map((c) => `${friendlySpotifyCaller(c.caller)} (${c.count})`)
                        .join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.byHour.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Consultas por hora</div>
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
                        title={`${hourLabel}h — ${h.total} consultas${h.e429 > 0 ? `, ${h.e429} pediram espera` : ""}`}
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

          {data.recentCalls && data.recentCalls.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Últimas consultas</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={adminThStyle}>Horário</th>
                    <th style={adminThStyle}>Quem pediu</th>
                    <th style={adminThStyle}>Tipo</th>
                    <th style={adminThStyle}>O que pediu</th>
                    <th style={adminThStyle}>Consumo</th>
                    <th style={adminThStyle}>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentCalls.slice(0, 25).map((r, i) => (
                    <tr key={`${r.ts}-${i}`}>
                      <td style={{ ...adminTdStyle, whiteSpace: "nowrap" }}>
                        {formatBrasilia(new Date(r.ts).toISOString())}
                      </td>
                      <td style={adminTdStyle}>
                        <div>{r.who}</div>
                        {r.path && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }} title={r.path}>
                            {friendlyApiPath(r.path)}
                          </div>
                        )}
                      </td>
                      <td style={adminTdStyle}>
                        <span style={triggerBadgeStyle(r.trigger)}>{triggerLabel(r.trigger)}</span>
                      </td>
                      <td style={adminTdStyle}>
                        <div>{friendlySpotifyEndpoint(r.endpoint)}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {friendlySpotifyCaller(r.caller)} · {friendlySpotifyApp(r.app)}
                        </div>
                      </td>
                      <td style={adminTdStyle}>
                        1 consulta
                        {r.durationMs != null ? ` · ${formatDuration(r.durationMs)}` : ""}
                      </td>
                      <td style={adminTdStyle}>
                        {r.status == null ? (
                          <span style={{ color: "#dc2626", fontWeight: 600 }}>Falhou</span>
                        ) : r.status === 429 ? (
                          <span style={{ color: "#dc2626", fontWeight: 600 }}>Pediu espera</span>
                        ) : r.status >= 200 && r.status < 300 ? (
                          <span style={{ color: "#16a34a", fontWeight: 600 }}>OK</span>
                        ) : (
                          <span style={{ color: "#dc2626", fontWeight: 600 }}>Erro {r.status}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.recent429s.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: "#dc2626" }}>
                Quando o Spotify pediu para esperar
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={adminThStyle}>Horário</th>
                    <th style={adminThStyle}>Quem pediu</th>
                    <th style={adminThStyle}>O que pediu</th>
                    <th style={adminThStyle}>Esperar</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent429s.map((r, i) => (
                    <tr key={`${r.ts}-${i}`}>
                      <td style={{ ...adminTdStyle, whiteSpace: "nowrap" }}>
                        {formatBrasilia(new Date(r.ts).toISOString())}
                      </td>
                      <td style={adminTdStyle}>
                        <div>{r.who}</div>
                        <span style={{ ...triggerBadgeStyle(r.trigger), marginTop: 4 }}>
                          {triggerLabel(r.trigger)}
                        </span>
                      </td>
                      <td style={adminTdStyle}>
                        {friendlySpotifyEndpoint(r.endpoint)}
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {friendlySpotifyCaller(r.caller)} · {friendlySpotifyApp(r.app)}
                        </div>
                      </td>
                      <td style={adminTdStyle}>
                        {r.retryAfterS ? formatWaitTime(r.retryAfterS * 1000) : "alguns minutos"}
                      </td>
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

type LogsTab = "audit" | "system-errors" | "api-calls" | "spotify";

const TABS: { id: LogsTab; label: string }[] = [
  { id: "audit", label: "Auditoria do site" },
  { id: "system-errors", label: "Logs de sistema" },
  { id: "api-calls", label: "Chamadas internas" },
  { id: "spotify", label: "Spotify" },
];

function tabButtonStyle(active: boolean) {
  return {
    border: "1px solid var(--divider-strong)",
    background: active ? "var(--accent, #2563eb)" : "var(--fill-subtle)",
    color: active ? "white" : "var(--text)",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  };
}

export function LogsAdminClient({
  auditLogs,
  auditPage,
  auditTotalPages,
  auditTotal,
  logs,
  page,
  totalPages,
  total,
  query,
  source,
  status,
  errorLogs,
  errorPage,
  errorTotalPages,
  errorTotal,
  errorQuery,
}: {
  auditLogs: AuditRow[];
  auditPage: number;
  auditTotalPages: number;
  auditTotal: number;
  logs: LogRow[];
  page: number;
  totalPages: number;
  total: number;
  query: string;
  source: SourceFilter;
  status: StatusFilter;
  errorLogs: SystemErrorRow[];
  errorPage: number;
  errorTotalPages: number;
  errorTotal: number;
  errorQuery: string;
}) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(query);
  const [errorSearchInput, setErrorSearchInput] = useState(errorQuery);
  const [tab, setTab] = useState<LogsTab>(errorTotal > 0 ? "system-errors" : "audit");
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);

  function pushParams(next: {
    q?: string;
    source?: string;
    status?: string;
    page?: number;
    auditPage?: number;
    errorPage?: number;
    errorQ?: string;
  }) {
    const params = new URLSearchParams();
    const q = next.q ?? query;
    const src = next.source ?? source;
    const st = next.status ?? status;
    const pg = next.page ?? 1;
    const ap = next.auditPage ?? auditPage;
    const eq = next.errorQ ?? errorQuery;
    const ep = next.errorPage ?? 1;
    if (q) params.set("q", q);
    if (src !== "all") params.set("source", src);
    if (st !== "all") params.set("status", st);
    if (pg > 1) params.set("page", String(pg));
    if (ap > 1) params.set("auditPage", String(ap));
    if (eq) params.set("errorQ", eq);
    if (ep > 1) params.set("errorPage", String(ep));
    router.push(`/admin/logs${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    pushParams({ q: searchInput.trim(), page: 1, auditPage: 1 });
  }

  function onErrorSearchSubmit(e: FormEvent) {
    e.preventDefault();
    pushParams({ errorQ: errorSearchInput.trim(), errorPage: 1 });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={tabButtonStyle(tab === t.id)}
          >
            {t.label}
            {t.id === "system-errors" && errorTotal > 0 ? ` (${errorTotal})` : ""}
          </button>
        ))}
      </div>

      {tab === "system-errors" && (
        <AdminPanel maxWidth={1200}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Logs de sistema</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.45 }}>
            Erros reais de servidor (banco indisponível, exceções não tratadas etc.), com mensagem e
            stack trace completos — para diagnosticar incidentes sem precisar entrar por SSH no log do
            PM2. Fica guardado por 14 dias.
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <form onSubmit={onErrorSearchSubmit} style={{ flex: 1, minWidth: 220 }}>
              <input
                value={errorSearchInput}
                onChange={(e) => setErrorSearchInput(e.target.value)}
                placeholder="Buscar por rota, mensagem de erro ou caminho"
                style={adminInputStyle}
              />
            </form>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{errorTotal} registros</div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={adminThStyle}>Horário (Brasília)</th>
                <th style={adminThStyle}>Rota / origem</th>
                <th style={adminThStyle}>Erro</th>
              </tr>
            </thead>
            <tbody>
              {errorLogs.length === 0 && (
                <tr>
                  <td style={adminTdStyle} colSpan={3}>
                    Nenhum erro registrado — bom sinal.
                  </td>
                </tr>
              )}
              {errorLogs.map((e) => {
                const expanded = expandedErrorId === e.id;
                return (
                  <tr key={e.id}>
                    <td style={{ ...adminTdStyle, whiteSpace: "nowrap" }}>{formatBrasilia(e.createdAt)}</td>
                    <td style={adminTdStyle}>
                      <div style={{ fontWeight: 600 }}>{e.scope}</div>
                      {e.path && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{e.path}</div>
                      )}
                    </td>
                    <td style={adminTdStyle}>
                      <div style={{ color: "#dc2626", fontWeight: 600 }}>{e.message}</div>
                      {e.stack && (
                        <>
                          <button
                            type="button"
                            onClick={() => setExpandedErrorId(expanded ? null : e.id)}
                            style={{
                              marginTop: 4,
                              border: "none",
                              background: "none",
                              color: "var(--accent, #2563eb)",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                              padding: 0,
                            }}
                          >
                            {expanded ? "Esconder stack trace" : "Ver stack trace"}
                          </button>
                          {expanded && (
                            <pre
                              style={{
                                marginTop: 6,
                                padding: 10,
                                borderRadius: 8,
                                background: "var(--fill-subtle)",
                                border: "1px solid var(--divider)",
                                fontSize: 11,
                                lineHeight: 1.5,
                                overflowX: "auto",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                              }}
                            >
                              {e.stack}
                            </pre>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {errorTotalPages > 1 && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", marginTop: 12 }}>
              {errorPage > 1 && (
                <Link
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    pushParams({ errorPage: errorPage - 1 });
                  }}
                >
                  ← Anterior
                </Link>
              )}
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Página {errorPage} de {errorTotalPages}
              </span>
              {errorPage < errorTotalPages && (
                <Link
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    pushParams({ errorPage: errorPage + 1 });
                  }}
                >
                  Próxima →
                </Link>
              )}
            </div>
          )}
        </AdminPanel>
      )}

      {tab === "audit" && (
      <AdminPanel maxWidth={1200}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Auditoria do site</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.45 }}>
          Registro permanente do que as pessoas fizeram — por exemplo, quem criou cada parada e
          quantas consultas ao Spotify foram usadas. Fica guardado mesmo se o app reiniciar.
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <form onSubmit={onSearchSubmit} style={{ flex: 1, minWidth: 220 }}>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por nome, @handle ou texto (ex: criou a parada)"
              style={adminInputStyle}
            />
          </form>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{auditTotal} registros</div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={adminThStyle}>Horário (Brasília)</th>
              <th style={adminThStyle}>O que aconteceu</th>
              <th style={adminThStyle}>Tipo</th>
              <th style={adminThStyle}>Consumo Spotify</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.length === 0 && (
              <tr>
                <td style={adminTdStyle} colSpan={4}>
                  Ainda não há auditoria. Quando alguém publicar uma parada, aparece aqui.
                </td>
              </tr>
            )}
            {auditLogs.map((a) => (
              <tr key={a.id}>
                <td style={{ ...adminTdStyle, whiteSpace: "nowrap" }}>{formatBrasilia(a.createdAt)}</td>
                <td style={adminTdStyle}>
                  <div style={{ fontWeight: 600, lineHeight: 1.4 }}>{a.summary}</div>
                  {a.entityId && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {a.entityType === "chart" ? (
                        <Link href={`/chart/${a.entityId}`}>Ver parada</Link>
                      ) : (
                        a.entityId
                      )}
                    </div>
                  )}
                </td>
                <td style={adminTdStyle}>
                  <span style={triggerBadgeStyle(a.trigger)}>{triggerLabel(a.trigger)}</span>
                </td>
                <td style={adminTdStyle}>
                  {a.spotifyCalls <= 0
                    ? "Nenhuma consulta"
                    : a.spotifyCalls === 1
                      ? "1 consulta"
                      : `${a.spotifyCalls} consultas`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {auditTotalPages > 1 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", marginTop: 12 }}>
            {auditPage > 1 && (
              <Link
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  pushParams({ auditPage: auditPage - 1 });
                }}
              >
                ← Anterior
              </Link>
            )}
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Página {auditPage} de {auditTotalPages}
            </span>
            {auditPage < auditTotalPages && (
              <Link
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  pushParams({ auditPage: auditPage + 1 });
                }}
              >
                Próxima →
              </Link>
            )}
          </div>
        )}
      </AdminPanel>
      )}

      {tab === "spotify" && (
      <>
      <AdminPanel maxWidth={1200}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Status do Spotify</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
          Conta principal e reserva atendem o site. A reserva 2 é para criação/import de paradas. A
          reserva 3 (BACKUP3) serve Crownnote e os backfills com busca (capas/catálogo).
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SpotifyProbeButton target="primary" label="conta principal" />
          <SpotifyProbeButton target="backup" label="conta reserva" />
          <SpotifyProbeButton target="backup2" label="conta reserva 2 (paradas)" />
          <SpotifyProbeButton target="backup3" label="conta reserva 3 (Crownnote + backfill)" />
        </div>
      </AdminPanel>

      <SpotifyUsagePanel />
      </>
      )}

      {tab === "api-calls" && (
      <AdminPanel maxWidth={1200}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Chamadas internas do ChartFM</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.45 }}>
          Registro técnico de quem acionou cada rota do site: pessoa (manual) ou tarefa automática do sistema.
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <select
            value={source}
            onChange={(e) => pushParams({ source: e.target.value, page: 1 })}
            style={{ ...adminInputStyle, width: "auto" }}
          >
            <option value="all">Todos</option>
            <option value="user">Pessoas (manual)</option>
            <option value="system">Sistema (automática)</option>
            <option value="anonymous">Visitantes</option>
          </select>

          <select
            value={status}
            onChange={(e) => pushParams({ status: e.target.value, page: 1 })}
            style={{ ...adminInputStyle, width: "auto" }}
          >
            <option value="all">Ok e erro</option>
            <option value="ok">Só ok</option>
            <option value="error">Só erro</option>
          </select>

          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{total} registros</div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={adminThStyle}>Horário (Brasília)</th>
              <th style={adminThStyle}>O que aconteceu</th>
              <th style={adminThStyle}>Quem pediu</th>
              <th style={adminThStyle}>Tipo</th>
              <th style={adminThStyle}>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td style={adminTdStyle} colSpan={5}>Nenhuma chamada encontrada.</td>
              </tr>
            )}
            {logs.map((log) => {
              const trigger = log.source === "system" ? "automatic" : "manual";
              return (
                <tr key={log.id}>
                  <td style={{ ...adminTdStyle, whiteSpace: "nowrap" }}>{formatBrasilia(log.createdAt)}</td>
                  <td style={adminTdStyle}>
                    <div>{friendlyApiPath(log.path)}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {log.method} {log.path}
                    </div>
                  </td>
                  <td style={adminTdStyle}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={sourceBadgeStyle(log.source)}>
                        {log.source === "system"
                          ? "Sistema"
                          : log.source === "user"
                            ? "Pessoa"
                            : "Visitante"}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {sourceWhoLabel({
                          source: log.source,
                          userName: log.userName,
                          userHandle: log.userHandle,
                        })}
                      </span>
                    </div>
                  </td>
                  <td style={adminTdStyle}>
                    <span style={triggerBadgeStyle(trigger)}>{triggerLabel(trigger)}</span>
                  </td>
                  <td style={adminTdStyle}>
                    {log.ok ? (
                      <span style={{ color: "#16a34a", fontWeight: 700 }}>
                        Deu certo{log.statusCode ? ` (${log.statusCode})` : ""}
                      </span>
                    ) : (
                      <span style={{ color: "#dc2626", fontWeight: 700 }} title={log.errorMessage ?? undefined}>
                        Deu erro{log.statusCode ? ` (${log.statusCode})` : ""}
                        {log.errorMessage ? `: ${log.errorMessage.slice(0, 80)}` : ""}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </AdminPanel>
      )}

      {tab === "api-calls" && totalPages > 1 && (
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

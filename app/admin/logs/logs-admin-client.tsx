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

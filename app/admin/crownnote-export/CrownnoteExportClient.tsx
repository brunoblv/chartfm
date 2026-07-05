"use client";

import { useState } from "react";
import type { CrownnoteUserExport } from "@/lib/crownnote-export";
import type { CrownnoteSongMatchRow } from "@/lib/crownnote-song-match";
import CrownnoteMatchPanel from "./CrownnoteMatchPanel";

type Progress = {
  current: number;
  slug: string;
  entries: number;
};

type Step = "export" | "match";

const card: React.CSSProperties = {
  border: "1px solid var(--divider)",
  borderRadius: 12,
  padding: 16,
  background: "var(--surface, transparent)",
};

const btn = (disabled: boolean): React.CSSProperties => ({
  padding: "10px 16px",
  borderRadius: 8,
  border: "1px solid var(--divider)",
  background: disabled ? "var(--accent-tint)" : "var(--accent, #1db954)",
  color: disabled ? "var(--text-muted)" : "#fff",
  fontWeight: 600,
  fontSize: 14,
  cursor: disabled ? "default" : "pointer",
});

function downloadRawJson(data: CrownnoteUserExport, username: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `crownnote-${username}-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function CrownnoteExportClient() {
  const [step, setStep] = useState<Step>("export");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [exportData, setExportData] = useState<CrownnoteUserExport | null>(null);
  const [matchRows, setMatchRows] = useState<CrownnoteSongMatchRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function runMatch(data: CrownnoteUserExport) {
    setMatching(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/crownnote-export/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ export: data }),
      });
      const payload = (await res.json()) as {
        songs?: CrownnoteSongMatchRow[];
        error?: string;
      };
      if (!res.ok || !payload.songs) {
        throw new Error(payload.error ?? "Falha ao corresponder músicas.");
      }
      setMatchRows(payload.songs);
      setStep("match");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na correspondência.");
    } finally {
      setMatching(false);
    }
  }

  async function handleExport() {
    const value = username.trim().replace(/^@/, "");
    if (!value) {
      setError("Informe o usuário do Crownnote.");
      return;
    }

    setLoading(true);
    setError(null);
    setExportData(null);
    setMatchRows([]);
    setProgress(null);

    try {
      const res = await fetch("/api/admin/crownnote-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: value, stream: true }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Erro ${res.status}`);
      }

      if (!res.body) throw new Error("Resposta vazia do servidor.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let exported: CrownnoteUserExport | null = null;

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;

        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            type: string;
            message?: string;
            data?: CrownnoteUserExport;
            current?: number;
            slug?: string;
            entries?: number;
          };

          if (event.type === "progress" && event.slug) {
            setProgress({
              current: event.current ?? 0,
              slug: event.slug,
              entries: event.entries ?? 0,
            });
          } else if (event.type === "done" && event.data) {
            exported = event.data;
          } else if (event.type === "error") {
            throw new Error(event.message ?? "Erro ao exportar.");
          }
        }
      }

      if (!exported) throw new Error("Exportação não retornou dados.");
      setExportData(exported);
      await runMatch(exported);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao exportar.");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  if (step === "match" && exportData) {
    return (
      <CrownnoteMatchPanel
        exportData={exportData}
        initialRows={matchRows}
        onBack={() => setStep("export")}
      />
    );
  }

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 720 }}>
      <div style={card}>
        <p style={{ margin: "0 0 12px", color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6 }}>
          Informe o usuário do Crownnote (ex.: <code>whatthelucas</code>). O sistema extrai todas as
          paradas e, em seguida, tenta corresponder cada música ao catálogo do ChartFM. As não
          encontradas podem ser corrigidas manualmente antes de baixar o JSON final.
        </p>

        <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Usuário Crownnote</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="whatthelucas"
            disabled={loading || matching}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--divider)",
              background: "var(--bg)",
              color: "var(--text)",
              fontSize: 14,
            }}
          />
        </label>

        <button
          type="button"
          onClick={handleExport}
          disabled={loading || matching || !username.trim()}
          style={btn(loading || matching)}
        >
          {loading ? "Extraindo paradas..." : matching ? "Correspondendo músicas..." : "Extrair e revisar"}
        </button>

        {loading && progress && (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            Parada {progress.current}: <strong>{progress.slug}</strong> ({progress.entries} músicas)
          </p>
        )}

        {(loading || matching) && !progress && (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            {loading ? "Conectando ao Crownnote…" : "Buscando correspondências no catálogo…"}
          </p>
        )}
      </div>

      {error && (
        <div style={{ ...card, borderColor: "var(--danger, #e74c3c)", color: "var(--danger, #e74c3c)" }}>
          {error}
        </div>
      )}

      {exportData && step === "export" && (
        <div style={card}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Exportação concluída</h3>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
            <strong>@{exportData.username}</strong> — {exportData.stats.chartCount} paradas extraídas.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={btn(false)} onClick={() => runMatch(exportData)}>
              Revisar correspondências
            </button>
            <button type="button" style={btn(false)} onClick={() => downloadRawJson(exportData, exportData.username)}>
              Baixar JSON bruto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

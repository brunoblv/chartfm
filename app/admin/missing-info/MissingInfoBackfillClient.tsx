"use client";

import { useMemo, useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type BackfillResponse = {
  ok?: boolean;
  processed?: number;
  updated?: number;
  failed?: number;
  remaining?: number;
  message?: string;
  errors?: string[];
};

type Props = {
  initialTotal: number;
};

export function MissingInfoBackfillClient({ initialTotal }: Props) {
  const [running, setRunning] = useState(false);
  const [total, setTotal] = useState(initialTotal);
  const [processed, setProcessed] = useState(0);
  const [updated, setUpdated] = useState(0);
  const [failed, setFailed] = useState(0);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const percent = useMemo(() => {
    if (total <= 0) return 100;
    return Math.min(100, Math.round((processed / total) * 100));
  }, [processed, total]);

  async function runBackfill() {
    if (running) return;
    setRunning(true);
    setProcessed(0);
    setUpdated(0);
    setFailed(0);
    setErrors([]);
    setMessage("Buscando no Spotify...");

    let nextRemaining = initialTotal;
    let processedSum = 0;
    let updatedSum = 0;
    let failedSum = 0;

    try {
      while (nextRemaining > 0) {
        const res = await fetch("/api/admin/missing-info/backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 5 }),
        });
        const data = (await res.json()) as BackfillResponse;

        if (!res.ok || data.ok === false) {
          setMessage(data.message ?? "Não foi possível atualizar os metadados.");
          if (data.errors?.length) setErrors((prev) => [...prev, ...data.errors!].slice(-6));
          break;
        }

        const batchProcessed = data.processed ?? 0;
        const batchUpdated = data.updated ?? 0;
        const batchFailed = data.failed ?? 0;

        processedSum += batchProcessed;
        updatedSum += batchUpdated;
        failedSum += batchFailed;
        nextRemaining = data.remaining ?? 0;

        setProcessed(processedSum);
        setUpdated(updatedSum);
        setFailed(failedSum);
        setTotal(processedSum + nextRemaining);
        setMessage(nextRemaining > 0 ? "Atualizando catálogo..." : "Atualização concluída.");
        if (data.errors?.length) setErrors((prev) => [...prev, ...data.errors!].slice(-6));

        if (batchProcessed > 0 && batchUpdated === 0) {
          setMessage("Alguns itens precisam de revisão manual antes de continuar.");
          break;
        }

        if (batchProcessed === 0) break;
      }
    } catch {
      setMessage("Erro de conexão durante a atualização.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div
      style={{
        background: "white",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 14,
        padding: 16,
        marginBottom: 18,
        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ minWidth: 220, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, color: "#1D1D1F" }}>
            {running ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={18} />}
            Completar dados pelo Spotify
          </div>
          <div style={{ marginTop: 5, fontSize: 13, color: "#6B6B70", lineHeight: 1.45 }}>
            Atualiza capas, links, duração, álbum, artista, gêneros e datas quando houver correspondência confiável.
          </div>
        </div>

        <button
          type="button"
          onClick={runBackfill}
          disabled={running || total === 0}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            minHeight: 40,
            padding: "0 14px",
            borderRadius: 10,
            border: "none",
            background: running || total === 0 ? "#C7C7CC" : "#FA243C",
            color: "white",
            fontSize: 14,
            fontWeight: 700,
            cursor: running || total === 0 ? "default" : "pointer",
          }}
        >
          {running ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={16} />}
          {running ? "Atualizando" : "Buscar no Spotify"}
        </button>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ height: 8, borderRadius: 999, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div
            style={{
              width: `${percent}%`,
              height: "100%",
              borderRadius: 999,
              background: "#FA243C",
              transition: "width 180ms ease",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B6B70" }}>
            {percent === 100 && !running ? <CheckCircle2 size={14} color="#2D7A32" /> : <AlertCircle size={14} color="#86868B" />}
            {message || `${initialTotal.toLocaleString("pt-BR")} itens pendentes`}
          </span>
          <span style={{ fontSize: 13, color: "#6B6B70" }}>
            {processed.toLocaleString("pt-BR")} processados · {updated.toLocaleString("pt-BR")} atualizados · {failed.toLocaleString("pt-BR")} falhas
          </span>
        </div>
        {errors.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#C41E3A", display: "flex", flexDirection: "column", gap: 3 }}>
            {errors.map((err, index) => (
              <span key={`${err}-${index}`}>{err}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

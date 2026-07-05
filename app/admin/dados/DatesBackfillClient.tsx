"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarSearch, CheckCircle2, Loader2 } from "lucide-react";

type NotFoundItem = { id: string; label: string; href: string };

type BatchResponse = {
  ok?: boolean;
  processed?: number;
  updated?: number;
  remaining?: number;
  log?: string[];
  notFound?: NotFoundItem[];
  error?: string;
};

const CLIENT_BATCH_LIMIT = 2;
const CLIENT_BATCH_DELAY_MS = 800;
const LOG_MAX = 12;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Roda todas as músicas sem data de single/clipe: Wikipedia primeiro
 * (datas divergentes sobrescrevem), MusicBrainz para o que sobrar.
 */
export function DatesBackfillClient({
  initialTotal,
  scope,
}: {
  initialTotal: number;
  scope: "catalogo" | "minhas";
}) {
  const [running, setRunning] = useState(false);
  const [total, setTotal] = useState(initialTotal);
  const [processed, setProcessed] = useState(0);
  const [updated, setUpdated] = useState(0);
  const [message, setMessage] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [notFound, setNotFound] = useState<NotFoundItem[]>([]);

  const percent = useMemo(() => {
    if (total <= 0) return 100;
    return Math.min(100, Math.round((processed / total) * 100));
  }, [processed, total]);

  async function run() {
    if (running) return;
    setRunning(true);
    setProcessed(0);
    setUpdated(0);
    setLog([]);
    setNotFound([]);
    setMessage("Consultando Wikipedia e MusicBrainz…");

    let remaining = initialTotal;
    let processedSum = 0;
    let updatedSum = 0;
    const exclude: string[] = [];
    const notFoundAll = new Map<string, NotFoundItem>();

    try {
      while (remaining > 0) {
        const res = await fetch("/api/admin/edicao-de-dados/backfill-dates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: CLIENT_BATCH_LIMIT, scope, exclude }),
        });
        const data = (await res.json().catch(() => ({}))) as BatchResponse;
        if (!res.ok || !data.ok) {
          setMessage(data.error ?? "Erro durante o backfill.");
          break;
        }

        processedSum += data.processed ?? 0;
        updatedSum += data.updated ?? 0;
        remaining = data.remaining ?? 0;

        setProcessed(processedSum);
        setUpdated(updatedSum);
        setTotal(processedSum + remaining);
        if (data.log?.length) setLog((prev) => [...data.log!, ...prev].slice(0, LOG_MAX));
        for (const item of data.notFound ?? []) {
          notFoundAll.set(item.id, item);
          exclude.push(item.id);
        }
        setNotFound([...notFoundAll.values()]);
        setMessage(remaining > 0 ? `Processando… (${remaining} restantes)` : "Concluído.");

        if ((data.processed ?? 0) === 0) break;
        if (remaining > 0) await sleep(CLIENT_BATCH_DELAY_MS);
      }
    } catch {
      setMessage("Erro de conexão durante o backfill.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--divider)",
        borderRadius: 14,
        padding: 16,
        marginBottom: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ minWidth: 220, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
            {running ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <CalendarSearch size={18} />}
            Buscar datas de single e clipe
          </div>
          <div style={{ marginTop: 5, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.45 }}>
            Roda todas as músicas {scope === "minhas" ? "das suas paradas" : "do catálogo"} sem data de
            single ou de clipe. Wikipedia primeiro (quando divergir, vale a dela); MusicBrainz completa o
            que sobrar. Lento por respeito aos limites das APIs (~1 música a cada poucos segundos).
          </div>
        </div>

        <button
          type="button"
          onClick={run}
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
            background: running || total === 0 ? "var(--fill-inset)" : "#FA243C",
            color: running || total === 0 ? "var(--text-muted)" : "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: running || total === 0 ? "default" : "pointer",
          }}
        >
          {running ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <CalendarSearch size={16} />}
          {running ? "Buscando…" : total === 0 ? "Tudo preenchido" : `Rodar ${total.toLocaleString("pt-BR")} músicas`}
        </button>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ height: 8, borderRadius: 999, background: "var(--fill-inset)", overflow: "hidden" }}>
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
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
            {percent === 100 && !running && processed > 0 && <CheckCircle2 size={14} color="#2D7A32" />}
            {message || `${total.toLocaleString("pt-BR")} músicas sem data de single ou clipe`}
          </span>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {processed.toLocaleString("pt-BR")} processadas · {updated.toLocaleString("pt-BR")} atualizadas ·{" "}
            {notFound.length.toLocaleString("pt-BR")} sem resultado
          </span>
        </div>

        {log.length > 0 && (
          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--fill-inset)",
              fontSize: 12,
              lineHeight: 1.6,
              color: "var(--text-muted)",
              maxHeight: 180,
              overflowY: "auto",
            }}
          >
            {log.map((line, i) => (
              <div key={`${line}-${i}`} style={line.startsWith("✓") ? { color: "#2D7A32" } : undefined}>
                {line}
              </div>
            ))}
          </div>
        )}

        {notFound.length > 0 && !running && (
          <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)" }}>
            Sem resultado em nenhuma fonte (preencha manualmente clicando na data, ou tente os botões
            WIKI/MB na linha da música):
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
              {notFound.slice(0, 20).map((item) => (
                <Link key={item.id} href={item.href} style={{ color: "#FA243C", fontWeight: 700, textDecoration: "none", fontSize: 13 }}>
                  {item.label}
                </Link>
              ))}
              {notFound.length > 20 && <span>… e mais {notFound.length - 20}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

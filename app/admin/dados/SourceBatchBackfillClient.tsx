"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Layers, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type Kind = "music" | "albums" | "artists";
type Source = "lastfm" | "spotify" | "musicbrainz" | "wikipedia" | "all";

const SOURCES: { key: Source; label: string; title: string }[] = [
  { key: "all", label: "Todas as APIs", title: "Roda Spotify, MusicBrainz, Last.fm e Wikipedia, nessa ordem, para cada item" },
  { key: "spotify", label: "Spotify", title: "Só Spotify" },
  { key: "musicbrainz", label: "MusicBrainz", title: "Só MusicBrainz" },
  { key: "lastfm", label: "Last.fm", title: "Só Last.fm" },
  { key: "wikipedia", label: "Wikipedia", title: "Só Wikipedia" },
];

type FailedItem = { id: string | number; label: string; href: string; reason: string };

type BatchResponse = {
  ok?: boolean;
  processed?: number;
  updated?: number;
  remaining?: number;
  log?: string[];
  attemptedIds?: (string | number)[];
  failedItems?: FailedItem[];
  message?: string;
  status?: number;
  retryAfterMs?: number | null;
};

const CLIENT_BATCH_DELAY_MS = 700;
const MAX_CONSECUTIVE_STALLS = 6;
const STALL_BASE_DELAY_MS = 5000;
const STALL_MAX_DELAY_MS = 60000;
const LOG_MAX = 12;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Backfill em lote por tipo de item: um botão roda todas as APIs juntas
 * (Spotify → MusicBrainz → Last.fm → Wikipedia) para cada registro pendente,
 * e um botão por API roda só aquela fonte para todos os registros pendentes.
 * Complementa os botões individuais por linha em /admin/dados (mantidos como estão).
 */
export function SourceBatchBackfillClient({
  kind,
  title,
  description,
  initialTotal,
}: {
  kind: Kind;
  title: string;
  description: string;
  initialTotal: number;
}) {
  const [running, setRunning] = useState<Source | null>(null);
  const [force, setForce] = useState(false);
  const [total, setTotal] = useState(initialTotal);
  const [processed, setProcessed] = useState(0);
  const [updated, setUpdated] = useState(0);
  const [message, setMessage] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [failedItems, setFailedItems] = useState<FailedItem[]>([]);

  const percent = useMemo(() => {
    if (total <= 0) return 100;
    return Math.min(100, Math.round((processed / total) * 100));
  }, [processed, total]);

  async function run(source: Source) {
    if (running) return;
    setRunning(source);
    setProcessed(0);
    setUpdated(0);
    setLog([]);
    setFailedItems([]);
    setMessage("Buscando…");

    let nextRemaining = initialTotal;
    let processedSum = 0;
    let updatedSum = 0;
    let consecutiveStalls = 0;
    const exclude: (string | number)[] = [];
    const failedById = new Map<string | number, FailedItem>();

    try {
      while (nextRemaining > 0) {
        const res = await fetch("/api/admin/edicao-de-dados/backfill-source", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, source, exclude, force }),
        });
        const data = (await res.json().catch(() => ({}))) as BatchResponse;

        if (!res.ok || data.ok === false) {
          const rateLimited = data.status === 429;
          if (rateLimited && consecutiveStalls < MAX_CONSECUTIVE_STALLS) {
            consecutiveStalls += 1;
            const wait = Math.min(STALL_MAX_DELAY_MS, data.retryAfterMs ?? STALL_BASE_DELAY_MS * consecutiveStalls);
            setMessage(`Limitado pela API. Tentando de novo em ${Math.ceil(wait / 1000)}s...`);
            await sleep(wait);
            continue;
          }
          setMessage(data.message ?? "Não foi possível concluir a busca.");
          break;
        }

        const batchProcessed = data.processed ?? 0;
        processedSum += batchProcessed;
        updatedSum += data.updated ?? 0;
        nextRemaining = data.remaining ?? 0;

        setProcessed(processedSum);
        setUpdated(updatedSum);
        setTotal(processedSum + nextRemaining);
        if (data.log?.length) setLog((prev) => [...data.log!, ...prev].slice(0, LOG_MAX));

        for (const id of data.attemptedIds ?? []) exclude.push(id);
        if (data.failedItems?.length) {
          for (const item of data.failedItems) failedById.set(item.id, item);
          setFailedItems([...failedById.values()]);
        }

        if (batchProcessed === 0) {
          if (nextRemaining === 0) break;
          consecutiveStalls += 1;
          if (consecutiveStalls > MAX_CONSECUTIVE_STALLS) {
            setMessage("A API continua limitando as requisições. Tente novamente mais tarde.");
            break;
          }
          const wait = Math.min(STALL_MAX_DELAY_MS, STALL_BASE_DELAY_MS * consecutiveStalls);
          setMessage(`Nada processado nesse lote. Tentando de novo em ${Math.ceil(wait / 1000)}s...`);
          await sleep(wait);
          continue;
        }

        consecutiveStalls = 0;
        setMessage(nextRemaining > 0 ? "Processando…" : "Concluído.");
        if (nextRemaining > 0) await sleep(CLIENT_BATCH_DELAY_MS);
      }
      if (failedById.size > 0 && nextRemaining === 0) {
        setMessage("Concluído. Alguns itens não retornaram dados — ajuste manual.");
      }
    } catch {
      setMessage("Erro de conexão durante a busca.");
    } finally {
      setRunning(null);
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
        {running ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <Layers size={18} />}
        {title}
      </div>
      <div style={{ marginTop: 5, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.45 }}>{description}</div>

      <label
        style={{
          marginTop: 10,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "var(--text-muted)",
          cursor: running ? "default" : "pointer",
        }}
        title="Por padrão cada fonte só é consultada uma vez por registro — se não achar nada, fica marcada e é pulada nas próximas rodadas. Marque para forçar todas de novo."
      >
        <input
          type="checkbox"
          checked={force}
          disabled={running != null}
          onChange={(e) => setForce(e.target.checked)}
        />
        Forçar (ignora marcações de &quot;sem resultado&quot; e consulta tudo de novo — geral)
      </label>

      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {SOURCES.map((s) => {
          const isRunning = running === s.key;
          const disabled = running != null || total === 0;
          return (
            <button
              key={s.key}
              type="button"
              title={s.title}
              onClick={() => run(s.key)}
              disabled={disabled}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                minHeight: 36,
                padding: "0 12px",
                borderRadius: 9,
                border: s.key === "all" ? "none" : "1px solid var(--divider-strong)",
                background: disabled
                  ? "var(--fill-inset)"
                  : s.key === "all"
                    ? "#FA243C"
                    : "var(--surface)",
                color: disabled ? "var(--text-muted)" : s.key === "all" ? "#fff" : "var(--text)",
                fontSize: 13,
                fontWeight: s.key === "all" ? 750 : 600,
                cursor: disabled ? "default" : "pointer",
              }}
            >
              {isRunning && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
              {s.label}
            </button>
          );
        })}
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
            {percent === 100 && !running && processed > 0 ? (
              <CheckCircle2 size={14} color="#2D7A32" />
            ) : (
              <AlertCircle size={14} color="#86868B" />
            )}
            {message || `${total.toLocaleString("pt-BR")} pendentes`}
          </span>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {processed.toLocaleString("pt-BR")} processados · {updated.toLocaleString("pt-BR")} atualizados
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
              maxHeight: 160,
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

        {failedItems.length > 0 && !running && (
          <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)" }}>
            {failedItems.length.toLocaleString("pt-BR")} sem resultado nesta rodada. Corrija manualmente ou rode de novo mais tarde:
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
              {failedItems.slice(0, 20).map((item) => (
                <Link key={`${item.id}`} href={item.href} style={{ color: "#FA243C", fontWeight: 700, textDecoration: "none", fontSize: 13 }}>
                  {item.label}
                </Link>
              ))}
              {failedItems.length > 20 && <span>… e mais {failedItems.length - 20}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, Loader2, SkipForward } from "lucide-react";
import { AdminSongNameLink } from "@/components/admin/AdminEntityLinks";

type FailedItem = {
  id: string;
  title: string;
  artist: string;
  reason: string;
};

type BackfillResponse = {
  ok?: boolean;
  processed?: number;
  found?: number;
  needsReview?: number;
  errors?: number;
  remaining?: number;
  message?: string;
  failedItems?: FailedItem[];
};

type Props = {
  initialTotal: number;
};

const CLIENT_BATCH_LIMIT = 30;
const CLIENT_BATCH_DELAY_MS = 800;
const MAX_CONSECUTIVE_STALLS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function YouTubeClipsBackfillClient({ initialTotal }: Props) {
  const [running, setRunning] = useState(false);
  const [total, setTotal] = useState(initialTotal);
  const [processed, setProcessed] = useState(0);
  const [found, setFound] = useState(0);
  const [needsReview, setNeedsReview] = useState(0);
  const [errors, setErrors] = useState(0);
  const [message, setMessage] = useState("");
  const [failedItems, setFailedItems] = useState<FailedItem[]>([]);
  const [selectedForReview, setSelectedForReview] = useState<Set<string>>(new Set());

  const percent = useMemo(() => {
    if (total <= 0) return 100;
    return Math.min(100, Math.round((processed / total) * 100));
  }, [processed, total]);

  const handleToggleReview = (songId: string) => {
    const newSelected = new Set(selectedForReview);
    if (newSelected.has(songId)) {
      newSelected.delete(songId);
    } else {
      newSelected.add(songId);
    }
    setSelectedForReview(newSelected);
  };

  async function runBackfill() {
    if (running) return;
    setRunning(true);
    setProcessed(0);
    setFound(0);
    setNeedsReview(0);
    setErrors(0);
    setFailedItems([]);
    setSelectedForReview(new Set());
    setMessage("Buscando video clipes no YouTube...");

    let nextRemaining = initialTotal;
    let processedSum = 0;
    let foundSum = 0;
    let reviewSum = 0;
    let errorSum = 0;
    let consecutiveStalls = 0;
    const excludeSongIds: string[] = [];
    const failedById = new Map<string, FailedItem>();

    try {
      while (nextRemaining > 0) {
        const markForReview = Array.from(selectedForReview);
        const res = await fetch("/api/admin/songs/backfill-youtube-clips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            limit: CLIENT_BATCH_LIMIT,
            excludeSongIds,
            markForReview,
          }),
        });
        const data = (await res.json()) as BackfillResponse;

        if (!res.ok || data.ok === false) {
          setMessage(data.message ?? "Não foi possível buscar clipes no YouTube.");
          break;
        }

        const batchProcessed = data.processed ?? 0;
        processedSum += batchProcessed;
        foundSum += data.found ?? 0;
        reviewSum += data.needsReview ?? 0;
        errorSum += data.errors ?? 0;
        nextRemaining = data.remaining ?? 0;

        setProcessed(processedSum);
        setFound(foundSum);
        setNeedsReview(reviewSum);
        setErrors(errorSum);
        setTotal(processedSum + nextRemaining);

        if (data.failedItems?.length) {
          for (const item of data.failedItems) {
            failedById.set(item.id, item);
            if (!excludeSongIds.includes(item.id)) excludeSongIds.push(item.id);
          }
          setFailedItems([...failedById.values()]);
        }

        if (batchProcessed === 0) {
          if (nextRemaining === 0) break;
          consecutiveStalls += 1;
          if (consecutiveStalls > MAX_CONSECUTIVE_STALLS) {
            setMessage("YouTube limitando requisições. Tente novamente mais tarde.");
            break;
          }
          const wait = 3000 * consecutiveStalls;
          setMessage(`Nenhum clipe encontrado nesse lote. Tentando de novo em ${Math.ceil(wait / 1000)}s...`);
          await sleep(wait);
          continue;
        }

        consecutiveStalls = 0;
        const status = `Encontrados: ${foundSum} | Revisão manual: ${reviewSum}`;
        setMessage(nextRemaining > 0 ? `${status}. Processando próximo lote...` : `Backfill concluído. ${status}`);
        if (nextRemaining > 0) await sleep(CLIENT_BATCH_DELAY_MS);
      }

      if (failedById.size > 0 || reviewSum > 0) {
        setMessage("Concluído. Algumas músicas precisam de revisão manual.");
      }
    } catch {
      setMessage("Erro de conexão durante o backfill.");
    } finally {
      setRunning(false);
    }
  }

  const showReviewPanel = failedItems.length > 0 || needsReview > 0;

  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          background: "var(--panel-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, flex: 1 }}>
            Video Clipes do YouTube
          </h3>
          <span
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              background: "var(--input-bg)",
              padding: "4px 8px",
              borderRadius: 4,
            }}
          >
            {total} músicas
          </span>
        </div>

        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Busca automática de video clipes oficiais. Exclui lyrics videos e visualizers.
          Músicas sem clipes são marcadas para revisão manual.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            onClick={runBackfill}
            disabled={running || total === 0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              background: running ? "var(--text-muted)" : "#FA243C",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: running ? "default" : "pointer",
              fontSize: 13,
              fontWeight: 600,
              opacity: running || total === 0 ? 0.6 : 1,
            }}
          >
            {running ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={16} />}
            {running ? "Buscando..." : "Iniciar Backfill"}
          </button>
        </div>

        {message && (
          <div
            style={{
              background: "var(--input-bg)",
              border: "1px solid var(--border-color)",
              borderRadius: 6,
              padding: 12,
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {message}
          </div>
        )}

        {/* Progress Bar */}
        {percent > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                height: 6,
                background: "var(--input-bg)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${percent}%`,
                  background: "#4CAF50",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 8,
                fontSize: 12,
                color: "var(--text-muted)",
              }}
            >
              <span>{percent}% concluído</span>
              <span>
                {processed}/{total}
              </span>
            </div>
          </div>
        )}

        {/* Stats */}
        {(found > 0 || needsReview > 0 || errors > 0) && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              marginBottom: 12,
            }}
          >
            {found > 0 && (
              <div
                style={{
                  background: "rgba(76, 175, 80, 0.1)",
                  border: "1px solid #4CAF50",
                  borderRadius: 6,
                  padding: 12,
                  textAlign: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 4 }}>
                  <CheckCircle2 size={16} style={{ color: "#4CAF50" }} />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Encontrados</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#4CAF50" }}>{found}</div>
              </div>
            )}

            {needsReview > 0 && (
              <div
                style={{
                  background: "rgba(255, 152, 0, 0.1)",
                  border: "1px solid #FF9800",
                  borderRadius: 6,
                  padding: 12,
                  textAlign: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 4 }}>
                  <AlertCircle size={16} style={{ color: "#FF9800" }} />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Revisão Manual</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#FF9800" }}>{needsReview}</div>
              </div>
            )}

            {errors > 0 && (
              <div
                style={{
                  background: "rgba(244, 67, 54, 0.1)",
                  border: "1px solid #F44336",
                  borderRadius: 6,
                  padding: 12,
                  textAlign: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 4 }}>
                  <AlertCircle size={16} style={{ color: "#F44336" }} />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Erros</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#F44336" }}>{errors}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Failed Items Panel */}
      {showReviewPanel && (
        <div
          style={{
            background: "var(--panel-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: 8,
            padding: 16,
            marginTop: 12,
          }}
        >
          <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600 }}>
            Marcadas para Revisão Manual ({failedItems.length})
          </h4>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              maxHeight: 400,
              overflowY: "auto",
            }}
          >
            {failedItems.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 8,
                  background: "var(--input-bg)",
                  borderRadius: 4,
                  fontSize: 12,
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedForReview.has(item.id)}
                  onChange={() => handleToggleReview(item.id)}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>
                    <AdminSongNameLink songId={item.id} title={item.title} artist={item.artist} />
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
                    {item.reason}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selectedForReview.size > 0 && (
            <button
              onClick={() => runBackfill()}
              disabled={running}
              style={{
                marginTop: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 12px",
                background: "var(--input-bg)",
                border: "1px solid var(--border-color)",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <SkipForward size={14} />
              Pular Selecionadas ({selectedForReview.size})
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

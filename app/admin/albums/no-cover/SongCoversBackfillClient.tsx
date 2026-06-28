"use client";

import { useMemo, useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, Loader2, ImageOff } from "lucide-react";
import { AdminSongLinks, AdminSongNameLink } from "@/components/admin/AdminEntityLinks";

type FailedItem = {
  id: string;
  title: string;
  artist: string;
  spotifyId: string | null;
  invalidSpotifyId: boolean;
};

type BackfillResponse = {
  ok?: boolean;
  processed?: number;
  updated?: number;
  skipped?: number;
  viaBatch?: number;
  viaSearch?: number;
  remaining?: number;
  message?: string;
  tokenMissing?: boolean;
  failedItems?: FailedItem[];
};

type Props = {
  initialTotal: number;
  spotifyConfigured: boolean;
};

const CLIENT_BATCH_LIMIT = 50;
const CLIENT_BATCH_DELAY_MS = 600;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function SongCoversBackfillClient({ initialTotal, spotifyConfigured }: Props) {
  const [running, setRunning] = useState(false);
  const [total, setTotal] = useState(initialTotal);
  const [processed, setProcessed] = useState(0);
  const [updated, setUpdated] = useState(0);
  const [viaSearch, setViaSearch] = useState(0);
  const [message, setMessage] = useState("");
  const [failedItems, setFailedItems] = useState<FailedItem[]>([]);

  const percent = useMemo(() => {
    if (total <= 0) return 100;
    return Math.min(100, Math.round((processed / total) * 100));
  }, [processed, total]);

  async function runBackfill() {
    if (running) return;
    setRunning(true);
    setProcessed(0);
    setUpdated(0);
    setViaSearch(0);
    setFailedItems([]);
    setMessage("Buscando capas no Spotify...");

    let nextRemaining = initialTotal;
    let processedSum = 0;
    let updatedSum = 0;
    let searchSum = 0;
    const excludeSongIds: string[] = [];
    const failedById = new Map<string, FailedItem>();

    try {
      while (nextRemaining > 0) {
        const res = await fetch("/api/admin/songs/backfill-covers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: CLIENT_BATCH_LIMIT, excludeSongIds }),
        });
        const data = (await res.json()) as BackfillResponse;

        if (!res.ok || data.ok === false) {
          setMessage(data.message ?? "Não foi possível buscar capas no Spotify.");
          break;
        }

        if (data.tokenMissing) {
          setMessage("Token do Spotify indisponível. Verifique as credenciais no servidor.");
          break;
        }

        const batchProcessed = data.processed ?? 0;
        processedSum += batchProcessed;
        updatedSum += data.updated ?? 0;
        searchSum += data.viaSearch ?? 0;
        nextRemaining = data.remaining ?? 0;

        setProcessed(processedSum);
        setUpdated(updatedSum);
        setViaSearch(searchSum);
        setTotal(processedSum + nextRemaining);
        setMessage(nextRemaining > 0 ? "Vinculando capas de álbum..." : "Backfill de capas concluído.");

        if (data.failedItems?.length) {
          for (const item of data.failedItems) {
            failedById.set(item.id, item);
            if (!excludeSongIds.includes(item.id)) excludeSongIds.push(item.id);
          }
          setFailedItems([...failedById.values()]);
        }

        if (batchProcessed === 0) {
          setTotal(processedSum);
          break;
        }
        if (nextRemaining > 0) await sleep(CLIENT_BATCH_DELAY_MS);
      }

      if (failedById.size > 0) {
        setMessage("Concluído. Algumas músicas precisam de ajuste manual.");
      }
    } catch {
      setMessage("Erro de conexão durante o backfill.");
    } finally {
      setRunning(false);
      if (nextRemaining === 0 && failedById.size === 0) {
        window.location.reload();
      }
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
            {running ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <ImageOff size={18} />}
            Buscar capas no Spotify
          </div>
          <div style={{ marginTop: 5, fontSize: 13, color: "#6B6B70", lineHeight: 1.45 }}>
            Vincula álbum e capa às músicas que entraram nas paradas sem metadados completos.
            Usa lotes de até {CLIENT_BATCH_LIMIT} faixas por requisição, com busca por título quando o ID falha.
          </div>
          {!spotifyConfigured && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#C41E3A", fontWeight: 600 }}>
              Spotify não configurado no servidor (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET).
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={runBackfill}
          disabled={running || total === 0 || !spotifyConfigured}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            minHeight: 40,
            padding: "0 14px",
            borderRadius: 10,
            border: "none",
            background: running || total === 0 || !spotifyConfigured ? "#C7C7CC" : "#FA243C",
            color: "white",
            fontSize: 14,
            fontWeight: 700,
            cursor: running || total === 0 || !spotifyConfigured ? "default" : "pointer",
          }}
        >
          {running ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={16} />}
          {running ? "Buscando capas" : "Rodar backfill"}
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
            {message || `${initialTotal.toLocaleString("pt-BR")} músicas sem capa`}
          </span>
          <span style={{ fontSize: 13, color: "#6B6B70" }}>
            {processed.toLocaleString("pt-BR")} processadas · {updated.toLocaleString("pt-BR")} com capa · {viaSearch.toLocaleString("pt-BR")} via busca
          </span>
        </div>

        {failedItems.length > 0 && (
          <div style={{ marginTop: 14, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 750, color: "#1D1D1F" }}>Sem match automático ({failedItems.length})</div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {failedItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "#FBFBFD",
                    border: "1px solid rgba(0,0,0,0.08)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1D1D1F" }}>
                      <AdminSongNameLink song={{ id: item.id, title: item.title, artist: item.artist, spotifyId: item.spotifyId }} />
                    </div>
                    <div style={{ marginTop: 2, fontSize: 12, color: "#86868B" }}>{item.artist}</div>
                    <div style={{ marginTop: 2, fontSize: 12, color: "#86868B" }}>
                      {item.invalidSpotifyId ? "ID Spotify inválido no banco" : "Spotify não retornou capa confiável"}
                    </div>
                  </div>
                  <AdminSongLinks song={{ id: item.id, title: item.title, artist: item.artist, spotifyId: item.spotifyId }} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

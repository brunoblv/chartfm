"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, CheckCircle2, AlertCircle, Loader2, Wrench } from "lucide-react";

type ManualItem = {
  type: "song" | "artist" | "album";
  id: string;
  label: string;
  href: string;
  reason: string;
  conflict?: { label: string; href: string };
};

type BackfillResponse = {
  ok?: boolean;
  processed?: number;
  updated?: number;
  failed?: number;
  remaining?: number;
  message?: string;
  errors?: string[];
  manualItems?: ManualItem[];
};

type Props = {
  initialTotal: number;
};

const CLIENT_BATCH_LIMIT = 2;
const CLIENT_BATCH_DELAY_MS = 1200;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function MissingInfoBackfillClient({ initialTotal }: Props) {
  const [running, setRunning] = useState(false);
  const [total, setTotal] = useState(initialTotal);
  const [processed, setProcessed] = useState(0);
  const [updated, setUpdated] = useState(0);
  const [failed, setFailed] = useState(0);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [manualItems, setManualItems] = useState<ManualItem[]>([]);

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
    setManualItems([]);
    setMessage("Buscando no Spotify...");

    let nextRemaining = initialTotal;
    let processedSum = 0;
    let updatedSum = 0;
    let failedSum = 0;
    const exclude = {
      songIds: [] as string[],
      artistSpotifyIds: [] as string[],
      albumSpotifyIds: [] as string[],
    };
    const manualByKey = new Map<string, ManualItem>();

    try {
      while (nextRemaining > 0) {
        const res = await fetch("/api/admin/missing-info/backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: CLIENT_BATCH_LIMIT, exclude }),
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
        if (data.manualItems?.length) {
          for (const item of data.manualItems) {
            manualByKey.set(`${item.type}:${item.id}`, item);
            if (item.type === "song") exclude.songIds.push(item.id);
            if (item.type === "artist") exclude.artistSpotifyIds.push(item.id);
            if (item.type === "album") exclude.albumSpotifyIds.push(item.id);
          }
          setManualItems([...manualByKey.values()]);
        }

        if (batchProcessed === 0) {
          setTotal(processedSum);
          break;
        }
        if (nextRemaining > 0) await sleep(CLIENT_BATCH_DELAY_MS);
      }
      if (manualByKey.size > 0) {
        setMessage("Varredura concluída. Alguns itens ficaram para ajuste manual.");
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
            Atualiza capas, links, duração, álbum, artista, gêneros e datas em lotes pequenos, com pausas para respeitar o limite do Spotify.
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
        {manualItems.length > 0 && (
          <div style={{ marginTop: 14, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 750, color: "#1D1D1F" }}>
              <Wrench size={16} />
              Ajuste manual
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: "#6B6B70", lineHeight: 1.45 }}>
              O Spotify não retornou dados seguros para estes itens. Abra o editor, corrija os campos que faltam e rode a busca novamente.
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {manualItems.map((item) => (
                <div
                  key={`${item.type}:${item.id}`}
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
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1D1D1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.label}
                    </div>
                    <div style={{ marginTop: 2, fontSize: 12, color: "#86868B", lineHeight: 1.45 }}>
                      {manualReasonLabel(item)}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {item.conflict?.href && (
                      <Link href={item.conflict.href} style={secondaryLinkStyle}>
                        Ver conflito
                      </Link>
                    )}
                    <Link href={item.href} style={primaryLinkStyle}>
                      Editar
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function manualReasonLabel(item: ManualItem) {
  const reason = item.reason;
  if (reason === "spotify_track_not_found") {
    return "O Spotify não encontrou uma faixa confiável para este título e artista. Solução: abra o editor, confira nome/artista ou vincule ao álbum/artista correto.";
  }
  if (reason === "spotify_track_metadata_missing") {
    return "A faixa foi encontrada, mas o Spotify não retornou metadados suficientes. Solução: revise o vínculo ou preencha manualmente os dados faltantes.";
  }
  if (reason === "spotify_artist_not_found") {
    return "O ID atual do artista não existe ou não retornou perfil no Spotify. Solução: corrija o artista no editor ou troque para um artista cadastrado válido.";
  }
  if (reason === "spotify_album_not_found") {
    return "O ID atual do álbum não existe ou não retornou dados no Spotify. Solução: corrija o álbum no editor ou vincule a outro álbum cadastrado.";
  }
  if (reason.startsWith("spotify_id_conflict:")) {
    const conflict = item.conflict?.label ? ` Ele já está em "${item.conflict.label}".` : "";
    return `Conflito de Spotify ID: o Spotify retornou uma faixa que já está vinculada a outra música.${conflict} Solução: compare as duas músicas; se forem duplicadas, corrija/una a duplicata. Se forem músicas diferentes, escolha outro vínculo do Spotify para este item.`;
  }
  return `${reason.replaceAll("_", " ")}. Solução: abra o editor e corrija os dados que faltam.`;
}

const primaryLinkStyle = {
  color: "#FA243C",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 750,
};

const secondaryLinkStyle = {
  color: "#6B6B70",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 700,
};

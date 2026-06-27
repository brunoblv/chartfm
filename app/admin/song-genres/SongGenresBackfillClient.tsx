"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, CheckCircle2, AlertCircle, Loader2, Tags } from "lucide-react";
import { buildSongPath } from "@/lib/music-routes";

type BackfillResult = {
  songId: string;
  title: string;
  artist: string;
  genres: string[];
  source: string;
  recordingMbid: string | null;
  error?: string;
};

type BackfillResponse = {
  ok?: boolean;
  processed?: number;
  updated?: number;
  failed?: number;
  remaining?: number;
  message?: string;
  results?: BackfillResult[];
};

type Props = {
  initialMissing: number;
  initialWithTags: number;
  totalSongs: number;
};

const CLIENT_BATCH_LIMIT = 2;
const CLIENT_BATCH_DELAY_MS = 1500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sourceLabel(source: string) {
  if (source === "musicbrainz") return "MusicBrainz";
  if (source === "lastfm") return "Last.fm";
  if (source === "artist") return "Artista (fallback)";
  if (source === "error") return "Erro";
  return source;
}

export function SongGenresBackfillClient({ initialMissing, initialWithTags, totalSongs }: Props) {
  const [running, setRunning] = useState(false);
  const [missing, setMissing] = useState(initialMissing);
  const [withTags, setWithTags] = useState(initialWithTags);
  const [processed, setProcessed] = useState(0);
  const [updated, setUpdated] = useState(0);
  const [failed, setFailed] = useState(0);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<BackfillResult[]>([]);

  const percent = useMemo(() => {
    const total = processed + missing;
    if (total <= 0) return 100;
    return Math.min(100, Math.round((processed / total) * 100));
  }, [processed, missing]);

  async function runBackfill() {
    if (running) return;
    setRunning(true);
    setProcessed(0);
    setUpdated(0);
    setFailed(0);
    setResults([]);
    setMessage("Buscando tags (MusicBrainz → Last.fm → artista)...");

    let nextRemaining = missing;
    let processedSum = 0;
    let updatedSum = 0;
    let failedSum = 0;
    const excludeSongIds: string[] = [];
    const allResults: BackfillResult[] = [];

    try {
      while (nextRemaining > 0) {
        const res = await fetch("/api/admin/song-genres/backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: CLIENT_BATCH_LIMIT, exclude: { songIds: excludeSongIds } }),
        });
        const data = (await res.json()) as BackfillResponse;

        if (!res.ok || data.ok === false) {
          setMessage(data.message ?? "Não foi possível buscar as tags.");
          break;
        }

        const batchProcessed = data.processed ?? 0;
        processedSum += batchProcessed;
        updatedSum += data.updated ?? 0;
        failedSum += data.failed ?? 0;
        nextRemaining = data.remaining ?? 0;

        if (data.results?.length) {
          allResults.push(...data.results);
          for (const r of data.results) excludeSongIds.push(r.songId);
        }

        setProcessed(processedSum);
        setUpdated(updatedSum);
        setFailed(failedSum);
        setMissing(nextRemaining);
        setWithTags((prev) => prev + (data.updated ?? 0));
        setResults([...allResults].slice(-20));
        setMessage(nextRemaining > 0 ? "Continuando backfill..." : "Backfill concluído.");

        if (batchProcessed === 0) break;
        if (nextRemaining > 0) await sleep(CLIENT_BATCH_DELAY_MS);
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
            {running ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <Tags size={18} />}
            Buscar tags por faixa
          </div>
          <div style={{ marginTop: 5, fontSize: 13, color: "#6B6B70", lineHeight: 1.45 }}>
            Ordem: MusicBrainz (recording) → Last.fm (top tags) → gêneros do artista no Spotify.
            Lotes de 2 músicas com pausa para respeitar rate limits.
          </div>
        </div>

        <button
          type="button"
          onClick={runBackfill}
          disabled={running || missing === 0}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            minHeight: 40,
            padding: "0 14px",
            borderRadius: 10,
            border: "none",
            background: running || missing === 0 ? "#C7C7CC" : "#FA243C",
            color: "white",
            fontSize: 14,
            fontWeight: 700,
            cursor: running || missing === 0 ? "default" : "pointer",
          }}
        >
          {running ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={16} />}
          {running ? "Buscando tags" : "Iniciar backfill"}
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
            {percent === 100 && !running && missing === 0 ? (
              <CheckCircle2 size={14} color="#2D7A32" />
            ) : (
              <AlertCircle size={14} color="#86868B" />
            )}
            {message || `${missing.toLocaleString("pt-BR")} músicas pendentes`}
          </span>
          <span style={{ fontSize: 13, color: "#6B6B70" }}>
            {withTags.toLocaleString("pt-BR")}/{totalSongs.toLocaleString("pt-BR")} com tags ·{" "}
            {processed.toLocaleString("pt-BR")} processadas · {updated.toLocaleString("pt-BR")} com tags novas ·{" "}
            {failed.toLocaleString("pt-BR")} falhas
          </span>
        </div>
      </div>

      {results.length > 0 && (
        <div style={{ marginTop: 14, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 750, color: "#1D1D1F", marginBottom: 8 }}>Últimos resultados</div>
          <div style={{ display: "grid", gap: 8 }}>
            {results
              .slice()
              .reverse()
              .map((r) => (
                <div
                  key={r.songId}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "#FBFBFD",
                    border: "1px solid rgba(0,0,0,0.08)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0 }}>
                      <Link
                        href={buildSongPath({ title: r.title, artist: r.artist, slugArtist: r.artist })}
                        style={{ fontSize: 13, fontWeight: 700, color: "#1D1D1F", textDecoration: "none" }}
                      >
                        {r.title}
                      </Link>
                      <div style={{ fontSize: 12, color: "#86868B", marginTop: 2 }}>{r.artist}</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: r.error ? "#C41E3A" : "#2D7A32" }}>
                      {r.error ? r.error : sourceLabel(r.source)}
                    </div>
                  </div>
                  {r.genres.length > 0 && (
                    <div style={{ marginTop: 6, fontSize: 12, color: "#6B6B70" }}>{r.genres.join(" · ")}</div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

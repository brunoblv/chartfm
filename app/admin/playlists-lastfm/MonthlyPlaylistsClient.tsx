"use client";

import { useState } from "react";

type MonthInfo = { month: number; name: string };

type Result = {
  ok?: boolean;
  monthName?: string;
  playlistUrl?: string;
  added?: number;
  requested?: number;
  missing?: number;
  scrobbles?: number;
  error?: string;
  needsReconnect?: boolean;
};

const card: React.CSSProperties = {
  border: "1px solid var(--divider)",
  borderRadius: 12,
  padding: 16,
  background: "var(--surface, transparent)",
};

const btn = (disabled: boolean): React.CSSProperties => ({
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid var(--divider)",
  background: disabled ? "var(--accent-tint)" : "var(--accent, #1db954)",
  color: disabled ? "var(--text-muted)" : "#fff",
  fontWeight: 600,
  fontSize: 14,
  cursor: disabled ? "default" : "pointer",
  whiteSpace: "nowrap",
});

export default function MonthlyPlaylistsClient({
  year,
  months,
  lastfmUser,
  spotifyConfigured,
  spotifyConnected,
}: {
  year: number;
  months: MonthInfo[];
  lastfmUser: string | null;
  spotifyConfigured: boolean;
  spotifyConnected: boolean;
}) {
  const [limit, setLimit] = useState(300);
  const [isPublic, setIsPublic] = useState(false);
  const [results, setResults] = useState<Record<number, Result>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const [bulk, setBulk] = useState(false);

  const ready = spotifyConfigured && spotifyConnected;

  async function generate(month: number) {
    setLoading((l) => ({ ...l, [month]: true }));
    setResults((r) => ({ ...r, [month]: {} }));
    try {
      const res = await fetch("/api/admin/lastfm-monthly-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, limit, isPublic }),
      });
      const data = (await res.json()) as Result;
      setResults((r) => ({ ...r, [month]: data }));
    } catch {
      setResults((r) => ({ ...r, [month]: { error: "Falha de rede" } }));
    } finally {
      setLoading((l) => ({ ...l, [month]: false }));
    }
  }

  async function generateAll() {
    setBulk(true);
    for (const m of months) {
      // eslint-disable-next-line no-await-in-loop
      await generate(m.month);
    }
    setBulk(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
      <div style={card}>
        <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Gera uma playlist na sua conta Spotify com as faixas mais ouvidas de cada mês de {year},
          calculadas a partir dos seus scrobbles do Last.fm
          {lastfmUser ? <> (<strong>@{lastfmUser}</strong>)</> : null}.
        </div>

        {!ready && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 8,
              background: "var(--accent-tint)",
              color: "var(--text)",
              fontSize: 14,
            }}
          >
            {!spotifyConfigured
              ? "Spotify OAuth não está configurado no servidor (SPOTIFY_CLIENT_ID / SECRET)."
              : (
                <>
                  Sua conta Spotify não está conectada.{" "}
                  <a href="/api/spotify/connect?from=/admin/playlists-lastfm" style={{ color: "var(--accent, #1db954)", fontWeight: 600 }}>
                    Conectar agora
                  </a>
                  .
                </>
              )}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 14, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            Faixas por playlist
            <input
              type="number"
              min={1}
              max={500}
              value={limit}
              onChange={(e) => setLimit(Math.min(500, Math.max(1, Number(e.target.value) || 1)))}
              style={{
                width: 72,
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid var(--divider)",
                background: "var(--surface, transparent)",
                color: "var(--text)",
              }}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            Playlist pública
          </label>
          <button
            type="button"
            onClick={generateAll}
            disabled={!ready || bulk}
            style={{ ...btn(!ready || bulk), marginLeft: "auto" }}
          >
            {bulk ? "Gerando todos…" : "Gerar todos os meses"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {months.map((m) => {
          const r = results[m.month];
          const isLoading = loading[m.month];
          return (
            <div
              key={m.month}
              style={{ ...card, display: "flex", alignItems: "center", gap: 16, padding: "12px 16px" }}
            >
              <div style={{ fontWeight: 600, fontSize: 15, minWidth: 96 }}>{m.name}</div>

              <div style={{ flex: 1, fontSize: 13, color: "var(--text-muted)" }}>
                {isLoading && "Calculando e criando no Spotify…"}
                {!isLoading && r?.error && (
                  <span style={{ color: "var(--danger, #e5484d)" }}>{r.error}</span>
                )}
                {!isLoading && r?.ok && (
                  <span>
                    {r.added} faixas adicionadas
                    {r.missing ? ` · ${r.missing} não encontradas` : ""}
                    {typeof r.scrobbles === "number" ? ` · ${r.scrobbles} scrobbles no mês` : ""} ·{" "}
                    <a href={r.playlistUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent, #1db954)", fontWeight: 600 }}>
                      abrir playlist
                    </a>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => generate(m.month)}
                disabled={!ready || isLoading || bulk}
                style={btn(!ready || isLoading || bulk)}
              >
                {isLoading ? "Gerando…" : r?.ok ? "Gerar de novo" : "Gerar playlist"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

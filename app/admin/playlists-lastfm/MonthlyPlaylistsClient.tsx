"use client";

import { useEffect, useState } from "react";
import { spotifyConnectErrorMessage } from "@/lib/spotify-connect-oauth";

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

const SPOTIFY_CONNECT_URL = "/api/spotify/connect?from=/admin/playlists-lastfm&reconnect=1";

export default function MonthlyPlaylistsClient({
  year,
  months,
  lastfmUser,
  spotifyConfigured,
  spotifyConnected: spotifyConnectedInitial,
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
  const [spotifyConnected, setSpotifyConnected] = useState(spotifyConnectedInitial);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    setSpotifyConnected(spotifyConnectedInitial);
  }, [spotifyConnectedInitial]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spotifyParam = params.get("spotify");
    const spotifyReason = params.get("spotify_reason");
    if (!spotifyParam) return;

    if (spotifyParam === "connected" || spotifyParam === "connected_no_playlist") {
      setSpotifyConnected(true);
      setBanner({ type: "ok", text: "Spotify conectado com sucesso. Pode gerar as playlists." });
    } else {
      const msg =
        spotifyConnectErrorMessage(spotifyParam, spotifyReason) ??
        "Erro ao conectar o Spotify. Tente novamente.";
      setBanner({ type: "err", text: msg });
    }

    params.delete("spotify");
    params.delete("spotify_reason");
    const qs = params.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    window.history.replaceState(null, "", next);
  }, []);

  const ready = spotifyConfigured && spotifyConnected;

  async function generate(month: number) {
    setLoading((l) => ({ ...l, [month]: true }));
    setResults((r) => ({ ...r, [month]: {} }));
    try {
      const res = await fetch("/api/admin/lastfm-monthly-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ year, month, limit, isPublic }),
      });
      const data = (await res.json()) as Result;
      if (!res.ok && !data.error) {
        data.error = res.status === 403 ? "Não autorizado — faça login como @bruno." : `Erro ${res.status}`;
      }
      setResults((r) => ({ ...r, [month]: data }));
    } catch {
      setResults((r) => ({ ...r, [month]: { error: "Falha de rede ou tempo esgotado. Tente um mês por vez." } }));
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
      {banner && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            background: banner.type === "ok" ? "var(--accent-tint)" : "rgba(229, 72, 77, 0.12)",
            color: "var(--text)",
            fontSize: 14,
          }}
        >
          {banner.text}
        </div>
      )}

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
                  <a href={SPOTIFY_CONNECT_URL} style={{ color: "var(--accent, #1db954)", fontWeight: 600 }}>
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

      {months.length === 0 && (
        <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Nenhum mês disponível ainda em {year}.</div>
      )}

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
                {isLoading && "Buscando scrobbles no Last.fm e criando no Spotify… (pode levar 1–2 min)"}
                {!isLoading && r?.error && (
                  <span style={{ color: "var(--danger, #e5484d)" }}>
                    {r.error}
                    {r.needsReconnect && (
                      <>
                        {" "}
                        <a href={SPOTIFY_CONNECT_URL} style={{ color: "var(--accent, #1db954)", fontWeight: 600 }}>
                          Reconectar Spotify
                        </a>
                      </>
                    )}
                  </span>
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

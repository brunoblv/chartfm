"use client";

import { useState } from "react";

type PreviewData = {
  spotifyId: string;
  title: string;
  artist: string;
  album: string | null;
  coverUrl: string | null;
  spotifyUrl: string | null;
  entriesAffected: number;
};

type Props = {
  songId: string;
  songTitle: string;
};

export function SpotifyFixButton({ songId, songTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function reset() {
    setUrl("");
    setPreview(null);
    setStatus("idle");
    setErrorMsg("");
  }

  function close() {
    setOpen(false);
    reset();
  }

  async function handlePreview() {
    if (!url.trim()) return;
    setStatus("loading");
    setPreview(null);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/admin/music/${songId}/apply-spotify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotifyUrl: url.trim(), preview: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(friendlyError(data.error));
        setStatus("error");
        return;
      }
      setPreview(data.preview);
      setStatus("idle");
    } catch {
      setErrorMsg("Erro ao buscar dados do Spotify.");
      setStatus("error");
    }
  }

  async function handleApply() {
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/admin/music/${songId}/apply-spotify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotifyUrl: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(friendlyError(data.error));
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch {
      setErrorMsg("Erro ao aplicar metadados.");
      setStatus("error");
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} style={fixBtnStyle}>
        Corrigir Spotify
      </button>

      {open && (
        <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && close()}>
          <div style={modalStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#1D1D1F" }}>Corrigir com Spotify</div>
                <div style={{ fontSize: 13, color: "#6B6B70", marginTop: 3 }}>{songTitle}</div>
              </div>
              <button onClick={close} style={closeBtnStyle}>✕</button>
            </div>

            {status === "done" ? (
              <div>
                <div style={{ fontSize: 14, color: "#1B873F", fontWeight: 700, marginBottom: 12 }}>
                  Metadados aplicados com sucesso!
                </div>
                {preview && (
                  <div style={previewCardStyle}>
                    {preview.coverUrl && (
                      <img src={preview.coverUrl} alt="" style={{ width: 48, height: 48, borderRadius: 6, objectFit: "cover" }} />
                    )}
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{preview.title}</div>
                      <div style={{ fontSize: 13, color: "#6B6B70" }}>{preview.artist}</div>
                      {preview.album && <div style={{ fontSize: 12, color: "#86868B" }}>{preview.album}</div>}
                      <div style={{ fontSize: 12, color: "#1B873F", marginTop: 4 }}>
                        {preview.entriesAffected} {preview.entriesAffected === 1 ? "entrada atualizada" : "entradas atualizadas"} nas paradas
                      </div>
                    </div>
                  </div>
                )}
                <button onClick={close} style={{ ...applyBtnStyle, marginTop: 16 }}>Fechar</button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "#6B6B70", margin: "0 0 14px" }}>
                  Cole o link do Spotify da música correta. O sistema irá atualizar os metadados e todas as entradas nas paradas.
                </p>

                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => { setUrl(e.target.value); setPreview(null); setStatus("idle"); setErrorMsg(""); }}
                    placeholder="https://open.spotify.com/track/..."
                    style={inputStyle}
                    onKeyDown={(e) => e.key === "Enter" && handlePreview()}
                  />
                  <button
                    onClick={handlePreview}
                    disabled={!url.trim() || status === "loading"}
                    style={{ ...previewBtnStyle, opacity: !url.trim() || status === "loading" ? 0.5 : 1 }}
                  >
                    {status === "loading" && !preview ? "..." : "Buscar"}
                  </button>
                </div>

                {errorMsg && (
                  <div style={{ fontSize: 13, color: "#FA243C", marginBottom: 12 }}>{errorMsg}</div>
                )}

                {preview && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: "#6B6B70", marginBottom: 8, fontWeight: 600 }}>
                      DADOS DO SPOTIFY
                    </div>
                    <div style={previewCardStyle}>
                      {preview.coverUrl && (
                        <img src={preview.coverUrl} alt="" style={{ width: 56, height: 56, borderRadius: 6, objectFit: "cover" }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#1D1D1F" }}>{preview.title}</div>
                        <div style={{ fontSize: 13, color: "#6B6B70" }}>{preview.artist}</div>
                        {preview.album && <div style={{ fontSize: 12, color: "#86868B" }}>{preview.album}</div>}
                        <div style={{ fontSize: 12, color: "#FA243C", marginTop: 4, fontWeight: 600 }}>
                          {preview.entriesAffected} {preview.entriesAffected === 1 ? "entrada" : "entradas"} nas paradas serão atualizadas
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleApply}
                      disabled={status === "loading"}
                      style={{ ...applyBtnStyle, marginTop: 12, opacity: status === "loading" ? 0.6 : 1 }}
                    >
                      {status === "loading" ? "Aplicando..." : "Confirmar e aplicar"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function friendlyError(code: string): string {
  const map: Record<string, string> = {
    invalid_spotify_url: "Link do Spotify inválido. Use o formato: open.spotify.com/track/...",
    track_not_found_on_spotify: "Música não encontrada no Spotify.",
    spotify_not_configured: "Integração com Spotify não configurada.",
    spotify_id_conflict: "Já existe outra música no banco com esse ID do Spotify.",
    not_found: "Música não encontrada.",
    spotify_url_required: "Cole o link do Spotify.",
  };
  return map[code] ?? `Erro: ${code}`;
}

const fixBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#1DB954",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  padding: 0,
  textDecoration: "none",
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};

const modalStyle: React.CSSProperties = {
  background: "white",
  borderRadius: 16,
  padding: 24,
  width: "100%",
  maxWidth: 480,
  boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
};

const closeBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  fontSize: 18,
  color: "#86868B",
  cursor: "pointer",
  lineHeight: 1,
  padding: "2px 4px",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid rgba(0,0,0,0.15)",
  fontSize: 13,
  outline: "none",
  fontFamily: "inherit",
};

const previewBtnStyle: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: 8,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "white",
  color: "#1D1D1F",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const applyBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 0",
  borderRadius: 10,
  border: "none",
  background: "#1DB954",
  color: "white",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};

const previewCardStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  background: "rgba(0,0,0,0.04)",
  borderRadius: 10,
  padding: "12px",
};

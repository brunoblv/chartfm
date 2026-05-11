"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";

export function ArtistCreatePanel() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [spotifyId, setSpotifyId] = useState("");
  const [romanization, setRomanization] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(
    () => name.trim().length > 0 && spotifyId.trim().length > 0 && !saving,
    [name, spotifyId, saving],
  );

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/artist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          spotifyId: spotifyId.trim(),
          romanization: romanization.trim(),
          imageUrl: imageUrl.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string; artist?: { id: number; name: string } };
      if (!res.ok) {
        setError(
          data.error === "spotify_id_already_exists"
            ? "Spotify ID já cadastrado."
            : data.error === "spotify_id_required"
              ? "Spotify ID é obrigatório."
              : data.error === "name_required"
                ? "Nome é obrigatório."
                : (data.error ?? "Não foi possível criar."),
        );
        return;
      }
      setMessage(`Artista "${data.artist?.name}" criado com sucesso.`);
      setName("");
      setSpotifyId("");
      setRomanization("");
      setImageUrl("");
      router.refresh();
    } catch {
      setError("Erro de conexão ao criar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        background: "white",
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.08)",
        padding: "20px 24px",
        marginBottom: 24,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, color: "#1D1D1F", marginBottom: 16 }}>
        Novo artista
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={labelStyle}>Nome *</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
            placeholder="Nome do artista"
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={labelStyle}>Spotify ID *</span>
          <input
            value={spotifyId}
            onChange={(e) => setSpotifyId(e.target.value)}
            style={inputStyle}
            placeholder="Ex: 1Xyo4u8uXC1ZmMpatF05PJ"
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={labelStyle}>Romanização</span>
          <input
            value={romanization}
            onChange={(e) => setRomanization(e.target.value)}
            style={inputStyle}
            placeholder="Nome em caracteres latinos (opcional)"
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={labelStyle}>URL da imagem</span>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            style={inputStyle}
            placeholder="https://... (opcional)"
          />
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
        <button type="button" onClick={submit} disabled={!canSave} style={buttonStyle(canSave)}>
          {saving ? "Criando..." : "Criar artista"}
        </button>
        {message && (
          <span style={{ color: "#0F9D58", fontSize: 13, fontWeight: 500 }}>{message}</span>
        )}
        {error && (
          <span style={{ color: "#C5291C", fontSize: 13, fontWeight: 500 }}>{error}</span>
        )}
      </div>
    </div>
  );
}

const labelStyle: CSSProperties = { fontSize: 13, color: "#6B6B70", fontWeight: 600 };

const inputStyle: CSSProperties = {
  border: "1px solid rgba(0,0,0,0.14)",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
  background: "#fff",
};

const buttonStyle = (enabled: boolean): CSSProperties => ({
  border: "none",
  background: "#FA243C",
  color: "#fff",
  borderRadius: 10,
  padding: "10px 16px",
  fontWeight: 700,
  fontSize: 14,
  opacity: enabled ? 1 : 0.55,
  cursor: enabled ? "pointer" : "not-allowed",
});

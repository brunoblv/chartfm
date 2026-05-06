"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

type ArtistEditInitial = {
  id: number;
  slug: string;
  name: string;
  spotifyId: string;
  romanization: string;
  imageUrl: string;
};

export function ArtistEditClient({ initialArtist }: { initialArtist: ArtistEditInitial }) {
  const [name, setName] = useState(initialArtist.name);
  const [spotifyId, setSpotifyId] = useState(initialArtist.spotifyId);
  const [romanization, setRomanization] = useState(initialArtist.romanization);
  const [imageUrl, setImageUrl] = useState(initialArtist.imageUrl);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(() => name.trim().length > 0 && spotifyId.trim().length > 0 && !saving, [name, spotifyId, saving]);

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/artist/${initialArtist.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          spotifyId: spotifyId.trim(),
          romanization: romanization.trim(),
          imageUrl: imageUrl.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar.");
        return;
      }
      setMessage("Artista atualizado com sucesso.");
    } catch {
      setError("Erro de conexão ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>Nome</span>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
      </label>
      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>Spotify ID</span>
        <input value={spotifyId} onChange={(e) => setSpotifyId(e.target.value)} style={inputStyle} />
      </label>
      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>Romanização</span>
        <input value={romanization} onChange={(e) => setRomanization(e.target.value)} style={inputStyle} />
      </label>
      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>Capa (URL da imagem)</span>
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} style={inputStyle} />
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
        <button type="button" onClick={submit} disabled={!canSave} style={buttonStyle(canSave)}>
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
        {message && <span style={{ color: "#0F9D58", fontSize: 13 }}>{message}</span>}
        {error && <span style={{ color: "#C5291C", fontSize: 13 }}>{error}</span>}
      </div>
    </div>
  );
}

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
  padding: "10px 14px",
  fontWeight: 700,
  opacity: enabled ? 1 : 0.55,
  cursor: enabled ? "pointer" : "not-allowed",
});

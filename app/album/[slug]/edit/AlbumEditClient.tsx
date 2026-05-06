"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { isAdminMusicTypeaheadQueryReady } from "@/lib/admin-music-typeahead";

type AlbumEditInitial = {
  id: number;
  slug: string;
  title: string;
  spotifyId: string;
  romanization: string;
  coverUrl: string;
  artist: string;
  artistSpotifyId: string;
};

type ArtistOption = { spotifyId: string; name: string };

function usableArtistOptions(items: ArtistOption[]) {
  return items.filter((a) => a.spotifyId.trim() && a.name.trim());
}

export function AlbumEditClient({ initialAlbum }: { initialAlbum: AlbumEditInitial }) {
  const [title, setTitle] = useState(initialAlbum.title);
  const [spotifyId, setSpotifyId] = useState(initialAlbum.spotifyId);
  const [romanization, setRomanization] = useState(initialAlbum.romanization);
  const [coverUrl, setCoverUrl] = useState(initialAlbum.coverUrl);
  const [artistQuery, setArtistQuery] = useState(initialAlbum.artist);
  const [artistSpotifyId, setArtistSpotifyId] = useState(initialAlbum.artistSpotifyId);
  const [artistOptions, setArtistOptions] = useState<ArtistOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [artistTypeaheadActive, setArtistTypeaheadActive] = useState(false);

  useEffect(() => {
    if (!artistTypeaheadActive) {
      setArtistOptions([]);
      return;
    }
    const q = artistQuery.trim();
    if (!isAdminMusicTypeaheadQueryReady(q)) {
      setArtistOptions([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/music/search?kind=artist&q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { items: ArtistOption[] };
        setArtistOptions(usableArtistOptions(data.items ?? []));
      } catch {
        // ignore abort/network for typeahead
      }
    }, 180);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [artistQuery, artistTypeaheadActive]);

  const canSave = useMemo(
    () => title.trim().length > 0 && spotifyId.trim().length > 0 && artistSpotifyId.trim().length > 0 && !saving,
    [title, spotifyId, artistSpotifyId, saving],
  );

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/album/${initialAlbum.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          spotifyId: spotifyId.trim(),
          romanization: romanization.trim(),
          coverUrl: coverUrl.trim(),
          artistSpotifyId: artistSpotifyId.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar.");
        return;
      }
      setMessage("Álbum atualizado com sucesso.");
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
        <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
      </label>
      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>Spotify ID</span>
        <input value={spotifyId} onChange={(e) => setSpotifyId(e.target.value)} style={inputStyle} />
      </label>

      <label style={{ display: "grid", gap: 6, position: "relative" }}>
        <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>Artista (buscar cadastrados)</span>
        <input
          value={artistQuery}
          onChange={(e) => {
            setArtistTypeaheadActive(true);
            const v = e.target.value;
            setArtistQuery(v);
            const t = v.trim();
            const initA = initialAlbum.artist.trim();
            const initId = initialAlbum.artistSpotifyId.trim();
            if (initId && t.toLowerCase() === initA.toLowerCase()) {
              setArtistSpotifyId(initialAlbum.artistSpotifyId);
            } else {
              setArtistSpotifyId("");
            }
          }}
          style={inputStyle}
        />
        {artistOptions.length > 0 && (
          <div style={dropdownStyle}>
            {artistOptions.map((a) => (
              <button
                key={a.spotifyId}
                type="button"
                onClick={() => {
                  setArtistQuery(a.name);
                  setArtistSpotifyId(a.spotifyId);
                  setArtistOptions([]);
                }}
                style={optionStyle}
              >
                {a.name}
              </button>
            ))}
          </div>
        )}
      </label>
      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>Romanização</span>
        <input value={romanization} onChange={(e) => setRomanization(e.target.value)} style={inputStyle} />
      </label>
      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>Capa (URL da imagem)</span>
        <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} style={inputStyle} />
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

const dropdownStyle: CSSProperties = {
  position: "absolute",
  zIndex: 10,
  top: "100%",
  left: 0,
  right: 0,
  marginTop: 4,
  background: "#fff",
  border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: 10,
  overflow: "hidden",
  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
  maxHeight: 220,
  overflowY: "auto",
};

const optionStyle: CSSProperties = {
  width: "100%",
  textAlign: "left",
  border: "none",
  borderBottom: "1px solid rgba(0,0,0,0.06)",
  background: "#fff",
  padding: "9px 10px",
  cursor: "pointer",
  fontSize: 13,
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

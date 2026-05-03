"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { isAdminMusicTypeaheadQueryReady } from "@/lib/admin-music-typeahead";

type SongEditInitial = {
  id: string;
  slug: string;
  title: string;
  romanization: string;
  artist: string;
  album: string;
  artistSpotifyId: string;
  albumSpotifyId: string;
};

type ArtistOption = { spotifyId: string; name: string };
type AlbumOption = { spotifyId: string; title: string; artistName: string };

function usableArtistOptions(items: ArtistOption[]) {
  return items.filter((a) => a.spotifyId.trim() && a.name.trim());
}

function usableAlbumOptions(items: AlbumOption[]) {
  return items.filter((a) => a.spotifyId.trim() && a.title.trim());
}

export function SongEditClient({ initialSong }: { initialSong: SongEditInitial }) {
  const [title, setTitle] = useState(initialSong.title);
  const [romanization, setRomanization] = useState(initialSong.romanization);

  const [artistQuery, setArtistQuery] = useState(initialSong.artist);
  const [artistSpotifyId, setArtistSpotifyId] = useState(initialSong.artistSpotifyId);
  const [artistOptions, setArtistOptions] = useState<ArtistOption[]>([]);

  const [albumQuery, setAlbumQuery] = useState(initialSong.album);
  const [albumSpotifyId, setAlbumSpotifyId] = useState(initialSong.albumSpotifyId);
  const [albumOptions, setAlbumOptions] = useState<AlbumOption[]>([]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Só busca sugestões depois que o usuário mexer no campo (evita lista ao abrir a página). */
  const [artistTypeaheadActive, setArtistTypeaheadActive] = useState(false);
  const [albumTypeaheadActive, setAlbumTypeaheadActive] = useState(false);

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

  useEffect(() => {
    if (!albumTypeaheadActive) {
      setAlbumOptions([]);
      return;
    }
    const q = albumQuery.trim();
    if (!isAdminMusicTypeaheadQueryReady(q)) {
      setAlbumOptions([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/music/search?kind=album&q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { items: AlbumOption[] };
        setAlbumOptions(usableAlbumOptions(data.items ?? []));
      } catch {
        // ignore abort/network for typeahead
      }
    }, 180);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [albumQuery, albumTypeaheadActive]);

  const canSave = useMemo(() => title.trim().length > 0 && artistSpotifyId.trim().length > 0 && !saving, [title, artistSpotifyId, saving]);

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/music/${encodeURIComponent(initialSong.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          romanization: romanization.trim(),
          artistSpotifyId: artistSpotifyId.trim(),
          albumSpotifyId: albumSpotifyId.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar.");
        return;
      }
      setMessage("Música atualizada com sucesso.");
    } catch {
      setError("Erro de conexão ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>Nome da música</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
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
            const initA = initialSong.artist.trim();
            const initId = initialSong.artistSpotifyId.trim();
            if (initId && t.toLowerCase() === initA.toLowerCase()) {
              setArtistSpotifyId(initialSong.artistSpotifyId);
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

      <label style={{ display: "grid", gap: 6, position: "relative" }}>
        <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>Álbum (buscar cadastrados)</span>
        <input
          value={albumQuery}
          onChange={(e) => {
            setAlbumTypeaheadActive(true);
            const v = e.target.value;
            setAlbumQuery(v);
            const t = v.trim();
            const initAl = initialSong.album.trim();
            const initId = initialSong.albumSpotifyId.trim();
            if (initId && t.toLowerCase() === initAl.toLowerCase()) {
              setAlbumSpotifyId(initialSong.albumSpotifyId);
            } else {
              setAlbumSpotifyId("");
            }
          }}
          style={inputStyle}
        />
        {albumOptions.length > 0 && (
          <div style={dropdownStyle}>
            {albumOptions.map((a) => (
              <button
                key={a.spotifyId}
                type="button"
                onClick={() => {
                  setAlbumQuery(a.title);
                  setAlbumSpotifyId(a.spotifyId);
                  setAlbumOptions([]);
                }}
                style={optionStyle}
              >
                {a.title} — {a.artistName}
              </button>
            ))}
          </div>
        )}
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>Romanização</span>
        <input value={romanization} onChange={(e) => setRomanization(e.target.value)} style={inputStyle} />
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
        <button
          type="button"
          onClick={submit}
          disabled={!canSave}
          style={{
            border: "none",
            background: "#FA243C",
            color: "#fff",
            borderRadius: 10,
            padding: "10px 14px",
            fontWeight: 700,
            opacity: canSave ? 1 : 0.55,
            cursor: canSave ? "pointer" : "not-allowed",
          }}
        >
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

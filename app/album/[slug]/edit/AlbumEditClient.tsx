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

export type AlbumSongRow = {
  id: string;
  title: string;
  artist: string;
  spotifyId: string | null;
  trackNumber: number | null;
};

type SpotifyAlbumTrackRow = { spotifyId: string; title: string; inDatabase: boolean };

function usableArtistOptions(items: ArtistOption[]) {
  return items.filter((a) => a.spotifyId.trim() && a.name.trim());
}

function sortAlbumSongs(a: AlbumSongRow, b: AlbumSongRow) {
  const na = a.trackNumber ?? 9999;
  const nb = b.trackNumber ?? 9999;
  if (na !== nb) return na - nb;
  return a.title.localeCompare(b.title, "pt", { sensitivity: "base" });
}

export function AlbumEditClient({
  initialAlbum,
  initialSongs,
}: {
  initialAlbum: AlbumEditInitial;
  initialSongs: AlbumSongRow[];
}) {
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
  const [songs, setSongs] = useState<AlbumSongRow[]>(() => [...initialSongs].sort(sortAlbumSongs));
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
  const [spotifyTracks, setSpotifyTracks] = useState<SpotifyAlbumTrackRow[] | null>(null);
  const [spotifyLoadMsg, setSpotifyLoadMsg] = useState<string | null>(null);
  const [loadingSpotifyList, setLoadingSpotifyList] = useState(false);
  const [addingTrackId, setAddingTrackId] = useState<string | null>(null);

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

  async function loadSpotifyTracklist() {
    setLoadingSpotifyList(true);
    setSpotifyLoadMsg(null);
    try {
      const res = await fetch(`/api/admin/album/${initialAlbum.id}/spotify-tracks`, { cache: "no-store" });
      const data = (await res.json()) as {
        tracks?: SpotifyAlbumTrackRow[];
        configured?: boolean;
        message?: string;
      };
      if (!res.ok) {
        setSpotifyTracks([]);
        setSpotifyLoadMsg("Não foi possível carregar as faixas do Spotify.");
        return;
      }
      if (data.configured === false) {
        setSpotifyTracks([]);
        setSpotifyLoadMsg(data.message ?? "Spotify não configurado.");
        return;
      }
      setSpotifyTracks(data.tracks ?? []);
      if (data.message && (data.tracks ?? []).length === 0) {
        setSpotifyLoadMsg(data.message);
      }
    } catch {
      setSpotifyTracks([]);
      setSpotifyLoadMsg("Erro de conexão ao buscar faixas no Spotify.");
    } finally {
      setLoadingSpotifyList(false);
    }
  }

  async function addTrackFromSpotify(trackSpotifyId: string) {
    setAddingTrackId(trackSpotifyId);
    setSpotifyLoadMsg(null);
    try {
      const res = await fetch(`/api/admin/album/${initialAlbum.id}/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackSpotifyId }),
      });
      const data = (await res.json()) as { song?: AlbumSongRow; error?: string; message?: string };
      if (!res.ok) {
        setSpotifyLoadMsg(data.message ?? data.error ?? "Não foi possível adicionar a faixa.");
        return;
      }
      if (data.song) {
        setSongs((prev) => {
          const map = new Map(prev.map((s) => [s.id, s]));
          map.set(data.song!.id, data.song!);
          return Array.from(map.values()).sort(sortAlbumSongs);
        });
        setSpotifyTracks((prev) =>
          prev
            ? prev.map((t) => (t.spotifyId === trackSpotifyId ? { ...t, inDatabase: true } : t))
            : prev,
        );
      }
    } catch {
      setSpotifyLoadMsg("Erro de conexão ao adicionar faixa.");
    } finally {
      setAddingTrackId(null);
    }
  }

  async function uploadCover(file: File) {
    setUploadingCover(true);
    setCoverUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/album/${initialAlbum.id}/cover`, { method: "POST", body: fd });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setCoverUploadError(data.error ?? "Não foi possível enviar a capa.");
        return;
      }
      setCoverUrl(data.url ?? "");
    } catch {
      setCoverUploadError("Erro de conexão ao enviar capa.");
    } finally {
      setUploadingCover(false);
    }
  }

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
      <div style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>Capa</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="URL da imagem" />
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 14px",
              borderRadius: 10,
              background: uploadingCover ? "rgba(0,0,0,0.1)" : "#1D1D1F",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              cursor: uploadingCover ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {uploadingCover ? "Enviando…" : "Upload"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
              disabled={uploadingCover}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadCover(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {coverUploadError && <span style={{ fontSize: 12, color: "#C5291C" }}>{coverUploadError}</span>}
        {coverUrl && (
          <img
            src={coverUrl.split("?")[0]}
            alt="Capa do álbum"
            style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, marginTop: 4 }}
          />
        )}
      </div>

      <div
        style={{
          marginTop: 8,
          paddingTop: 18,
          borderTop: "1px solid rgba(0,0,0,0.08)",
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1D1D1F" }}>Músicas no catálogo</div>
        <p style={{ margin: 0, fontSize: 13, color: "#6B6B70", lineHeight: 1.45 }}>
          Faixas ligadas a este álbum no banco ({songs.length}). Use o Spotify abaixo para importar as que faltam.
        </p>
        {songs.length === 0 ? (
          <div style={{ fontSize: 13, color: "#86868B" }}>Nenhuma música cadastrada para este álbum ainda.</div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
            {songs.map((s) => (
              <li
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  padding: "8px 10px",
                  background: "rgba(0,0,0,0.03)",
                  borderRadius: 10,
                  fontSize: 13,
                }}
              >
                <span style={{ color: "#86868B", fontVariantNumeric: "tabular-nums", minWidth: 28 }}>
                  {s.trackNumber != null ? `${s.trackNumber}.` : "—"}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{s.title}</span>
                  <span style={{ color: "#6B6B70" }}> — {s.artist}</span>
                </span>
                {s.spotifyId ? (
                  <a
                    href={`https://open.spotify.com/track/${s.spotifyId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#1DB954", fontSize: 12, fontWeight: 600, textDecoration: "none", flexShrink: 0 }}
                  >
                    Spotify
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <button type="button" onClick={loadSpotifyTracklist} disabled={loadingSpotifyList} style={secondaryButtonStyle(loadingSpotifyList)}>
            {loadingSpotifyList ? "Carregando…" : "Carregar faixas do Spotify"}
          </button>
        </div>
        {spotifyLoadMsg && <div style={{ fontSize: 13, color: "#C5291C" }}>{spotifyLoadMsg}</div>}
        {spotifyTracks && spotifyTracks.length > 0 && (
          <div style={{ display: "grid", gap: 8, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
            {spotifyTracks.map((t) => (
              <div
                key={t.spotifyId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 10,
                  background: "#fff",
                }}
              >
                <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{t.title}</span>
                </span>
                {t.inDatabase ? (
                  <span style={{ fontSize: 12, color: "#0F9D58", fontWeight: 600 }}>No catálogo</span>
                ) : (
                  <button
                    type="button"
                    disabled={addingTrackId !== null}
                    onClick={() => addTrackFromSpotify(t.spotifyId)}
                    style={smallAddButtonStyle(addingTrackId === null)}
                  >
                    {addingTrackId === t.spotifyId ? "…" : "Adicionar"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

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

const secondaryButtonStyle = (enabled: boolean): CSSProperties => ({
  border: "1px solid rgba(0,0,0,0.14)",
  background: "#fff",
  color: "#1D1D1F",
  borderRadius: 10,
  padding: "9px 14px",
  fontWeight: 600,
  fontSize: 13,
  opacity: enabled ? 1 : 0.55,
  cursor: enabled ? "pointer" : "not-allowed",
});

const smallAddButtonStyle = (enabled: boolean): CSSProperties => ({
  border: "none",
  background: "#FA243C",
  color: "#fff",
  borderRadius: 8,
  padding: "6px 12px",
  fontWeight: 700,
  fontSize: 12,
  flexShrink: 0,
  opacity: enabled ? 1 : 0.55,
  cursor: enabled ? "pointer" : "not-allowed",
});

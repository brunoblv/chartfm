"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { Song } from "@/lib/types";

type ArtistOption = { spotifyId: string; name: string };
type AlbumOption = { spotifyId: string; title: string; artistName: string };

function useLookup<T>(kind: "artist" | "album", query: string, extra?: string) {
  const [options, setOptions] = useState<T[]>([]);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setOptions([]);
      return;
    }
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ kind, q });
        if (extra) params.set("artistSpotifyId", extra);
        const res = await fetch(`/api/songs/manual-lookup?${params}`, { signal: ac.signal, cache: "no-store" });
        if (!res.ok || ac.signal.aborted) return;
        const data = (await res.json()) as { items?: T[] };
        if (!ac.signal.aborted) setOptions(data.items ?? []);
      } catch {
        // ignore
      }
    }, 200);
    return () => {
      ac.abort();
      clearTimeout(timer);
    };
  }, [kind, query, extra]);
  return options;
}

export function ManualSongCreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (song: Song) => void;
}) {
  const [title, setTitle] = useState("");
  const [artistQuery, setArtistQuery] = useState("");
  const [artistSpotifyId, setArtistSpotifyId] = useState("");
  const [albumQuery, setAlbumQuery] = useState("");
  const [albumSpotifyId, setAlbumSpotifyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const artistOptions = useLookup<ArtistOption>("artist", artistSpotifyId ? "" : artistQuery);
  const albumOptions = useLookup<AlbumOption>("album", albumSpotifyId ? "" : albumQuery, artistSpotifyId || undefined);

  const canSubmit = title.trim().length > 0 && artistQuery.trim().length > 0 && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/songs/manual-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          artist: artistQuery.trim(),
          artistSpotifyId: artistSpotifyId || undefined,
          album: albumQuery.trim() || undefined,
          albumSpotifyId: albumSpotifyId || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: true; song: { id: string; title: string; artist: string; album: string | null; spotifyId: string | null; imageUrl: string | null } }
        | { error: string }
        | null;
      if (!res.ok || !data || !("ok" in data)) {
        const code = data && "error" in data ? data.error : undefined;
        setError(
          code === "title_required"
            ? "Informe o nome da música."
            : code === "artist_required"
              ? "Informe o artista."
              : code === "instrumental_title"
                ? "Faixas instrumentais não podem ser cadastradas."
                : "Não foi possível cadastrar a música.",
        );
        return;
      }
      onCreated({
        id: data.song.id,
        title: data.song.title,
        artist: data.song.artist,
        album: data.song.album ?? "",
        spotifyId: data.song.spotifyId ?? undefined,
        imageUrl: data.song.imageUrl ?? undefined,
      });
      onClose();
    } catch {
      setError("Erro de conexão ao cadastrar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          padding: 20,
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Criar música</div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, margin: "0 0 16px" }}>
          Use quando o Spotify estiver indisponível. Artista e álbum são buscados no catálogo — se não
          encontrar, o que você digitar é usado do mesmo jeito. A capa/vínculo com o Spotify é
          preenchido depois.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={labelStyle}>Nome da música</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} autoFocus />
          </label>

          <label style={{ display: "grid", gap: 6, position: "relative" }}>
            <span style={labelStyle}>Artista</span>
            <input
              value={artistQuery}
              onChange={(e) => {
                setArtistQuery(e.target.value);
                setArtistSpotifyId("");
              }}
              placeholder="Pesquisar ou digitar o artista"
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
            <span style={labelStyle}>Álbum (opcional)</span>
            <input
              value={albumQuery}
              onChange={(e) => {
                setAlbumQuery(e.target.value);
                setAlbumSpotifyId("");
              }}
              placeholder="Pesquisar ou digitar o álbum"
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
                    }}
                    style={optionStyle}
                  >
                    {a.title} — {a.artistName}
                  </button>
                ))}
              </div>
            )}
          </label>
        </div>

        {error && <div style={{ fontSize: 12, color: "#C5291C", marginTop: 10 }}>{error}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button type="button" onClick={onClose} style={secondaryBtn}>
            Cancelar
          </button>
          <button type="button" onClick={submit} disabled={!canSubmit} style={primaryBtn(canSubmit)}>
            {saving ? "Criando…" : "Criar e adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--text-muted)" };

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid var(--divider-strong)",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
  color: "var(--text)",
  background: "var(--fill-subtle)",
  boxSizing: "border-box",
};

const dropdownStyle: CSSProperties = {
  position: "absolute",
  zIndex: 10,
  top: "100%",
  left: 0,
  right: 0,
  marginTop: 4,
  background: "var(--surface)",
  border: "1px solid var(--divider-strong)",
  borderRadius: 10,
  overflow: "hidden",
  boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
  maxHeight: 180,
  overflowY: "auto",
};

const optionStyle: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  border: "none",
  borderBottom: "1px solid var(--divider)",
  background: "var(--surface)",
  color: "var(--text)",
  padding: "9px 10px",
  cursor: "pointer",
  fontSize: 13,
};

const secondaryBtn: CSSProperties = {
  border: "1px solid var(--divider-strong)",
  background: "transparent",
  color: "var(--text)",
  borderRadius: 10,
  padding: "9px 14px",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

const primaryBtn = (enabled: boolean): CSSProperties => ({
  border: "none",
  background: "#FA243C",
  color: "#fff",
  borderRadius: 10,
  padding: "9px 14px",
  fontWeight: 700,
  fontSize: 13,
  opacity: enabled ? 1 : 0.55,
  cursor: enabled ? "pointer" : "not-allowed",
});

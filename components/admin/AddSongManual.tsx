"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { isAdminMusicTypeaheadQueryReady } from "@/lib/admin-music-typeahead";
import { buildSongPath } from "@/lib/music-routes";
import { DuplicateConflictNotice } from "@/components/admin/DuplicateConflictNotice";
import type { DuplicateSongConflict } from "@/lib/duplicate-conflict-payload";

type ArtistOption = { spotifyId: string; name: string };
type AlbumOption = { spotifyId: string; title: string; artistName: string };

type CreatedSong = {
  id: string;
  title: string;
  artist: string;
  spotifyId: string | null;
  trackNumber: number | null;
};

function usableArtistOptions(items: ArtistOption[]) {
  return items.filter((a) => a.spotifyId.trim() && a.name.trim());
}

function usableAlbumOptions(items: AlbumOption[]) {
  return items.filter((a) => a.spotifyId.trim() && a.title.trim());
}

function mapCreateError(code: string | undefined): string {
  switch (code) {
    case "title_required":
      return "Informe o nome da música.";
    case "artist_required":
      return "Selecione um artista cadastrado.";
    case "artist_not_found":
      return "Artista não encontrado no cadastro.";
    case "album_not_found":
      return "Álbum não encontrado no cadastro.";
    case "spotify_id_already_used":
      return "Este Spotify ID já está em uso por outra faixa.";
    case "song_already_exists_same_title_artist":
      return "Já existe uma música com este título e artista.";
    default:
      return "Não foi possível cadastrar.";
  }
}

export function AddSongManual({
  heading = "Adicionar música ao catálogo",
  description = "Cadastro manual: artista (e álbum, se preencher) precisam já existir no banco. Spotify ID é opcional.",
}: {
  heading?: string;
  description?: string;
}) {
  const [title, setTitle] = useState("");
  const [spotifyId, setSpotifyId] = useState("");
  const [romanization, setRomanization] = useState("");

  const [artistQuery, setArtistQuery] = useState("");
  const [artistSpotifyId, setArtistSpotifyId] = useState("");
  const [artistOptions, setArtistOptions] = useState<ArtistOption[]>([]);
  const [artistTypeaheadActive, setArtistTypeaheadActive] = useState(false);

  const [albumQuery, setAlbumQuery] = useState("");
  const [albumSpotifyId, setAlbumSpotifyId] = useState("");
  const [albumOptions, setAlbumOptions] = useState<AlbumOption[]>([]);
  const [albumTypeaheadActive, setAlbumTypeaheadActive] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<DuplicateSongConflict | null>(null);
  const [lastCreated, setLastCreated] = useState<CreatedSong | null>(null);

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
        // ignore
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
        // ignore
      }
    }, 180);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [albumQuery, albumTypeaheadActive]);

  const canSubmit = useMemo(() => title.trim().length > 0 && artistSpotifyId.trim().length > 0 && !saving, [title, artistSpotifyId, saving]);

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    setConflict(null);
    setMessage(null);
    setLastCreated(null);
    try {
      const res = await fetch("/api/admin/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          artistSpotifyId: artistSpotifyId.trim(),
          albumSpotifyId: albumSpotifyId.trim() || undefined,
          spotifyId: spotifyId.trim() || undefined,
          romanization: romanization.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { song?: CreatedSong; error?: string; message?: string; conflict?: DuplicateSongConflict };
      if (!res.ok) {
        if (data.conflict?.kind === "song") {
          setConflict(data.conflict);
          return;
        }
        setError(mapCreateError(data.error) || data.message || "Não foi possível cadastrar.");
        return;
      }
      if (data.song) {
        setLastCreated(data.song);
        setMessage("Música cadastrada com sucesso.");
        setTitle("");
        setSpotifyId("");
        setRomanization("");
        setArtistQuery("");
        setArtistSpotifyId("");
        setAlbumQuery("");
        setAlbumSpotifyId("");
        setArtistTypeaheadActive(false);
        setAlbumTypeaheadActive(false);
      }
    } catch {
      setError("Erro de conexão ao cadastrar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        marginBottom: 22,
        padding: 18,
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.08)",
        background: "rgba(250,36,60,0.04)",
      }}
    >
      <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px", color: "#1D1D1F" }}>{heading}</h2>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6B6B70", lineHeight: 1.45 }}>{description}</p>

      <div style={{ display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>Nome da música</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>Spotify ID da faixa (opcional)</span>
          <input value={spotifyId} onChange={(e) => setSpotifyId(e.target.value)} style={inputStyle} placeholder="Deixe em branco se não usar Spotify" />
        </label>

        <label style={{ display: "grid", gap: 6, position: "relative" }}>
          <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>Artista (buscar cadastrados)</span>
          <input
            value={artistQuery}
            onChange={(e) => {
              setArtistTypeaheadActive(true);
              setArtistQuery(e.target.value);
              setArtistSpotifyId("");
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
          <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>Álbum (opcional, buscar cadastrados)</span>
          <input
            value={albumQuery}
            onChange={(e) => {
              setAlbumTypeaheadActive(true);
              setAlbumQuery(e.target.value);
              setAlbumSpotifyId("");
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
                    setAlbumQuery(`${a.title} — ${a.artistName}`);
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
          <span style={{ fontSize: 13, color: "#6B6B70", fontWeight: 600 }}>Romanização (opcional)</span>
          <input value={romanization} onChange={(e) => setRomanization(e.target.value)} style={inputStyle} />
        </label>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 16 }}>
        <button type="button" onClick={submit} disabled={!canSubmit} style={primaryBtn(canSubmit)}>
          {saving ? "Cadastrando…" : "Cadastrar no banco"}
        </button>
        {message && <span style={{ color: "#0F9D58", fontSize: 13 }}>{message}</span>}
        {error && <span style={{ color: "#C5291C", fontSize: 13 }}>{error}</span>}
      </div>
      {conflict && (
        <DuplicateConflictNotice conflict={conflict} onDismiss={() => setConflict(null)} />
      )}
      {lastCreated && (
        <div style={{ marginTop: 12, fontSize: 13 }}>
          <Link
            href={`${buildSongPath({
              id: lastCreated.id,
              title: lastCreated.title,
              artist: lastCreated.artist,
              spotifyId: lastCreated.spotifyId,
            })}/edit`}
            style={{ color: "#FA243C", fontWeight: 700, textDecoration: "none" }}
          >
            Abrir edição desta música
          </Link>
        </div>
      )}
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

const primaryBtn = (enabled: boolean): CSSProperties => ({
  border: "none",
  background: "#FA243C",
  color: "#fff",
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 700,
  opacity: enabled ? 1 : 0.55,
  cursor: enabled ? "pointer" : "not-allowed",
});

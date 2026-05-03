"use client";

import { useState, useMemo, useEffect } from "react";
import type { CSSProperties } from "react";

type ArtistOption = { spotifyId: string; name: string };

type CreatedAlbum = {
  id: number;
  title: string;
  spotifyId: string;
  artist: { id: number; name: string };
};

export function CreateAlbumClient() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [romanization, setRomanization] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedAlbum | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [artistOptions, setArtistOptions] = useState<ArtistOption[]>([]);
  const [artistSearchLoading, setArtistSearchLoading] = useState(false);
  const [artistSearchFailed, setArtistSearchFailed] = useState(false);

  useEffect(() => {
    const q = artistName.trim();
    if (q.length < 2) {
      setArtistOptions([]);
      setArtistSearchLoading(false);
      setArtistSearchFailed(false);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setArtistSearchLoading(true);
      setArtistSearchFailed(false);
      try {
        const res = await fetch(`/api/admin/music/search?kind=artist&q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (!res.ok) {
          setArtistOptions([]);
          if (!ctrl.signal.aborted) setArtistSearchFailed(true);
          return;
        }
        const data = (await res.json()) as { items?: ArtistOption[] };
        setArtistOptions(data.items ?? []);
      } catch {
        if (!ctrl.signal.aborted) {
          setArtistOptions([]);
          setArtistSearchFailed(true);
        }
      } finally {
        if (!ctrl.signal.aborted) setArtistSearchLoading(false);
      }
    }, 180);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [artistName]);

  const canSave = useMemo(() => title.trim().length > 0 && artistName.trim().length > 0 && !saving, [title, artistName, saving]);

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setCreated(null);
    try {
      const res = await fetch("/api/admin/album", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), artistName: artistName.trim(), romanization: romanization.trim(), coverUrl: coverUrl.trim() }),
      });
      const data = (await res.json()) as { album?: CreatedAlbum; error?: string };
      if (!res.ok) {
        const msgs: Record<string, string> = {
          title_required: "Nome do álbum é obrigatório.",
          artist_required: "Nome do artista é obrigatório.",
          album_already_exists: "Já existe um álbum com esse nome para esse artista.",
        };
        setError(msgs[data.error ?? ""] ?? "Não foi possível criar o álbum.");
        return;
      }
      setCreated(data.album!);
      setTitle("");
      setArtistName("");
      setRomanization("");
      setCoverUrl("");
    } catch {
      setError("Erro de conexão ao criar álbum.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <button type="button" onClick={() => { setOpen((o) => !o); setCreated(null); setError(null); }} style={toggleStyle}>
        {open ? "Cancelar" : "+ Criar álbum"}
      </button>

      {open && (
        <div style={{ marginTop: 12, background: "white", borderRadius: 14, border: "1px solid rgba(0,0,0,0.08)", padding: 18, display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={labelStyle}>Nome do álbum *</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: SS501 / Rebirth" style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={labelStyle}>Artista * (digite 2+ letras para sugestões)</span>
            <div style={{ position: "relative" }}>
              <input
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder="Ex: SS501"
                style={inputStyle}
                autoComplete="off"
              />
              {artistOptions.length > 0 && (
                <div style={dropdownStyle}>
                  {artistOptions.map((a) => (
                    <button
                      key={a.spotifyId}
                      type="button"
                      onClick={() => {
                        setArtistName(a.name);
                        setArtistOptions([]);
                      }}
                      style={optionStyle}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {artistSearchLoading && artistName.trim().length >= 2 && (
              <span style={{ fontSize: 12, color: "#86868B" }}>Buscando…</span>
            )}
            {!artistSearchLoading && artistName.trim().length >= 2 && artistOptions.length === 0 && artistSearchFailed && (
              <span style={{ fontSize: 12, color: "#C5291C" }}>Não foi possível carregar sugestões. Atualize a página ou confira se você está logado como admin.</span>
            )}
            {!artistSearchLoading && artistName.trim().length >= 2 && artistOptions.length === 0 && !artistSearchFailed && (
              <span style={{ fontSize: 12, color: "#86868B" }}>
                Nenhum artista cadastrado com esse trecho — você ainda pode salvar; um artista manual será criado se necessário.
              </span>
            )}
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={labelStyle}>Romanização</span>
            <input value={romanization} onChange={(e) => setRomanization(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={labelStyle}>Capa (URL da imagem)</span>
            <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} style={inputStyle} />
          </label>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button type="button" onClick={submit} disabled={!canSave} style={buttonStyle(canSave)}>
              {saving ? "Criando..." : "Criar álbum"}
            </button>
            {error && <span style={{ color: "#C5291C", fontSize: 13 }}>{error}</span>}
          </div>

          {created && (
            <div style={{ fontSize: 13, color: "#0F9D58" }}>
              Álbum <strong>{created.title}</strong> criado com sucesso para <strong>{created.artist.name}</strong>.{" "}
              <a href={`/album/${created.artist.id}_${created.id}/edit`} style={{ color: "#FA243C", textDecoration: "none", fontWeight: 700 }}>
                Editar
              </a>
            </div>
          )}
        </div>
      )}
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

const toggleStyle: CSSProperties = {
  border: "none",
  background: "#FA243C",
  color: "#fff",
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 14,
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
  fontSize: 14,
});

const dropdownStyle: CSSProperties = {
  position: "absolute",
  zIndex: 20,
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

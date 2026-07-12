"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

type AlbumOption = {
  id: number;
  title: string;
  spotifyId: string;
  artist: { name: string };
};

type CurrentAlbum = { title: string; spotifyId: string } | null;

async function patchAlbum(songId: string, albumSpotifyId: string | null) {
  const res = await fetch("/api/admin/edicao-de-dados/inline", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "music", id: songId, field: "albumSpotifyId", value: albumSpotifyId ?? "" }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "update_failed");
  }
  return (await res.json()) as { ok: true; album: { title: string; spotifyId: string } | null };
}

const missStyle: CSSProperties = { color: "#C41E3A", fontWeight: 700, fontSize: 12 };
const statusStyle: CSSProperties = { fontSize: 11, marginTop: 2, display: "block" };

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "4px 6px",
  borderRadius: 6,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 13,
};

const dropdownBaseStyle: CSSProperties = {
  position: "fixed",
  zIndex: 200,
  maxHeight: 220,
  overflowY: "auto",
  background: "var(--surface)",
  border: "1px solid var(--divider-strong)",
  borderRadius: 8,
  boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
};

const optionStyle: CSSProperties = {
  padding: "6px 8px",
  fontSize: 12,
  cursor: "pointer",
  borderBottom: "1px solid var(--divider)",
};

/**
 * Álbum editável in-place: clique abre uma busca por título/artista e a
 * seleção salva na hora (relacional — troca albumSpotifyId da música).
 */
export function AlbumPicker({
  songId,
  album,
  albumText,
}: {
  songId: string;
  album: CurrentAlbum;
  /** Texto livre legado (Song.album) quando não há álbum relacional. */
  albumText?: string | null;
}) {
  const [current, setCurrent] = useState<CurrentAlbum>(album);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<AlbumOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCurrent(album);
  }, [album]);

  // ancora o dropdown por posição fixa (viewport) para escapar do overflow
  // recortado do painel da tabela (adminPanelScrollStyle é overflow-y hidden).
  useEffect(() => {
    if (!editing) return;
    function updateAnchor() {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setAnchor({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 240) });
    }
    updateAnchor();
    window.addEventListener("scroll", updateAnchor, true);
    window.addEventListener("resize", updateAnchor);
    return () => {
      window.removeEventListener("scroll", updateAnchor, true);
      window.removeEventListener("resize", updateAnchor);
    };
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    const q = query.trim();
    if (q.length < 2) {
      setOptions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/edicao-de-dados/search?kind=albums&q=${encodeURIComponent(q)}`, {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as { items?: AlbumOption[] };
        setOptions(data.items ?? []);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, editing]);

  useEffect(() => {
    if (!editing) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditing(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [editing]);

  async function select(opt: AlbumOption) {
    setStatus("saving");
    try {
      const result = await patchAlbum(songId, opt.spotifyId);
      setCurrent(result.album ?? { title: opt.title, spotifyId: opt.spotifyId });
      setStatus("idle");
    } catch {
      setStatus("error");
    } finally {
      setEditing(false);
      setQuery("");
      setOptions([]);
    }
  }

  if (editing) {
    return (
      <div ref={containerRef} style={{ position: "relative" }}>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder="Buscar álbum por título ou artista…"
          style={inputStyle}
        />
        {loading && <span style={{ ...statusStyle, color: "var(--text-muted)" }}>buscando…</span>}
        {!loading && options.length > 0 && anchor && (
          <div style={{ ...dropdownBaseStyle, top: anchor.top, left: anchor.left, width: anchor.width }}>
            {options.map((o) => (
              <div
                key={o.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(o);
                }}
                style={optionStyle}
              >
                <span style={{ fontWeight: 650 }}>{o.title}</span>{" "}
                <span style={{ color: "var(--text-muted)" }}>— {o.artist.name}</span>
              </div>
            ))}
          </div>
        )}
        {!loading && query.trim().length >= 2 && options.length === 0 && (
          <div style={{ ...statusStyle, color: "var(--text-muted)" }}>nenhum álbum encontrado</div>
        )}
      </div>
    );
  }

  return (
    <span style={{ display: "block", minWidth: 0 }}>
      <span
        role="button"
        tabIndex={0}
        title="Clique para buscar e escolher o álbum correto — salva na hora"
        onClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setEditing(true);
          }
        }}
        style={{ cursor: "pointer" }}
      >
        {current ? (
          current.title
        ) : albumText?.trim() ? (
          <>
            {albumText} <span style={{ ...missStyle, fontSize: 11 }}>(só texto)</span>
          </>
        ) : (
          <span style={missStyle}>sem álbum</span>
        )}
      </span>
      {status === "saving" && <span style={{ ...statusStyle, color: "var(--text-muted)" }}>salvando…</span>}
      {status === "error" && <span style={{ ...statusStyle, color: "#C41E3A" }}>erro ao salvar</span>}
    </span>
  );
}

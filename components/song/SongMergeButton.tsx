"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { isAdminMusicTypeaheadQueryReady } from "@/lib/admin-music-typeahead";
import { buildSongPath } from "@/lib/music-routes";

type SearchResult = { id: string; title: string; artist: string; album: string | null; spotifyId: string | null };

const searchInputStyle: CSSProperties = {
  width: "100%",
  maxWidth: 420,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 13,
  boxSizing: "border-box",
};

/**
 * Botão de admin na página da música: move todas as referências desta música
 * (a duplicada) para outra escolhida na busca e apaga esta.
 */
export function SongMergeButton({ songId, title, artist }: { songId: string; title: string; artist: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!isAdminMusicTypeaheadQueryReady(q)) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/edicao-de-dados/search?kind=music&q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as { items?: SearchResult[] };
        setResults((data.items ?? []).filter((s) => s.id !== songId));
      } catch {
        // abortado
      }
    }, 200);
    return () => {
      ctrl.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, songId]);

  async function handleMerge() {
    if (!picked || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/song-flags/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId, keepId: picked.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Falha ao fazer merge");
        setBusy(false);
        return;
      }
      router.push(buildSongPath(picked));
      router.refresh();
    } catch {
      setError("Erro de rede");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ border: "none", background: "none", padding: 0, fontSize: 13, fontWeight: 700, color: "#FA243C", cursor: "pointer" }}
      >
        Merge com outra música
      </button>
    );
  }

  return (
    <div
      style={{
        marginTop: 8,
        padding: 12,
        border: "1px solid var(--divider)",
        borderRadius: 12,
        background: "var(--surface)",
        maxWidth: 460,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>
        Todas as referências de “{title}” — {artist} serão movidas para a música selecionada, e esta será apagada.
      </div>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPicked(null);
        }}
        placeholder="Buscar a música correta (título, artista ou álbum)"
        style={searchInputStyle}
        autoFocus
      />
      {results.length > 0 && !picked && (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4, maxWidth: 420 }}>
          {results.slice(0, 8).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setPicked(r);
                setResults([]);
              }}
              style={{
                textAlign: "left",
                border: "1px solid var(--divider)",
                background: "var(--fill-inset)",
                borderRadius: 6,
                padding: "6px 8px",
                fontSize: 12,
                color: "var(--text)",
                cursor: "pointer",
              }}
            >
              <strong>{r.title}</strong> — {r.artist}
              {r.album ? ` • ${r.album}` : ""}
            </button>
          ))}
        </div>
      )}
      {picked && (
        <div style={{ marginTop: 8, fontSize: 13, color: "var(--text)" }}>
          Manter: <strong>{picked.title}</strong> — {picked.artist}
          {" "}
          <button
            type="button"
            onClick={() => setPicked(null)}
            style={{ marginLeft: 6, border: "none", background: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
          >
            trocar
          </button>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          type="button"
          disabled={!picked || busy}
          onClick={handleMerge}
          style={{
            border: "none",
            background: "#FA243C",
            color: "white",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: !picked || busy ? "default" : "pointer",
            opacity: !picked || busy ? 0.6 : 1,
          }}
        >
          {busy ? "Processando…" : "Confirmar merge"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setQuery("");
            setPicked(null);
            setError(null);
          }}
          style={{
            border: "1px solid var(--divider-strong)",
            background: "var(--surface)",
            color: "var(--text)",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
      </div>
      {error && <div style={{ marginTop: 6, fontSize: 12, color: "#C41E3A" }}>{error}</div>}
    </div>
  );
}

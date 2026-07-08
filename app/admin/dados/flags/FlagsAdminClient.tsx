"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { AdminSongLinks, AdminSongNameLink } from "@/components/admin/AdminEntityLinks";
import { isAdminMusicTypeaheadQueryReady } from "@/lib/admin-music-typeahead";

type SongInfo = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  spotifyId: string | null;
  _count: { entries: number };
};

type Report = {
  id: string;
  reason: string | null;
  createdAt: string | Date;
  user: { handle: string; name: string };
};

type Group = { song: SongInfo; reports: Report[] };

type SearchResult = { id: string; title: string; artist: string; album: string | null; spotifyId: string | null };

const cardStyle: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--divider)",
  borderRadius: 12,
  padding: 14,
};

const reportRowStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--text-muted)",
  padding: "6px 0",
  borderTop: "1px solid var(--divider)",
};

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

const btnStyle: CSSProperties = {
  border: "none",
  background: "#FA243C",
  color: "white",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const btnAltStyle: CSSProperties = {
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  color: "var(--text)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function FlagGroupCard({ group, onResolved }: { group: Group; onResolved: (songId: string) => void }) {
  const { song, reports } = group;
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
        setResults((data.items ?? []).filter((s) => s.id !== song.id));
      } catch {
        // abortado
      }
    }, 200);
    return () => {
      ctrl.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, song.id]);

  async function handleMerge() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/song-flags/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId: song.id, keepId: picked.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Falha ao fazer merge");
        setBusy(false);
        return;
      }
      onResolved(song.id);
    } catch {
      setError("Erro de rede");
      setBusy(false);
    }
  }

  async function handleDismiss() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/song-flags/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId: song.id }),
      });
      if (!res.ok) {
        setError("Falha ao dispensar");
        setBusy(false);
        return;
      }
      onResolved(song.id);
    } catch {
      setError("Erro de rede");
      setBusy(false);
    }
  }

  return (
    <section style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            <AdminSongNameLink song={song} />
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {song.artist} • {song.album || "sem álbum"} • entries: {song._count.entries} • spotify: {song.spotifyId ?? "—"}
          </div>
          <div style={{ marginTop: 4 }}>
            <AdminSongLinks song={song} />
          </div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#C41E3A", whiteSpace: "nowrap" }}>
          {reports.length} sinalização{reports.length === 1 ? "" : "ões"}
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        {reports.map((r) => (
          <div key={r.id} style={reportRowStyle}>
            <strong>@{r.user.handle}</strong> · {formatDate(r.createdAt)}
            {r.reason ? <> — {r.reason}</> : null}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--divider)" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>
          Selecionar a música correta para o merge:
        </div>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPicked(null);
          }}
          placeholder="Buscar por título, artista ou álbum"
          style={searchInputStyle}
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
          <button type="button" style={btnStyle} disabled={!picked || busy} onClick={handleMerge}>
            {busy ? "Processando…" : "Fazer merge"}
          </button>
          <button type="button" style={btnAltStyle} disabled={busy} onClick={handleDismiss}>
            Dispensar
          </button>
        </div>
        {error && <div style={{ marginTop: 6, fontSize: 12, color: "#C41E3A" }}>{error}</div>}
      </div>
    </section>
  );
}

export function FlagsAdminClient({ groups: initialGroups }: { groups: Group[] }) {
  const [groups, setGroups] = useState(initialGroups);

  function handleResolved(songId: string) {
    setGroups((prev) => prev.filter((g) => g.song.id !== songId));
  }

  return (
    <AdminPanel maxWidth={860} scroll={false}>
      <div style={{ padding: 14, display: "grid", gap: 12 }}>
        {groups.length === 0 && (
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Nenhuma sinalização pendente.</div>
        )}
        {groups.map((g) => (
          <FlagGroupCard key={g.song.id} group={g} onResolved={handleResolved} />
        ))}
      </div>
    </AdminPanel>
  );
}

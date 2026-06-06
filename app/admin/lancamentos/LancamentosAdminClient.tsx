"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { WeeklyReleaseAdminItem, WeeklyReleaseAlbumInfo } from "@/lib/weekly-releases";

type SpotifyHit = {
  spotifyId: string;
  title: string;
  artist: string;
  releaseDate: string | null;
  coverUrl: string | null;
  dbId?: number | null;
};

function AlbumSearchModal({
  releaseId,
  existingAlbumIds,
  onClose,
  onAdd,
}: {
  releaseId: string;
  existingAlbumIds: Set<number>;
  onClose: () => void;
  onAdd: (album: WeeklyReleaseAlbumInfo) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SpotifyHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/criticsfm/search-spotify?q=${encodeURIComponent(q.trim())}`);
        const data = await res.json() as { results: SpotifyHit[] };
        setResults(data.results ?? []);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q]);

  async function pick(hit: SpotifyHit) {
    let albumId = hit.dbId;
    if (!albumId) {
      setAdding(hit.spotifyId);
      try {
        const res = await fetch("/api/criticsfm/search-spotify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spotifyAlbumId: hit.spotifyId }),
        });
        if (!res.ok) return;
        const data = await res.json() as { id: number };
        albumId = data.id;
      } finally {
        setAdding(null);
      }
    }
    if (!albumId) return;
    if (existingAlbumIds.has(albumId)) return;

    const patchRes = await fetch(`/api/admin/lancamentos/${releaseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addAlbum", albumId }),
    });
    if (!patchRes.ok) return;

    onAdd({
      albumId,
      title: hit.title,
      artist: hit.artist,
      year: hit.releaseDate?.slice(0, 4) ?? "—",
      coverUrl: hit.coverUrl,
      spotifyUrl: null,
      order: existingAlbumIds.size,
    });
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 12px 0", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--surface)", borderRadius: 20, width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.28)", overflow: "hidden" }}>
        <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Buscar álbum no Spotify</span>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
        </div>
        <div style={{ padding: "14px 20px 0" }}>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar álbum ou artista…"
            style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ maxHeight: 380, overflowY: "auto", padding: "12px 20px 20px" }}>
          {loading && <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: 20 }}>Buscando…</div>}
          {!loading && results.length === 0 && q.trim() && (
            <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: 20 }}>Nenhum resultado.</div>
          )}
          {results.map((hit) => {
            const isAdded = hit.dbId ? existingAlbumIds.has(hit.dbId) : false;
            const isAdding = adding === hit.spotifyId;
            return (
              <div
                key={hit.spotifyId}
                onClick={() => !isAdded && !isAdding && pick(hit)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--divider-soft)", cursor: isAdded ? "default" : "pointer", opacity: isAdded ? 0.5 : 1 }}
              >
                {hit.coverUrl ? (
                  <img src={hit.coverUrl} alt={hit.title} width={40} height={40} style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--fill-inset)", flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hit.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{hit.artist} · {hit.releaseDate?.slice(0, 4) ?? "—"}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: isAdded ? "var(--text-disabled)" : "var(--accent)", flexShrink: 0 }}>
                  {isAdding ? "…" : isAdded ? "Adicionado" : "+ Adicionar"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ReleaseCard({
  release,
  onRefresh,
}: {
  release: WeeklyReleaseAdminItem;
  onRefresh: () => void;
}) {
  const [label, setLabel] = useState(release.weekLabel);
  const [albums, setAlbums] = useState<WeeklyReleaseAlbumInfo[]>(release.albums);
  const [showSearch, setShowSearch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const existingIds = new Set(albums.map((a) => a.albumId));

  async function saveLabel() {
    setSaving(true);
    try {
      await fetch(`/api/admin/lancamentos/${release.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekLabel: label }),
      });
      setMsg("Salvo.");
      setTimeout(() => setMsg(null), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    const action = release.active ? "deactivate" : "activate";
    await fetch(`/api/admin/lancamentos/${release.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    onRefresh();
  }

  async function removeAlbum(albumId: number) {
    await fetch(`/api/admin/lancamentos/${release.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "removeAlbum", albumId }),
    });
    setAlbums((prev) => prev.filter((a) => a.albumId !== albumId));
  }

  async function deleteRelease() {
    if (!confirm("Tem certeza? Isso vai apagar esta semana e todos os álbuns.")) return;
    await fetch(`/api/admin/lancamentos/${release.id}`, { method: "DELETE" });
    onRefresh();
  }

  return (
    <div style={{ background: "var(--surface)", borderRadius: 16, border: release.active ? "2px solid var(--accent)" : "1px solid var(--divider)", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {release.active && (
          <span style={{ fontSize: 11, fontWeight: 700, background: "var(--accent)", color: "white", padding: "2px 8px", borderRadius: 6 }}>ATIVA</span>
        )}
        <div style={{ flex: 1, minWidth: 200, display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{ ...inputStyle, flex: 1, fontSize: 13 }}
          />
          <button onClick={saveLabel} disabled={saving || label === release.weekLabel} style={primaryBtnStyle}>
            {saving ? "…" : "Salvar"}
          </button>
        </div>
        {msg && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{msg}</span>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {albums.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>Nenhum álbum adicionado ainda.</div>
        )}
        {albums.map((album) => (
          <div key={album.albumId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--fill-inset)", borderRadius: 10, border: "1px solid var(--divider-soft)" }}>
            {album.coverUrl ? (
              <img src={album.coverUrl} alt={album.title} width={40} height={40} style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--divider)", flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{album.title}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{album.artist} · {album.year}</div>
            </div>
            <button
              onClick={() => removeAlbum(album.albumId)}
              style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 18, lineHeight: 1, padding: "0 4px", flexShrink: 0 }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => setShowSearch(true)} style={secondaryBtnStyle}>+ Adicionar álbum</button>
        <button onClick={toggleActive} style={release.active ? dangerBtnStyle : primaryBtnStyle}>
          {release.active ? "Desativar" : "Ativar"}
        </button>
        <button onClick={deleteRelease} style={{ ...dangerBtnStyle, marginLeft: "auto" }}>Excluir</button>
      </div>

      {showSearch && (
        <AlbumSearchModal
          releaseId={release.id}
          existingAlbumIds={existingIds}
          onClose={() => setShowSearch(false)}
          onAdd={(album) => {
            setAlbums((prev) => [...prev, album]);
            existingIds.add(album.albumId);
          }}
        />
      )}
    </div>
  );
}

export function LancamentosAdminClient({
  initialReleases,
}: {
  initialReleases: WeeklyReleaseAdminItem[];
}) {
  const [releases, setReleases] = useState(initialReleases);
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function refresh() {
    const res = await fetch("/api/admin/lancamentos");
    if (res.ok) {
      const data = await res.json() as { releases: WeeklyReleaseAdminItem[] };
      setReleases(data.releases);
    }
  }

  async function create() {
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/lancamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekLabel: newLabel.trim() }),
      });
      if (!res.ok) { setMsg("Erro ao criar."); return; }
      setNewLabel("");
      await refresh();
      setMsg("Semana criada.");
      setTimeout(() => setMsg(null), 2000);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 680 }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--divider)", padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>Nova semana</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") create(); }}
            placeholder="Ex: 2–8 Jun 2025"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={create} disabled={creating || !newLabel.trim()} style={primaryBtnStyle}>
            {creating ? "…" : "Criar"}
          </button>
        </div>
        {msg && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>{msg}</div>}
      </div>

      {releases.length === 0 && (
        <div style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", padding: 40 }}>
          Nenhuma semana criada ainda.
        </div>
      )}

      {releases.map((r) => (
        <ReleaseCard key={r.id} release={r} onRefresh={refresh} />
      ))}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid var(--divider-strong)",
  fontSize: 14,
  fontFamily: "inherit",
  background: "var(--fill-inset)",
  color: "var(--text)",
  outline: "none",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 10,
  border: "none",
  background: "var(--accent)",
  color: "white",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 10,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const dangerBtnStyle: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 10,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  color: "var(--text-muted)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

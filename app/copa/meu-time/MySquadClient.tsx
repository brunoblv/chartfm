"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { CopaArtistAvatar } from "../CopaArtistAvatar";
import { COPA_SINGLES_COUNT, SLOT_LABELS, getArtistUsedSongKeys, isSingleSlotEditableInWindow, mergeArtistSingles, songPickKey, validateArtistSingleAssignment, type CopaSinglesEditWindow, type LockedSingleSlot } from "@/lib/copa";

type SingleData = { slotIndex: number; songName: string; songId: string | null };

type MyArtist = {
  id: string;
  artistSpotifyId: string | null;
  artistName: string;
  artistImage: string | null;
  artistColor: string;
  artistInitials: string;
  groupLetter: string;
  standings: { rank: number; pts: number; pj: number };
  singles: SingleData[];
  slotLocks: LockedSingleSlot[];
};

type Props = {
  copaId: string;
  copaStatus: string;
  maxArtists: number;
  editWindow: CopaSinglesEditWindow;
  myArtists: MyArtist[];
  takenSpotifyIds: string[];
};

type SpotifyArtist = {
  id: string;        // spotifyId
  spotifyId?: string;
  name: string;
  imageUrl: string | null;
  genres: string[];
};

export function MySquadClient({ copaId, copaStatus, maxArtists, editWindow, myArtists: initArtists, takenSpotifyIds }: Props) {
  const router = useRouter();
  const [artists, setArtists] = useState(initArtists);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyArtist[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  // Single editing
  const [editSingle, setEditSingle] = useState<{ artistId: string; slotIndex: number } | null>(null);
  const [singleSearch, setSingleSearch] = useState("");
  const [singleResults, setSingleResults] = useState<{ id: string | null; title: string; artist: string }[]>([]);
  const [savingSingle, setSavingSingle] = useState(false);

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const isRegistration = copaStatus === "REGISTRATION";

  async function searchArtists(q: string) {
    setSearchQ(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        // search API returns artists with {spotifyId, name, imageUrl}
        const raw: { spotifyId?: string; id?: string; name: string; imageUrl?: string | null }[] = json.artists ?? [];
        setSearchResults(raw.map((a) => ({
          id: a.spotifyId ?? a.id ?? "",
          name: a.name,
          imageUrl: a.imageUrl ?? null,
          genres: [],
        })));
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  async function claimArtist(spotifyArtist: SpotifyArtist) {
    if (adding) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/copa/${copaId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistSpotifyId: spotifyArtist.id || null,
          artistName: spotifyArtist.name,
          artistImage: spotifyArtist.imageUrl,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Erro ao cadastrar artista");
        return;
      }
      const { artist } = await res.json();
      // Optimistically append so the list updates without a reload (useState is
      // seeded once, so router.refresh() alone wouldn't refresh it).
      setArtists((prev) => [
        ...prev,
        {
          id: artist.id,
          artistSpotifyId: artist.artistSpotifyId,
          artistName: artist.artistName,
          artistImage: artist.artistImage,
          artistColor: artist.artistColor,
          artistInitials: artist.artistInitials,
          groupLetter: artist.groupLetter,
          standings: { rank: -1, pts: 0, pj: 0 },
          singles: [],
          slotLocks: [],
        },
      ]);
      setShowAddModal(false);
      setSearchQ("");
      setSearchResults([]);
      router.refresh();
    } finally {
      setAdding(false);
    }
  }

  async function removeArtist(artistId: string) {
    if (adding) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/copa/${copaId}/claim`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Erro ao remover artista");
        return;
      }
      setArtists((prev) => prev.filter((a) => a.id !== artistId));
      router.refresh();
    } finally {
      setAdding(false);
    }
  }

  async function searchSongs(q: string, artistName: string) {
    setSingleSearch(q);
    if (!q.trim()) { setSingleResults([]); return; }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q + " " + artistName)}&type=songs&limit=8`);
      const json = await res.json();
      setSingleResults((json.songs ?? []).map((s: { id: string; title: string; artist: string }) => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
      })));
    } catch {}
  }

  async function saveSingle(songName: string, songId: string | null) {
    if (!editSingle || savingSingle) return;
    const art = artists.find((a) => a.id === editSingle.artistId);
    if (!art) return;

    const merged = mergeArtistSingles(art.singles, [{
      slotIndex: editSingle.slotIndex,
      songName,
      songId,
    }]);
    const dupErr = validateArtistSingleAssignment(editSingle.slotIndex, songName, songId, merged);
    if (dupErr) {
      alert(dupErr);
      return;
    }

    setSavingSingle(true);
    try {
      const newSingles = merged;
      const res = await fetch(`/api/copa/${copaId}/singles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId: editSingle.artistId, singles: newSingles }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Não foi possível salvar a música");
        return;
      }
      setArtists((prev) =>
        prev.map((a) =>
          a.id === editSingle.artistId ? { ...a, singles: newSingles } : a,
        ),
      );
      setEditSingle(null);
      setSingleSearch("");
      setSingleResults([]);
    } finally {
      setSavingSingle(false);
    }
  }

  const editArt = editSingle ? artists.find((a) => a.id === editSingle.artistId) : null;
  const usedSongsForEdit = editArt && editSingle
    ? getArtistUsedSongKeys(editArt.singles, editSingle.slotIndex)
    : new Map<string, { slotIndex: number; label: string }>();

  function isSongAlreadyUsed(title: string, id: string | null) {
    const key = songPickKey(id, title);
    return key ? usedSongsForEdit.has(key) : false;
  }

  function usedInLabel(title: string, id: string | null) {
    const key = songPickKey(id, title);
    if (!key) return null;
    return usedSongsForEdit.get(key)?.label ?? null;
  }

  const rosterComplete = artists.length >= maxArtists;
  // Registration phase 1: still picking artists. Phase 2 (singles) only opens once
  // the full roster of artists has been claimed.
  const claiming = isRegistration && !rosterComplete;

  return (
    <div>
      <div style={{ padding: "24px 24px 0" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.03em", margin: 0 }}>Meu Time</h1>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, marginBottom: 20 }}>
          {claiming
            ? `${artists.length}/${maxArtists} artistas · escolha seu time, depois você define as músicas`
            : isRegistration
              ? "Time completo! Agora escolha as músicas de cada artista"
              : editWindow.open
                ? "Toque em ✏ nos slots Editáveis para trocar a música"
                : "Visualize suas músicas · edição indisponível agora"}
        </div>
      </div>

      {/* ── Phase 1: pick your artists ──────────────────────────────────── */}
      {claiming && (
        <div style={{ padding: "0 24px 24px" }}>
          {artists.map((art) => (
            <div
              key={art.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                background: "var(--surface)",
                border: "1px solid var(--divider)",
                borderRadius: 14,
                marginBottom: 10,
              }}
            >
              <CopaArtistAvatar {...art} size={40} />
              <div style={{ flex: 1, fontSize: 15, fontWeight: 800, letterSpacing: "-0.02em" }}>{art.artistName}</div>
              <button
                onClick={() => removeArtist(art.id)}
                disabled={adding}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}
                aria-label="Remover artista"
              >
                ×
              </button>
            </div>
          ))}

          <div
            onClick={() => { setShowAddModal(true); setSearchQ(""); setSearchResults([]); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              background: "var(--fill-inset)",
              border: "2px dashed var(--divider)",
              borderRadius: 14,
              cursor: "pointer",
              color: "var(--text-muted)",
              fontSize: 14,
              fontWeight: 700,
              transition: "0.12s",
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: 20 }}>+</span>
            Adicionar artista ({artists.length}/{maxArtists})
          </div>

          <div style={{ fontSize: 12, color: "var(--text-disabled)", textAlign: "center", marginTop: 8 }}>
            Faltam {maxArtists - artists.length} artista{maxArtists - artists.length !== 1 ? "s" : ""} para liberar a escolha das músicas.
          </div>
        </div>
      )}

      {/* ── Phase 2: choose songs (and live squad during the tournament) ── */}
      {!claiming && (
      <div style={{ padding: "0 24px 24px" }}>
        {isRegistration && rosterComplete && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              background: "rgba(52,199,89,.1)",
              border: "1px solid rgba(52,199,89,.3)",
              borderRadius: 12,
              marginBottom: 14,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text)",
            }}
          >
            <span style={{ fontSize: 18 }}>🎵</span>
            Time completo! Defina as músicas de cada artista — uma música diferente por fase. O sorteio dos grupos acontece quando todos terminarem.
          </div>
        )}
        {!isRegistration && (
          <div
            style={{
              padding: "12px 14px",
              background: editWindow.open ? "rgba(52,199,89,.1)" : "rgba(255,212,38,.08)",
              border: `1px solid ${editWindow.open ? "rgba(52,199,89,.35)" : "rgba(255,212,38,.3)"}`,
              borderRadius: 12,
              marginBottom: 14,
              fontSize: 12,
              lineHeight: 1.5,
              color: "var(--text-muted)",
            }}
          >
            {editWindow.open ? (
              <>
                <strong style={{ color: "#34C759" }}>Janela de edição aberta.</strong>{" "}
                {editWindow.message} Cada música só pode ser usada uma vez por artista.
              </>
            ) : (
              <>
                <strong style={{ color: "var(--text)" }}>Edição fechada.</strong>{" "}
                {editWindow.message}
              </>
            )}
          </div>
        )}
        {artists.map((art) => {
          const qual = art.standings.rank === 0 || art.standings.rank === 1;
          return (
            <div
              key={art.id}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--divider)",
                borderRadius: 14,
                overflow: "hidden",
                marginBottom: 10,
              }}
            >
              {/* Artist header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
                <CopaArtistAvatar {...art} size={44} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em" }}>{art.artistName}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    {isRegistration
                      ? "Defina as músicas"
                      : `Grupo ${art.groupLetter} · ${art.standings.pts}pts · ${art.standings.pj} PJ`}
                  </div>
                </div>
                {isRegistration ? null : qual ? (
                  <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(52,199,89,.12)", color: "#34C759", padding: "4px 9px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    ✓ Classificado
                  </span>
                ) : (
                  <span style={{ fontSize: 10, fontWeight: 700, background: "var(--fill-inset)", color: "var(--text-muted)", padding: "4px 9px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Em andamento
                  </span>
                )}
              </div>

              {/* Singles */}
              {Array.from({ length: COPA_SINGLES_COUNT }, (_, i) => {
                const single = art.singles.find((s) => s.slotIndex === i);
                const lock = art.slotLocks.find((l) => l.slotIndex === i);
                const canEdit = isSingleSlotEditableInWindow(i, editWindow, art.slotLocks, art.id);
                const isEmpty = !single || single.songName.startsWith("Single ");
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: "8px 16px",
                      borderTop: "1px solid var(--divider)",
                    }}
                  >
                    <span style={{ width: 20, textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--text-disabled)", flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-disabled)", marginBottom: 2 }}>
                        {SLOT_LABELS[i]}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: lock || !canEdit ? "var(--text-muted)" : isEmpty ? "var(--text-disabled)" : "var(--text)",
                          cursor: canEdit ? "pointer" : "default",
                        }}
                        onClick={() => {
                          if (!canEdit) return;
                          setEditSingle({ artistId: art.id, slotIndex: i });
                          setSingleSearch("");
                          setSingleResults([]);
                        }}
                      >
                        {isEmpty ? (canEdit ? "Escolher música…" : "—") : single!.songName}
                        {canEdit && (
                          <span style={{ color: "var(--text-disabled)", marginLeft: 4, fontSize: 10 }}>✏</span>
                        )}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 99,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        background: lock
                          ? lock.status === "LIVE"
                            ? "rgba(250,36,60,.12)"
                            : "var(--fill-inset)"
                          : canEdit
                            ? "rgba(52,199,89,.1)"
                            : "var(--fill-inset)",
                        color: lock
                          ? lock.status === "LIVE"
                            ? "#FA243C"
                            : "var(--text-muted)"
                          : canEdit
                            ? "#34C759"
                            : "var(--text-disabled)",
                      }}
                    >
                      {lock
                        ? lock.status === "LIVE"
                          ? "Em jogo"
                          : "Disputado"
                        : canEdit
                          ? "Editável"
                          : editWindow.competingArtistIds?.length
                            ? "Eliminado"
                            : "Fechado"}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      )}

      {/* Add artist modal */}
      {showAddModal && (
        <div
          style={{ position: "fixed", inset: 0, height: "100dvh", background: "rgba(0,0,0,.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box" }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{ background: "var(--panel, var(--surface))", width: "100%", maxWidth: 520, maxHeight: "calc(100dvh - 32px)", borderRadius: 20, display: "flex", flexDirection: "column", overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px", borderBottom: "1px solid var(--divider)", flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Adicionar Artista</div>
              <button onClick={() => setShowAddModal(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 26, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: "14px 20px" }}>
              <input
                autoFocus
                placeholder="Buscar artista no Spotify…"
                value={searchQ}
                onChange={(e) => searchArtists(e.target.value)}
                style={{
                  width: "100%",
                  background: "var(--fill-inset)",
                  border: "1.5px solid var(--divider)",
                  borderRadius: 10,
                  padding: "11px 14px",
                  color: "var(--text)",
                  fontSize: 15,
                  fontWeight: 600,
                  outline: "none",
                  marginBottom: 10,
                  boxSizing: "border-box",
                }}
              />
              {searching && (
                <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "12px 0" }}>
                  Buscando…
                </div>
              )}
              {!searching && searchQ.length > 1 && searchResults.length === 0 && (
                <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "12px 0" }}>
                  Nenhum artista encontrado.
                </div>
              )}
              {searchResults.map((art) => {
                const taken = takenSpotifyIds.includes(art.id);
                return (
                  <div
                    key={art.id}
                    onClick={() => !taken && claimArtist(art)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      borderRadius: 10,
                      cursor: taken ? "not-allowed" : "pointer",
                      opacity: taken ? 0.4 : 1,
                      transition: "0.1s",
                    }}
                  >
                    {art.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={art.imageUrl} alt={art.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--fill-inset)", display: "grid", placeItems: "center", fontSize: 16, fontWeight: 800 }}>
                        {art.name[0]}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{art.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                        {taken ? "Já cadastrado por outro participante" : art.genres.slice(0, 2).join(", ") || "Artista"}
                      </div>
                    </div>
                    {!taken && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(52,199,89,.12)", color: "#34C759", padding: "3px 8px", borderRadius: 99 }}>
                        Livre
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Edit single modal */}
      {editSingle && editArt && (
        <div
          style={{ position: "fixed", inset: 0, height: "100dvh", background: "rgba(0,0,0,.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box" }}
          onClick={() => { setEditSingle(null); setSingleSearch(""); setSingleResults([]); }}
        >
          <div
            style={{ background: "var(--panel, var(--surface))", width: "100%", maxWidth: 520, maxHeight: "calc(100dvh - 32px)", borderRadius: 20, display: "flex", flexDirection: "column", overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px", borderBottom: "1px solid var(--divider)", flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Definir single</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                  {SLOT_LABELS[editSingle.slotIndex]} · {editArt.artistName}
                </div>
              </div>
              <button onClick={() => { setEditSingle(null); setSingleSearch(""); setSingleResults([]); }} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 26, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: "14px 20px" }}>
              <input
                autoFocus
                placeholder={`Buscar música de ${editArt.artistName}…`}
                value={singleSearch}
                onChange={(e) => searchSongs(e.target.value, editArt.artistName)}
                style={{
                  width: "100%",
                  background: "var(--fill-inset)",
                  border: "1.5px solid var(--divider)",
                  borderRadius: 10,
                  padding: "11px 14px",
                  color: "var(--text)",
                  fontSize: 15,
                  fontWeight: 600,
                  outline: "none",
                  marginBottom: 10,
                  boxSizing: "border-box",
                }}
              />
              {/* Manual entry option */}
              {singleSearch.length > 0 && !isSongAlreadyUsed(singleSearch, null) && (
                <div
                  onClick={() => saveSingle(singleSearch, null)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, cursor: "pointer", border: "1px dashed var(--divider)", marginBottom: 8 }}
                >
                  <span style={{ fontSize: 18 }}>✏️</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Usar "{singleSearch}"</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Entrada manual</div>
                  </div>
                </div>
              )}
              {singleSearch.length > 0 && isSongAlreadyUsed(singleSearch, null) && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 0", marginBottom: 8 }}>
                  "{singleSearch}" já foi usada em {usedInLabel(singleSearch, null)}.
                </div>
              )}
              {singleResults.map((song) => {
                const taken = isSongAlreadyUsed(song.title, song.id);
                const takenLabel = usedInLabel(song.title, song.id);
                return (
                <div
                  key={song.id ?? song.title}
                  onClick={() => !taken && saveSingle(song.title, song.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    cursor: taken ? "not-allowed" : "pointer",
                    opacity: taken ? 0.45 : 1,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{song.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {taken ? `Já usada em ${takenLabel}` : song.artist}
                    </div>
                  </div>
                </div>
              );})}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

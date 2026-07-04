"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import { CopaArtistAvatar } from "../CopaArtistAvatar";
import { CopaArtistSinglesEditor } from "@/components/copa/CopaArtistSinglesEditor";
import { CopaSinglesMobileReorder } from "@/components/copa/CopaSinglesMobileReorder";
import { useIsMobile } from "@/hooks/useIsMobile";
import { COPA_SINGLES_COUNT, SLOT_LABELS, applyCopaSingleMoveFromEditable, findDuplicateSongInSingles, getLockedSlotIndexes, isSingleSlotEditableInWindow, mergeArtistSingles, validateArtistSingleAssignment, type CopaSinglesEditWindow, type LockedSingleSlot } from "@/lib/copa";
import { readCopaSongDrag, slotDropKey, writeCopaSongDrag } from "@/lib/copa-song-dnd";
import { searchCopaSongs } from "@/lib/copa-song-search-client";

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
  const [replaceTarget, setReplaceTarget] = useState<{ id: string; name: string } | null>(null);

  // Single editing
  const [editArtist, setEditArtist] = useState<{ artistId: string; focusSlotIndex: number } | null>(null);
  const [singleSearch, setSingleSearch] = useState("");
  const [singleResults, setSingleResults] = useState<{ id: string | null; title: string; artist: string; spotifyId?: string | null }[]>([]);
  const [savingSingle, setSavingSingle] = useState(false);
  const [slotDropOver, setSlotDropOver] = useState<string | null>(null);

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const isMobile = useIsMobile();
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

  function closeAddModal() {
    setShowAddModal(false);
    setReplaceTarget(null);
    setSearchQ("");
    setSearchResults([]);
  }

  function openReplaceModal(artistId: string, artistName: string) {
    const art = artists.find((a) => a.id === artistId);
    const hasSongs = art?.singles.some((s) => !s.songName.startsWith("Single "));
    if (hasSongs && !confirm(`Trocar ${artistName}? As músicas já escolhidas para esse artista serão perdidas.`)) {
      return;
    }
    setReplaceTarget({ id: artistId, name: artistName });
    setShowAddModal(true);
    setSearchQ("");
    setSearchResults([]);
  }

  async function claimArtist(spotifyArtist: SpotifyArtist) {
    if (adding) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/copa/${copaId}/claim`, {
        method: replaceTarget ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(replaceTarget ? { oldArtistId: replaceTarget.id } : {}),
          artistSpotifyId: spotifyArtist.id || null,
          artistName: spotifyArtist.name,
          artistImage: spotifyArtist.imageUrl,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Erro ao cadastrar artista");
        return;
      }
      const { artist } = await res.json();
      const newArtist = {
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
      };
      // Optimistically update so the list reflects the change without a reload
      // (useState is seeded once, so router.refresh() alone wouldn't refresh it).
      if (replaceTarget) {
        setArtists((prev) => prev.map((a) => (a.id === replaceTarget.id ? newArtist : a)));
      } else {
        setArtists((prev) => [...prev, newArtist]);
      }
      closeAddModal();
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
    const results = await searchCopaSongs(q, artistName);
    setSingleResults(results);
  }

  async function persistSingles(
    artistId: string,
    newSingles: SingleData[],
    spotifySongIdBySlot?: Record<number, string | null>,
  ) {
    const payloadSingles = newSingles.map((s) => ({
      ...s,
      spotifySongId: spotifySongIdBySlot?.[s.slotIndex] ?? null,
    }));
    const res = await fetch(`/api/copa/${copaId}/singles`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artistId, singles: payloadSingles }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Não foi possível salvar a música");
      return false;
    }
    const json = await res.json();
    const resolvedSingles: SingleData[] = (json.singles ?? newSingles).map(
      (s: { slotIndex: number; songName: string; songId: string | null }) => ({
        slotIndex: s.slotIndex,
        songName: s.songName,
        songId: s.songId ?? null,
      }),
    );
    setArtists((prev) =>
      prev.map((a) => (a.id === artistId ? { ...a, singles: resolvedSingles } : a)),
    );
    return true;
  }

  async function assignSingle(
    artistId: string,
    slotIndex: number,
    songName: string,
    songId: string | null,
    spotifySongId?: string | null,
  ) {
    if (savingSingle) return false;
    const art = artists.find((a) => a.id === artistId);
    if (!art) return false;
    if (!isSingleSlotEditableInWindow(slotIndex, editWindow, art.slotLocks, artistId)) {
      alert("Este slot não pode ser alterado agora.");
      return false;
    }

    const lockedIndexes = getLockedSlotIndexes(art.slotLocks);
    const validationOpts =
      art.slotLocks.length > 0 ? { lockedSlotIndexes: lockedIndexes } : undefined;
    const merged = applyCopaSingleMoveFromEditable(art.singles, slotIndex, songName, songId, lockedIndexes);
    const dupErr = validateArtistSingleAssignment(slotIndex, songName, songId, merged, validationOpts);
    if (dupErr) {
      alert(dupErr);
      return false;
    }

    setSavingSingle(true);
    try {
      return await persistSingles(
        artistId,
        merged,
        spotifySongId ? { [slotIndex]: spotifySongId } : undefined,
      );
    } finally {
      setSavingSingle(false);
    }
  }

  async function swapSingles(artistId: string, fromSlotIndex: number, toSlotIndex: number) {
    if (savingSingle || fromSlotIndex === toSlotIndex) return false;
    const art = artists.find((a) => a.id === artistId);
    if (!art) return false;
    if (
      !isSingleSlotEditableInWindow(fromSlotIndex, editWindow, art.slotLocks, artistId) ||
      !isSingleSlotEditableInWindow(toSlotIndex, editWindow, art.slotLocks, artistId)
    ) {
      alert("Um ou mais slots não podem ser alterados agora.");
      return false;
    }

    const pick = (slotIndex: number) => {
      const s = art.singles.find((x) => x.slotIndex === slotIndex);
      return s ?? { slotIndex, songName: `Single ${slotIndex + 1}`, songId: null };
    };
    const from = pick(fromSlotIndex);
    const to = pick(toSlotIndex);
    const lockedIndexes = getLockedSlotIndexes(art.slotLocks);
    const validationOpts =
      art.slotLocks.length > 0 ? { lockedSlotIndexes: lockedIndexes } : undefined;
    const merged = mergeArtistSingles(art.singles, [
      { slotIndex: fromSlotIndex, songName: to.songName, songId: to.songId },
      { slotIndex: toSlotIndex, songName: from.songName, songId: from.songId },
    ]);
    const dupErr = findDuplicateSongInSingles(merged, validationOpts);
    if (dupErr) {
      alert(dupErr);
      return false;
    }

    setSavingSingle(true);
    try {
      return await persistSingles(artistId, merged);
    } finally {
      setSavingSingle(false);
    }
  }

  function clearableSlots(art: MyArtist) {
    return Array.from({ length: COPA_SINGLES_COUNT }, (_, i) => i).filter((i) => {
      if (!isSingleSlotEditableInWindow(i, editWindow, art.slotLocks, art.id)) return false;
      const s = art.singles.find((x) => x.slotIndex === i);
      return !!s && !s.songName.startsWith("Single ");
    });
  }

  async function clearSingles(artistId: string) {
    if (savingSingle) return;
    const art = artists.find((a) => a.id === artistId);
    if (!art) return;
    const slots = clearableSlots(art);
    if (slots.length === 0) return;
    if (!confirm(`Limpar as ${slots.length} música${slots.length !== 1 ? "s" : ""} de ${art.artistName}? Fases já disputadas não são alteradas.`)) {
      return;
    }
    setSavingSingle(true);
    try {
      await persistSingles(
        artistId,
        slots.map((i) => ({ slotIndex: i, songName: `Single ${i + 1}`, songId: null })),
      );
    } finally {
      setSavingSingle(false);
    }
  }

  async function handleSlotDrop(artistId: string, slotIndex: number, e: React.DragEvent) {
    e.preventDefault();
    setSlotDropOver(null);
    const payload = readCopaSongDrag(e);
    if (!payload) return;

    if (payload.fromArtistId === artistId && payload.fromSlotIndex != null && payload.fromSlotIndex !== slotIndex) {
      await swapSingles(artistId, payload.fromSlotIndex, slotIndex);
      return;
    }
    await assignSingle(artistId, slotIndex, payload.title, payload.songId);
  }

  function openArtistEditor(artistId: string, focusSlotIndex: number) {
    const art = artists.find((a) => a.id === artistId);
    if (!art) return;
    if (!isSingleSlotEditableInWindow(focusSlotIndex, editWindow, art.slotLocks, artistId)) return;
    setEditArtist({ artistId, focusSlotIndex });
    setSingleSearch("");
    setSingleResults([]);
  }

  function closeArtistEditor() {
    setEditArtist(null);
    setSingleSearch("");
    setSingleResults([]);
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
                ? isMobile
                  ? "Toque num slot para escolher a música · ordene com ↑↓, trocar ou posição"
                  : "Toque em ✏ ou arraste músicas entre slots editáveis"
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
            onClick={() => { setReplaceTarget(null); setShowAddModal(true); setSearchQ(""); setSearchResults([]); }}
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

          <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginTop: 8 }}>
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
              background: "var(--up-bg)",
              border: "1px solid transparent",
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
              background: editWindow.open ? "var(--up-bg)" : "rgba(255,212,38,.08)",
              border: `1px solid ${editWindow.open ? "transparent" : "rgba(255,212,38,.3)"}`,
              borderRadius: 12,
              marginBottom: 14,
              fontSize: 12,
              lineHeight: 1.5,
              color: "var(--text-muted)",
            }}
          >
            {editWindow.open ? (
              <>
                <strong style={{ color: "var(--up-fg)" }}>Janela de edição aberta.</strong>{" "}
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
                {clearableSlots(art).length > 0 && (
                  <button
                    onClick={() => clearSingles(art.id)}
                    disabled={savingSingle}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: "var(--fill-inset)",
                      color: "var(--text-muted)",
                      border: "none",
                      padding: "6px 10px",
                      borderRadius: 8,
                      cursor: savingSingle ? "not-allowed" : "pointer",
                      marginRight: 6,
                    }}
                  >
                    Limpar músicas
                  </button>
                )}
                {isRegistration ? (
                  <button
                    onClick={() => openReplaceModal(art.id, art.artistName)}
                    disabled={adding}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: "var(--fill-inset)",
                      color: "var(--text-muted)",
                      border: "none",
                      padding: "6px 10px",
                      borderRadius: 8,
                      cursor: adding ? "not-allowed" : "pointer",
                    }}
                  >
                    Trocar
                  </button>
                ) : qual ? (
                  <span style={{ fontSize: 10, fontWeight: 700, background: "var(--up-bg)", color: "var(--up-fg)", padding: "4px 9px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    ✓ Classificado
                  </span>
                ) : (
                  <span style={{ fontSize: 10, fontWeight: 700, background: "var(--fill-inset)", color: "var(--text-muted)", padding: "4px 9px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Em andamento
                  </span>
                )}
              </div>

              {/* Singles */}
              {isMobile ? (
                <CopaSinglesMobileReorder
                  singles={art.singles}
                  slotLocks={art.slotLocks}
                  canEditSlot={(i) => isSingleSlotEditableInWindow(i, editWindow, art.slotLocks, art.id)}
                  onSwap={(from, to) => swapSingles(art.id, from, to)}
                  onEditSlot={(i) => openArtistEditor(art.id, i)}
                  competingArtistIds={editWindow.competingArtistIds}
                />
              ) : (
              Array.from({ length: COPA_SINGLES_COUNT }, (_, i) => {
                const single = art.singles.find((s) => s.slotIndex === i);
                const lock = art.slotLocks.find((l) => l.slotIndex === i);
                const canEdit = isSingleSlotEditableInWindow(i, editWindow, art.slotLocks, art.id);
                const isEmpty = !single || single.songName.startsWith("Single ");
                const dropKey = slotDropKey(art.id, i);
                const dropHighlight = slotDropOver === dropKey;
                const canDrag = canEdit && !isEmpty && !savingSingle;
                return (
                  <div
                    key={i}
                    draggable={canDrag}
                    onDragStart={(e) => {
                      if (!canDrag || !single) {
                        e.preventDefault();
                        return;
                      }
                      writeCopaSongDrag(e, {
                        title: single.songName,
                        songId: single.songId,
                        fromArtistId: art.id,
                        fromSlotIndex: i,
                      });
                    }}
                    onDragEnd={() => setSlotDropOver(null)}
                    onDragOver={(e) => {
                      if (!canEdit) return;
                      e.preventDefault();
                      setSlotDropOver(dropKey);
                    }}
                    onDragLeave={() => setSlotDropOver((prev) => (prev === dropKey ? null : prev))}
                    onDrop={(e) => handleSlotDrop(art.id, i, e)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: "8px 16px",
                      borderTop: "1px solid var(--divider)",
                      background: dropHighlight ? "var(--up-bg)" : undefined,
                      cursor: canDrag ? "grab" : canEdit ? "copy" : "default",
                    }}
                  >
                    {canDrag ? (
                      <GripVertical size={14} color="var(--text-muted)" style={{ flexShrink: 0, marginLeft: -4 }} />
                    ) : null}
                    <span style={{ width: 20, textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 2 }}>
                        {SLOT_LABELS[i]}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: lock || !canEdit ? "var(--text-muted)" : isEmpty ? "var(--text-muted)" : "var(--text)",
                          cursor: canEdit ? "pointer" : "default",
                        }}
                        onClick={() => {
                          if (!canEdit) return;
                          openArtistEditor(art.id, i);
                        }}
                      >
                        {isEmpty ? (canEdit ? "Escolher música…" : "—") : single!.songName}
                        {canEdit && (
                          <span style={{ color: "var(--text-muted)", marginLeft: 4, fontSize: 10 }}>✏</span>
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
                            ? "var(--accent-tint)"
                            : "var(--fill-inset)"
                          : canEdit
                            ? "var(--up-bg)"
                            : "var(--fill-inset)",
                        color: lock
                          ? lock.status === "LIVE"
                            ? "var(--accent)"
                            : "var(--text-muted)"
                          : canEdit
                            ? "var(--up-fg)"
                            : "var(--text-muted)",
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
              })
              )}
            </div>
          );
        })}
      </div>
      )}

      {/* Add artist modal */}
      {showAddModal && (
        <div
          style={{ position: "fixed", inset: 0, height: "100dvh", background: "rgba(0,0,0,.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box" }}
          onClick={closeAddModal}
        >
          <div
            style={{ background: "var(--panel, var(--surface))", width: "100%", maxWidth: 520, maxHeight: "calc(100dvh - 32px)", borderRadius: 20, display: "flex", flexDirection: "column", overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px", borderBottom: "1px solid var(--divider)", flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>
                {replaceTarget ? `Trocar ${replaceTarget.name}` : "Adicionar Artista"}
              </div>
              <button onClick={closeAddModal} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 26, cursor: "pointer", lineHeight: 1 }}>×</button>
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
                      <span style={{ fontSize: 10, fontWeight: 700, background: "var(--up-bg)", color: "var(--up-fg)", padding: "3px 8px", borderRadius: 99 }}>
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

      {/* Edit singles modal with drag and drop */}
      {editArtist && (() => {
        const art = artists.find((a) => a.id === editArtist.artistId);
        if (!art) return null;
        return (
          <CopaArtistSinglesEditor
            open
            onClose={closeArtistEditor}
            artistId={art.id}
            artistName={art.artistName}
            singles={art.singles}
            slotLocks={art.slotLocks}
            editWindow={editWindow}
            focusSlotIndex={editArtist.focusSlotIndex}
            canEditSlot={(slotIndex) => isSingleSlotEditableInWindow(slotIndex, editWindow, art.slotLocks, art.id)}
            search={singleSearch}
            onSearchChange={(q) => searchSongs(q, art.artistName)}
            results={singleResults}
            saving={savingSingle}
            onAssign={(slotIndex, songName, songId, spotifySongId) =>
              assignSingle(art.id, slotIndex, songName, songId, spotifySongId)
            }
            onSwap={(fromSlotIndex, toSlotIndex) => swapSingles(art.id, fromSlotIndex, toSlotIndex)}
          />
        );
      })()}
    </div>
  );
}

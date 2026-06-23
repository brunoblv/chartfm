"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { CopaArtistAvatar } from "@/app/copa/CopaArtistAvatar";
import { COPA_DAY_LABELS, SLOT_LABELS } from "@/lib/copa";

type Edition = {
  id: string;
  name: string;
  year: number;
  status: string;
  startsAt: string | null;
  artistCount: number;
  fixtureCount: number;
  participants: { userId: string; name: string; handle: string; avatarColor: string }[];
};

type Fixture = {
  id: string;
  phase: string;
  groupLetter: string | null;
  round: number | null;
  matchIndex: number;
  day: number;
  status: string;
  votesA: number;
  votesB: number;
  artistA: { artistName: string; artistInitials: string; artistColor: string; artistImage: string | null };
  artistB: { artistName: string; artistInitials: string; artistColor: string; artistImage: string | null };
};

type SquadArtist = {
  id: string;
  artistName: string;
  artistImage: string | null;
  artistColor: string;
  artistInitials: string;
  groupLetter: string;
  singles: { slotIndex: number; songName: string; songId: string | null }[];
  lockedSlots: number[];
};

type SquadParticipant = {
  userId: string;
  name: string;
  handle: string;
  avatarColor: string;
  artistCount: number;
  singlesFilled: number;
  artists: SquadArtist[];
};

type Props = {
  editions: Edition[];
  activeEditionId: string | null;
  fixturesByStatus: { UPCOMING: number; LIVE: number; DONE: number } | null;
  activeFixtures: Fixture[];
};

const STATUS_LABELS: Record<string, string> = {
  REGISTRATION: "Inscrições",
  GROUP_STAGE: "Fase de Grupos",
  KNOCKOUT: "Eliminatória",
  FINISHED: "Encerrado",
};

const PHASE_LABELS: Record<string, string> = {
  GROUP: "GRP",
  R16: "R16",
  QF: "QF",
  SF: "SF",
  THIRD_PLACE: "3º",
  FINAL: "FIN",
};

export function CopaAdminClient({ editions, activeEditionId, fixturesByStatus, activeFixtures }: Props) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("Copa ChartFM");
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [newMaxParticipants, setNewMaxParticipants] = useState(8);
  const [creating, setCreating] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);
  const [fixtureFilter, setFixtureFilter] = useState("ALL");
  const [dayFilter, setDayFilter] = useState<number | "ALL">("ALL");
  const [squadsEditionId, setSquadsEditionId] = useState<string | null>(null);
  const [squadsData, setSquadsData] = useState<{ artistsPerUser: number; squads: SquadParticipant[] } | null>(null);
  const [loadingSquads, setLoadingSquads] = useState(false);
  const [expandedParticipant, setExpandedParticipant] = useState<string | null>(null);
  const [editSingle, setEditSingle] = useState<{ artistId: string; artistName: string; slotIndex: number } | null>(null);
  const [singleSearch, setSingleSearch] = useState("");
  const [singleResults, setSingleResults] = useState<{ id: string | null; title: string; artist: string }[]>([]);
  const [savingSingle, setSavingSingle] = useState(false);
  const startRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ISO (UTC) → valor de <input datetime-local> no fuso do navegador.
  function toLocalInput(iso: string): string {
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  async function saveStart(copaId: string) {
    const value = startRefs.current[copaId]?.value;
    setActioning("set_start" + copaId);
    try {
      // datetime-local (hora local) → instante UTC.
      const startsAt = value ? new Date(value).toISOString() : null;
      const res = await fetch(`/api/admin/copa/${copaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_start", startsAt }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Erro");
        return;
      }
      router.refresh();
    } finally {
      setActioning(null);
    }
  }

  async function createCopa() {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/copa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, year: newYear, maxParticipants: newMaxParticipants }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Erro ao criar Copa");
        return;
      }
      setShowCreate(false);
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  async function editionAction(copaId: string, action: string) {
    setActioning(action);
    try {
      const res = await fetch(`/api/admin/copa/${copaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Erro");
        return;
      }
      router.refresh();
    } finally {
      setActioning(null);
    }
  }

  async function seedTestArtists(copaId: string) {
    if (!confirm("Cadastrar 7 artistas aleatórios (Global 100, >7 singles) para o bot de teste?")) return;
    setActioning("seed-test-artists");
    try {
      const res = await fetch(`/api/admin/copa/${copaId}/seed-test-artists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error ?? "Erro ao cadastrar artistas de teste");
        return;
      }
      const names = (json.artists as { name: string }[]).map((a) => a.name).join(", ");
      alert(`Cadastrados para @${json.ownerHandle}: ${names}`);
      router.refresh();
    } finally {
      setActioning(null);
    }
  }

  async function loadSquads(copaId: string) {
    if (squadsEditionId === copaId && squadsData) {
      setSquadsEditionId(null);
      setSquadsData(null);
      setExpandedParticipant(null);
      return;
    }
    setLoadingSquads(true);
    setSquadsEditionId(copaId);
    setExpandedParticipant(null);
    try {
      const res = await fetch(`/api/admin/copa/${copaId}/squads`);
      if (!res.ok) {
        alert("Erro ao carregar escolhas");
        setSquadsEditionId(null);
        return;
      }
      const json = await res.json();
      setSquadsData({ artistsPerUser: json.artistsPerUser, squads: json.squads });
    } finally {
      setLoadingSquads(false);
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

  async function saveAdminSingle(songName: string, songId: string | null) {
    if (!editSingle || !squadsEditionId || savingSingle) return;
    setSavingSingle(true);
    try {
      const res = await fetch(`/api/admin/copa/${squadsEditionId}/singles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistId: editSingle.artistId,
          slotIndex: editSingle.slotIndex,
          songName,
          songId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Erro ao salvar");
        return;
      }
      setSquadsData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          squads: prev.squads.map((p) => {
            const artists = p.artists.map((a) => {
              if (a.id !== editSingle.artistId) return a;
              const others = a.singles.filter((s) => s.slotIndex !== editSingle.slotIndex);
              return {
                ...a,
                singles: [...others, { slotIndex: editSingle.slotIndex, songName, songId }].sort(
                  (x, y) => x.slotIndex - y.slotIndex,
                ),
              };
            });
            const singlesFilled = artists.reduce((n, a) => n + a.singles.length, 0);
            return { ...p, artists, singlesFilled };
          }),
        };
      });
      setEditSingle(null);
      setSingleSearch("");
      setSingleResults([]);
    } finally {
      setSavingSingle(false);
    }
  }

  async function setFixtureStatus(fixtureId: string, status: "UPCOMING" | "LIVE" | "DONE") {
    if (!activeEditionId) return;
    setActioning(fixtureId + status);
    try {
      const res = await fetch(`/api/admin/copa/${activeEditionId}/fixtures/${fixtureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { alert("Erro"); return; }
      router.refresh();
    } finally {
      setActioning(null);
    }
  }

  const availableDays = [...new Set(activeFixtures.map((f) => f.day))].sort((a, b) => a - b);
  const filteredFixtures = activeFixtures.filter((f) => {
    const matchStatusPhase =
      fixtureFilter === "ALL" ? true :
      fixtureFilter === "LIVE" ? f.status === "LIVE" :
      fixtureFilter === "UPCOMING" ? f.status === "UPCOMING" :
      f.phase === fixtureFilter;
    const matchDay = dayFilter === "ALL" ? true : f.day === dayFilter;
    return matchStatusPhase && matchDay;
  });

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
        <button
          onClick={() => setShowCreate(true)}
          style={{ background: "#FFD426", color: "#000", border: "none", padding: "10px 18px", borderRadius: 99, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
        >
          + Nova Copa
        </button>
      </div>

      {/* Editions list */}
      {editions.map((e) => (
        <div key={e.id} style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 14, padding: "18px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>{e.name} {e.year}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                {STATUS_LABELS[e.status]} · {e.artistCount} artistas · {e.fixtureCount} jogos
              </div>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.05em",
              background: e.status === "GROUP_STAGE" ? "rgba(52,199,89,.12)" : e.status === "REGISTRATION" ? "rgba(255,212,38,.12)" : "var(--fill-inset)",
              color: e.status === "GROUP_STAGE" ? "#34C759" : e.status === "REGISTRATION" ? "#FFD426" : "var(--text-muted)",
            }}>
              {STATUS_LABELS[e.status]}
            </span>
          </div>

          {/* Participants */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {e.participants.map((p) => (
              <span key={p.userId} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", background: "var(--fill-inset)", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
                <span style={{ width: 16, height: 16, borderRadius: "50%", background: p.avatarColor, display: "inline-block" }} />
                {p.name}
              </span>
            ))}
          </div>

          {/* Participant choices */}
          <div style={{ marginBottom: 14 }}>
            <button
              onClick={() => loadSquads(e.id)}
              disabled={loadingSquads}
              style={{
                padding: "8px 14px", borderRadius: 8, border: "1px solid var(--divider)",
                background: squadsEditionId === e.id ? "rgba(255,212,38,.12)" : "var(--fill-inset)",
                color: squadsEditionId === e.id ? "#FFD426" : "var(--text)",
                fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: loadingSquads ? 0.5 : 1,
              }}
            >
              {loadingSquads && squadsEditionId === e.id
                ? "Carregando…"
                : squadsEditionId === e.id
                  ? "Ocultar escolhas"
                  : "🎵 Gerenciar escolhas dos participantes"}
            </button>
          </div>

          {squadsEditionId === e.id && squadsData && (
            <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {squadsData.squads.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "12px", background: "var(--fill-inset)", borderRadius: 10 }}>
                  Nenhum participante inscrito.
                </div>
              ) : squadsData.squads.map((p) => {
                const expectedSingles = p.artistCount * 7;
                const isExpanded = expandedParticipant === p.userId;
                return (
                  <div key={p.userId} style={{ background: "var(--fill-inset)", borderRadius: 12, overflow: "hidden" }}>
                    <button
                      onClick={() => setExpandedParticipant(isExpanded ? null : p.userId)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                        background: "none", border: "none", cursor: "pointer", textAlign: "left", color: "var(--text)",
                      }}
                    >
                      <span style={{ width: 28, height: 28, borderRadius: "50%", background: p.avatarColor, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                          @{p.handle} · {p.artistCount}/{squadsData.artistsPerUser} artistas · {p.singlesFilled}/{expectedSingles || "—"} músicas
                        </div>
                      </div>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{isExpanded ? "▲" : "▼"}</span>
                    </button>

                    {isExpanded && (
                      <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                        {p.artists.length === 0 ? (
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Nenhum artista cadastrado.</div>
                        ) : p.artists.map((art) => (
                          <div key={art.id} style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 10, overflow: "hidden" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
                              <CopaArtistAvatar {...art} size={32} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 800 }}>{art.artistName}</div>
                                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                                  {art.groupLetter !== "?" ? `Grupo ${art.groupLetter}` : "Aguardando sorteio"}
                                </div>
                              </div>
                            </div>
                            {Array.from({ length: 7 }, (_, i) => {
                              const single = art.singles.find((s) => s.slotIndex === i);
                              const isLocked = art.lockedSlots.includes(i);
                              const isEmpty = !single || single.songName.startsWith("Single ");
                              return (
                                <div
                                  key={i}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 8, padding: "7px 12px",
                                    borderTop: "1px solid var(--divider)", fontSize: 12,
                                  }}
                                >
                                  <span style={{ width: 16, textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--text-disabled)", flexShrink: 0 }}>
                                    {i + 1}
                                  </span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-disabled)", marginBottom: 1 }}>
                                      {SLOT_LABELS[i]}
                                    </div>
                                    <div
                                      onClick={() => {
                                        setEditSingle({ artistId: art.id, artistName: art.artistName, slotIndex: i });
                                        setSingleSearch(single && !isEmpty ? single.songName : "");
                                        setSingleResults([]);
                                      }}
                                      style={{
                                        fontWeight: 600,
                                        color: isEmpty ? "var(--text-disabled)" : "var(--text)",
                                        cursor: "pointer",
                                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                      }}
                                    >
                                      {isEmpty ? "— não definida" : single!.songName}
                                      <span style={{ color: "var(--text-disabled)", marginLeft: 4, fontSize: 10 }}>✏</span>
                                    </div>
                                  </div>
                                  {isLocked && (
                                    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 99, background: "var(--fill-inset)", color: "var(--text-muted)", flexShrink: 0 }}>
                                      Disputado
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Stats */}
          {e.id === activeEditionId && fixturesByStatus && (
            <div style={{ display: "flex", gap: 16, marginBottom: 14, padding: "12px", background: "var(--fill-inset)", borderRadius: 10 }}>
              <div><div style={{ fontSize: 20, fontWeight: 800 }}>{fixturesByStatus.UPCOMING}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>Em breve</div></div>
              <div><div style={{ fontSize: 20, fontWeight: 800, color: "#FA243C" }}>{fixturesByStatus.LIVE}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>Ao vivo</div></div>
              <div><div style={{ fontSize: 20, fontWeight: 800, color: "#34C759" }}>{fixturesByStatus.DONE}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>Encerrados</div></div>
            </div>
          )}

          {/* Start date / time */}
          {e.status !== "FINISHED" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14, padding: "12px", background: "var(--fill-inset)", borderRadius: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>📅 Início (data e hora dos jogos):</span>
              <input
                type="datetime-local"
                defaultValue={e.startsAt ? toLocalInput(e.startsAt) : ""}
                ref={(el) => { startRefs.current[e.id] = el; }}
                style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 8, padding: "6px 10px", color: "var(--text)", fontSize: 13 }}
              />
              <button
                onClick={() => saveStart(e.id)}
                disabled={!!actioning}
                style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#FFD426", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: actioning ? 0.5 : 1 }}
              >
                Salvar
              </button>
              <span style={{ fontSize: 11, color: "var(--text-disabled)", width: "100%" }}>
                A partir dessa data/hora os jogos abrem e avançam 1 dia por vez automaticamente (Dia 1 → grupos · … · Dia 10 → final). Deixe vazio para controle manual (botão Avançar Dia).
              </span>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {e.status === "REGISTRATION" && (
              <>
                <button
                  onClick={() => seedTestArtists(e.id)}
                  disabled={!!actioning}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--divider)", background: "var(--fill-inset)", color: "var(--text)", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: actioning ? 0.5 : 1 }}
                >
                  + 7 artistas de teste
                </button>
                <button
                  onClick={() => editionAction(e.id, "draw_groups")}
                  disabled={!!actioning}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#FFD426", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: actioning ? 0.5 : 1 }}
                >
                  🎲 Sortear Grupos
                </button>
                <button
                  onClick={() => editionAction(e.id, "start_group_stage")}
                  disabled={!!actioning}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#34C759", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: actioning ? 0.5 : 1 }}
                >
                  Iniciar Fase de Grupos
                </button>
              </>
            )}
            {(e.status === "GROUP_STAGE" || e.status === "KNOCKOUT") && (
              <button
                onClick={() => { if (confirm("Avançar o dia? Encerra os jogos Ao vivo e abre o próximo lote.")) editionAction(e.id, "advance_day"); }}
                disabled={!!actioning}
                style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#FFD426", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: actioning ? 0.5 : 1 }}
              >
                ⏭️ Avançar Dia
              </button>
            )}
            {e.status === "GROUP_STAGE" && (
              <button
                onClick={() => editionAction(e.id, "start_knockout")}
                disabled={!!actioning}
                style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--divider)", background: "transparent", color: "var(--text-muted)", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: actioning ? 0.5 : 1 }}
              >
                Iniciar Fase Eliminatória
              </button>
            )}
            {e.status !== "FINISHED" && (
              <button
                onClick={() => { if (confirm("Encerrar esta Copa?")) editionAction(e.id, "finish"); }}
                disabled={!!actioning}
                style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--divider)", background: "transparent", color: "var(--text-muted)", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: actioning ? 0.5 : 1 }}
              >
                Encerrar Copa
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Fixture manager */}
      {activeFixtures.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 16 }}>Gerenciar Jogos</h2>

          {/* Filter */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {["ALL", "LIVE", "UPCOMING", "GROUP", "R16", "QF", "SF", "FINAL"].map((f) => (
              <button
                key={f}
                onClick={() => setFixtureFilter(f)}
                style={{
                  padding: "6px 12px", borderRadius: 99, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                  background: fixtureFilter === f ? "#FFD426" : "var(--fill-inset)",
                  color: fixtureFilter === f ? "#000" : "var(--text-muted)",
                }}
              >
                {f === "ALL" ? "Todos" : f === "LIVE" ? "Ao vivo" : f === "UPCOMING" ? "Em breve" : PHASE_LABELS[f] ?? f}
              </button>
            ))}
          </div>

          {/* Day filter */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            <button
              onClick={() => setDayFilter("ALL")}
              style={{
                padding: "6px 12px", borderRadius: 99, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                background: dayFilter === "ALL" ? "#34C759" : "var(--fill-inset)",
                color: dayFilter === "ALL" ? "#fff" : "var(--text-muted)",
              }}
            >
              Todos os dias
            </button>
            {availableDays.map((d) => (
              <button
                key={d}
                onClick={() => setDayFilter(d)}
                title={COPA_DAY_LABELS[d - 1]}
                style={{
                  padding: "6px 12px", borderRadius: 99, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                  background: dayFilter === d ? "#34C759" : "var(--fill-inset)",
                  color: dayFilter === d ? "#fff" : "var(--text-muted)",
                }}
              >
                Dia {d} · {COPA_DAY_LABELS[d - 1]}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filteredFixtures.map((f) => (
              <div
                key={f.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  background: "var(--surface)",
                  border: `1px solid ${f.status === "LIVE" ? "rgba(250,36,60,.35)" : "var(--divider)"}`,
                  borderRadius: 10,
                }}
              >
                <span style={{ width: 28, fontSize: 10, fontWeight: 700, color: "var(--text-disabled)", flexShrink: 0, textAlign: "center" }}>
                  {PHASE_LABELS[f.phase] ?? f.phase}
                  {f.groupLetter && ` ${f.groupLetter}`}
                  {f.round && ` R${f.round}`}
                </span>
                <CopaArtistAvatar
                  artistName={f.artistA.artistName}
                  artistImage={f.artistA.artistImage}
                  artistColor={f.artistA.artistColor}
                  artistInitials={f.artistA.artistInitials}
                  size={22}
                />
                <span style={{ fontSize: 13, fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.artistA.artistName}</span>
                <span style={{ fontSize: 12, fontWeight: 800, padding: "0 6px", flexShrink: 0 }}>
                  {Math.floor(f.votesA / 2)}–{Math.floor(f.votesB / 2)}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, flex: 1, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.artistB.artistName}</span>
                <CopaArtistAvatar
                  artistName={f.artistB.artistName}
                  artistImage={f.artistB.artistImage}
                  artistColor={f.artistB.artistColor}
                  artistInitials={f.artistB.artistInitials}
                  size={22}
                />

                {/* Status controls */}
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  {f.status !== "LIVE" && (
                    <button
                      onClick={() => setFixtureStatus(f.id, "LIVE")}
                      disabled={!!actioning}
                      style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "rgba(250,36,60,.13)", color: "#FA243C", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >
                      ▶ Ao vivo
                    </button>
                  )}
                  {f.status !== "DONE" && (
                    <button
                      onClick={() => setFixtureStatus(f.id, "DONE")}
                      disabled={!!actioning}
                      style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "rgba(52,199,89,.12)", color: "#34C759", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >
                      ✓ Encerrar
                    </button>
                  )}
                  {f.status !== "UPCOMING" && (
                    <button
                      onClick={() => setFixtureStatus(f.id, "UPCOMING")}
                      disabled={!!actioning}
                      style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--divider)", background: "transparent", color: "var(--text-muted)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin edit single modal */}
      {editSingle && (
        <div
          style={{ position: "fixed", inset: 0, height: "100dvh", background: "rgba(0,0,0,.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box" }}
          onClick={() => { setEditSingle(null); setSingleSearch(""); setSingleResults([]); }}
        >
          <div
            style={{ background: "var(--panel, var(--surface))", width: "100%", maxWidth: 520, maxHeight: "calc(100dvh - 32px)", borderRadius: 20, display: "flex", flexDirection: "column", overflow: "hidden" }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px", borderBottom: "1px solid var(--divider)", flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Corrigir música</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                  {SLOT_LABELS[editSingle.slotIndex]} · {editSingle.artistName}
                </div>
              </div>
              <button onClick={() => { setEditSingle(null); setSingleSearch(""); setSingleResults([]); }} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 26, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: "14px 20px" }}>
              <input
                autoFocus
                placeholder={`Buscar música de ${editSingle.artistName}…`}
                value={singleSearch}
                onChange={(ev) => searchSongs(ev.target.value, editSingle.artistName)}
                style={{
                  width: "100%", background: "var(--fill-inset)", border: "1.5px solid var(--divider)", borderRadius: 10,
                  padding: "11px 14px", color: "var(--text)", fontSize: 15, fontWeight: 600, outline: "none", marginBottom: 10, boxSizing: "border-box",
                }}
              />
              {singleSearch.length > 0 && (
                <div
                  onClick={() => saveAdminSingle(singleSearch, null)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, cursor: "pointer", border: "1px dashed var(--divider)", marginBottom: 8 }}
                >
                  <span style={{ fontSize: 18 }}>✏️</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Usar &quot;{singleSearch}&quot;</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Entrada manual</div>
                  </div>
                </div>
              )}
              {singleResults.map((song) => (
                <div
                  key={song.id ?? song.title}
                  onClick={() => saveAdminSingle(song.title, song.id)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, cursor: "pointer" }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{song.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{song.artist}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create Copa modal */}
      {showCreate && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowCreate(false)}
        >
          <div
            style={{ background: "var(--surface)", width: "100%", maxWidth: 480, borderRadius: 20, padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Nova Copa ChartFM</div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Nome</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ width: "100%", background: "var(--fill-inset)", border: "1.5px solid var(--divider)", borderRadius: 10, padding: "10px 14px", color: "var(--text)", fontSize: 14, fontWeight: 600, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Ano</label>
              <input
                type="number"
                value={newYear}
                onChange={(e) => setNewYear(Number(e.target.value))}
                style={{ width: "100%", background: "var(--fill-inset)", border: "1.5px solid var(--divider)", borderRadius: 10, padding: "10px 14px", color: "var(--text)", fontSize: 14, fontWeight: 600, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                Máximo de participantes
              </label>
              <input
                type="number"
                min={2}
                value={newMaxParticipants}
                onChange={(e) => setNewMaxParticipants(Number(e.target.value))}
                style={{ width: "100%", background: "var(--fill-inset)", border: "1.5px solid var(--divider)", borderRadius: 10, padding: "10px 14px", color: "var(--text)", fontSize: 14, fontWeight: 600, outline: "none", boxSizing: "border-box" }}
              />
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                Os próprios usuários se inscrevem enquanto a Copa está em Inscrições.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowCreate(false)}
                style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid var(--divider)", background: "transparent", color: "var(--text-muted)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={createCopa}
                disabled={creating}
                style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: "#FFD426", color: "#000", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: creating ? 0.5 : 1 }}
              >
                {creating ? "Criando…" : "Criar Copa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CopaArtistAvatar } from "@/app/copa/CopaArtistAvatar";

type Edition = {
  id: string;
  name: string;
  year: number;
  status: string;
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
  status: string;
  votesA: number;
  votesB: number;
  artistA: { artistName: string; artistInitials: string; artistColor: string; artistImage: string | null };
  artistB: { artistName: string; artistInitials: string; artistColor: string; artistImage: string | null };
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

  const filteredFixtures = activeFixtures.filter((f) =>
    fixtureFilter === "ALL" ? true :
    fixtureFilter === "LIVE" ? f.status === "LIVE" :
    fixtureFilter === "UPCOMING" ? f.status === "UPCOMING" :
    f.phase === fixtureFilter,
  );

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

          {/* Stats */}
          {e.id === activeEditionId && fixturesByStatus && (
            <div style={{ display: "flex", gap: 16, marginBottom: 14, padding: "12px", background: "var(--fill-inset)", borderRadius: 10 }}>
              <div><div style={{ fontSize: 20, fontWeight: 800 }}>{fixturesByStatus.UPCOMING}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>Em breve</div></div>
              <div><div style={{ fontSize: 20, fontWeight: 800, color: "#FA243C" }}>{fixturesByStatus.LIVE}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>Ao vivo</div></div>
              <div><div style={{ fontSize: 20, fontWeight: 800, color: "#34C759" }}>{fixturesByStatus.DONE}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>Encerrados</div></div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {e.status === "REGISTRATION" && (
              <>
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
            {e.status === "GROUP_STAGE" && (
              <button
                onClick={() => editionAction(e.id, "start_knockout")}
                disabled={!!actioning}
                style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#FFD426", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: actioning ? 0.5 : 1 }}
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

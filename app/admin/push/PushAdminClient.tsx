"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, ExternalLink, RefreshCw } from "lucide-react";

type PushPhase = "SUBMISSION" | "LISTENING" | "RANKING" | "RESULT";

interface RoundRow {
  id: string;
  number: number;
  title: string | null;
  phase: PushPhase;
  season: number;
  submissionEndsAt: string;
  listeningEndsAt: string;
  rankingEndsAt: string;
  spotifyPlaylistId: string | null;
  createdAt: string;
  submissionCount: number;
}

const PHASE_LABELS: Record<PushPhase, string> = {
  SUBMISSION: "Inscrições",
  LISTENING: "Escuta",
  RANKING: "Avaliação",
  RESULT: "Resultado",
};

const PHASE_NEXT: Partial<Record<PushPhase, string>> = {
  SUBMISSION: "Avançar para Escuta",
  LISTENING: "Avançar para Avaliação",
  RANKING: "Avançar para Resultado",
};

function toLocalDatetimeInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function inputToISO(local: string) {
  return new Date(local).toISOString();
}

export default function PushAdminClient({ initialRounds }: { initialRounds: RoundRow[] }) {
  const [rounds, setRounds] = useState<RoundRow[]>(initialRounds);
  const [expanded, setExpanded] = useState<string | null>(rounds[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    season: 1,
    submissionEndsAt: "",
    listeningEndsAt: "",
    rankingEndsAt: "",
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  function flash(id: string, text: string, ok: boolean) {
    setMsg({ id, text, ok });
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleCreate() {
    if (!createForm.submissionEndsAt || !createForm.listeningEndsAt || !createForm.rankingEndsAt) {
      setCreateError("Preencha todas as datas");
      return;
    }
    setCreateError(null);
    setBusyId("create");
    try {
      const res = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createForm.title || undefined,
          season: createForm.season,
          submissionEndsAt: inputToISO(createForm.submissionEndsAt),
          listeningEndsAt: inputToISO(createForm.listeningEndsAt),
          rankingEndsAt: inputToISO(createForm.rankingEndsAt),
        }),
      });
      const data = await res.json() as RoundRow & { error?: string };
      if (!res.ok) { setCreateError(data.error ?? "Erro"); return; }
      setRounds((prev) => [{ ...data, submissionCount: 0 }, ...prev]);
      setCreating(false);
      setCreateForm({ title: "", season: 1, submissionEndsAt: "", listeningEndsAt: "", rankingEndsAt: "" });
      setExpanded(data.id);
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdvancePhase(roundId: string) {
    setBusyId(roundId + "-advance");
    try {
      const res = await fetch(`/api/admin/push/${roundId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advancePhase: true }),
      });
      const data = await res.json() as RoundRow & { error?: string };
      if (!res.ok) { flash(roundId, data.error ?? "Erro", false); return; }
      setRounds((prev) => prev.map((r) => r.id === roundId ? { ...r, phase: data.phase } : r));
      flash(roundId, `Fase avançada para ${PHASE_LABELS[data.phase]}`, true);
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreatePlaylist(roundId: string) {
    setBusyId(roundId + "-playlist");
    try {
      const res = await fetch(`/api/admin/push/${roundId}/playlist`, { method: "POST" });
      const data = await res.json() as { playlistId?: string; playlistUrl?: string; error?: string };
      if (!res.ok) { flash(roundId, data.error ?? "Erro ao criar playlist", false); return; }
      setRounds((prev) => prev.map((r) => r.id === roundId ? { ...r, spotifyPlaylistId: data.playlistId ?? r.spotifyPlaylistId } : r));
      flash(roundId, "Playlist criada no Spotify!", true);
    } finally {
      setBusyId(null);
    }
  }

  async function handleUpdateDates(round: RoundRow, updates: Partial<{ submissionEndsAt: string; listeningEndsAt: string; rankingEndsAt: string; spotifyPlaylistId: string }>) {
    setBusyId(round.id + "-update");
    try {
      const res = await fetch(`/api/admin/push/${round.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json() as RoundRow & { error?: string };
      if (!res.ok) { flash(round.id, data.error ?? "Erro", false); return; }
      setRounds((prev) => prev.map((r) => r.id === round.id ? { ...r, ...data } : r));
      flash(round.id, "Salvo!", true);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(roundId: string) {
    if (!confirm("Excluir esta rodada? Esta ação não pode ser desfeita.")) return;
    setBusyId(roundId + "-delete");
    try {
      await fetch(`/api/admin/push/${roundId}`, { method: "DELETE" });
      setRounds((prev) => prev.filter((r) => r.id !== roundId));
    } finally {
      setBusyId(null);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid var(--divider-strong)",
    background: "var(--surface)",
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
  };

  const btnStyle = (accent?: boolean): React.CSSProperties => ({
    padding: "8px 14px",
    borderRadius: 8,
    border: "none",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    background: accent ? "var(--accent)" : "var(--fill-inset)",
    color: accent ? "white" : "var(--text)",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
      {/* Create button */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="button" onClick={() => setCreating((o) => !o)} style={{ ...btnStyle(true), display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={16} /> Nova rodada
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div style={{ padding: "18px 20px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--divider)", display: "flex", flexDirection: "column", gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Nova rodada</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 8 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Título (opcional)</label>
              <input type="text" value={createForm.title} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex: Hits de verão" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Temporada</label>
              <input type="number" value={createForm.season} onChange={(e) => setCreateForm((f) => ({ ...f, season: Number(e.target.value) }))} min={1} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Inscrições até</label>
              <input type="datetime-local" value={createForm.submissionEndsAt} onChange={(e) => setCreateForm((f) => ({ ...f, submissionEndsAt: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Escuta até</label>
              <input type="datetime-local" value={createForm.listeningEndsAt} onChange={(e) => setCreateForm((f) => ({ ...f, listeningEndsAt: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Avaliação até</label>
              <input type="datetime-local" value={createForm.rankingEndsAt} onChange={(e) => setCreateForm((f) => ({ ...f, rankingEndsAt: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          {createError && <div style={{ color: "var(--accent)", fontSize: 13 }}>{createError}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={handleCreate} disabled={busyId === "create"} style={btnStyle(true)}>
              {busyId === "create" ? "Criando…" : "Criar rodada"}
            </button>
            <button type="button" onClick={() => setCreating(false)} style={btnStyle()}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Round list */}
      {rounds.length === 0 && (
        <div style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", padding: "40px 20px" }}>
          Nenhuma rodada ainda.
        </div>
      )}

      {rounds.map((round) => {
        const isExpanded = expanded === round.id;
        const busy = busyId?.startsWith(round.id);

        return (
          <div key={round.id} style={{ borderRadius: 14, border: "1px solid var(--divider)", background: "var(--surface)", overflow: "hidden" }}>
            {/* Header */}
            <button
              type="button"
              onClick={() => setExpanded(isExpanded ? null : round.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 18px",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {isExpanded ? <ChevronDown size={18} color="var(--text-muted)" /> : <ChevronRight size={18} color="var(--text-muted)" />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                  Rodada #{round.number}{round.title ? ` · ${round.title}` : ""} · T{round.season}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {round.submissionCount} inscrições · {PHASE_LABELS[round.phase]}
                </div>
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 9px",
                borderRadius: 100,
                background: round.phase === "RESULT" ? "#d1fae5" : round.phase === "RANKING" ? "#fef3c7" : round.phase === "LISTENING" ? "#ede9fe" : "var(--accent-tint)",
                color: round.phase === "RESULT" ? "#065f46" : round.phase === "RANKING" ? "#92400e" : round.phase === "LISTENING" ? "#5b21b6" : "var(--accent)",
              }}>
                {PHASE_LABELS[round.phase]}
              </span>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div style={{ padding: "0 18px 18px", borderTop: "1px solid var(--divider)", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ height: 14 }} />

                {/* Phase actions */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {PHASE_NEXT[round.phase] && (
                    <button
                      type="button"
                      onClick={() => handleAdvancePhase(round.id)}
                      disabled={!!busy}
                      style={{ ...btnStyle(true), display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <ChevronRight size={14} />
                      {busy ? "Avançando…" : PHASE_NEXT[round.phase]}
                    </button>
                  )}
                  {(round.phase === "LISTENING" || round.phase === "RANKING" || round.phase === "RESULT") && !round.spotifyPlaylistId && (
                    <button
                      type="button"
                      onClick={() => handleCreatePlaylist(round.id)}
                      disabled={!!busy}
                      style={{ ...btnStyle(), display: "flex", alignItems: "center", gap: 6, background: "#1ed760", color: "white" }}
                    >
                      <RefreshCw size={14} />
                      {busyId === round.id + "-playlist" ? "Criando…" : "Criar playlist Spotify"}
                    </button>
                  )}
                  {round.spotifyPlaylistId && (
                    <a
                      href={`https://open.spotify.com/playlist/${round.spotifyPlaylistId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ ...btnStyle(), display: "flex", alignItems: "center", gap: 6, textDecoration: "none", background: "#1ed760", color: "white" }}
                    >
                      <ExternalLink size={14} />
                      Ver playlist
                    </a>
                  )}
                </div>

                {/* Flash message */}
                {msg?.id === round.id && (
                  <div style={{ fontSize: 13, color: msg.ok ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                    {msg.text}
                  </div>
                )}

                {/* Date editors */}
                <EditDatesForm round={round} onSave={(updates) => handleUpdateDates(round, updates)} busy={busyId === round.id + "-update"} />

                {/* Spotify playlist ID */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>ID da Playlist Spotify (manual)</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      defaultValue={round.spotifyPlaylistId ?? ""}
                      id={`playlist-${round.id}`}
                      placeholder="Ex: 37i9dQZF1DXcBWIGoYBM5M"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = (document.getElementById(`playlist-${round.id}`) as HTMLInputElement).value.trim();
                        handleUpdateDates(round, { spotifyPlaylistId: val || "" });
                      }}
                      style={btnStyle()}
                    >
                      Salvar
                    </button>
                  </div>
                </div>

                {/* Delete */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => handleDelete(round.id)}
                    disabled={!!busy}
                    style={{ ...btnStyle(), display: "flex", alignItems: "center", gap: 6, color: "var(--accent)" }}
                  >
                    <Trash2 size={14} />
                    Excluir rodada
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EditDatesForm({
  round,
  onSave,
  busy,
}: {
  round: RoundRow;
  onSave: (u: { submissionEndsAt: string; listeningEndsAt: string; rankingEndsAt: string }) => void;
  busy: boolean;
}) {
  const [sub, setSub] = useState(toLocalDatetimeInput(round.submissionEndsAt));
  const [lis, setLis] = useState(toLocalDatetimeInput(round.listeningEndsAt));
  const [rnk, setRnk] = useState(toLocalDatetimeInput(round.rankingEndsAt));

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid var(--divider-strong)",
    background: "var(--surface)",
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Inscrições até</label>
          <input type="datetime-local" value={sub} onChange={(e) => setSub(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Escuta até</label>
          <input type="datetime-local" value={lis} onChange={(e) => setLis(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Avaliação até</label>
          <input type="datetime-local" value={rnk} onChange={(e) => setRnk(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div>
        <button
          type="button"
          onClick={() => onSave({ submissionEndsAt: inputToISO(sub), listeningEndsAt: inputToISO(lis), rankingEndsAt: inputToISO(rnk) })}
          disabled={busy}
          style={{ padding: "8px 14px", borderRadius: 8, border: "none", fontWeight: 600, fontSize: 13, cursor: busy ? "not-allowed" : "pointer", background: "var(--fill-inset)", color: "var(--text)" }}
        >
          {busy ? "Salvando…" : "Atualizar datas"}
        </button>
      </div>
    </div>
  );
}

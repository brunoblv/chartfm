"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { RoundRow } from "./push-admin-types";
import { PHASE_COLORS, formatShort, toLocalDatetimeInput, inputToISO, isListenAndRankPhase } from "./push-admin-helpers";

export function StageTimeline({ round }: { round: RoundRow }) {
  const currentIdx =
    round.phase === "SUBMISSION" ? 0
    : isListenAndRankPhase(round.phase) ? 2
    : 3;

  const stages = [
    { name: "Inscrição", start: formatShort(round.createdAt), end: formatShort(round.submissionEndsAt) },
    { name: "Revelação", start: formatShort(round.submissionEndsAt), end: formatShort(round.listeningEndsAt) },
    { name: "Escuta & Avaliação", start: formatShort(round.listeningEndsAt), end: formatShort(round.rankingEndsAt) },
    { name: "Resultado", start: formatShort(round.rankingEndsAt), end: "—" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {stages.map((s, i) => {
        const status = i < currentIdx ? "done" : i === currentIdx ? "active" : "pending";
        const dotColor = status === "done" ? "#10b981" : status === "active" ? "var(--accent)" : "var(--divider-strong)";
        const isActive = status === "active";
        return (
          <div key={s.name} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 11,
            background: isActive ? "var(--accent)0C" : "var(--fill-inset)",
            border: `1.5px solid ${isActive ? "var(--accent)30" : "var(--divider)"}`,
          }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: status === "pending" ? "var(--text-muted)" : "var(--text)" }}>{s.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                {status !== "pending" ? `${s.start} → ${s.end}` : "Aguardando etapa anterior"}
              </div>
            </div>
            {status === "done" && (
              <div style={{ display: "flex", alignItems: "center", gap: 3, color: "#10b981", fontSize: 11, fontWeight: 600 }}>
                <Check size={10} /> Concluída
              </div>
            )}
            {status === "active" && (
              <div style={{ padding: "3px 9px", borderRadius: 100, background: "var(--accent)1A", color: "var(--accent)", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                Em andamento
              </div>
            )}
            {status === "pending" && (
              <div style={{ color: "var(--divider-strong)", fontSize: 11, whiteSpace: "nowrap" }}>Pendente</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DurationControls({
  durations,
  onChange,
}: {
  durations: { sub: number; listenVote: number };
  onChange: (d: { sub: number; listenVote: number }) => void;
}) {
  const fields: { key: keyof typeof durations; label: string }[] = [
    { key: "sub", label: "Inscrição" },
    { key: "listenVote", label: "Escuta & Avaliação" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {fields.map(({ key, label }) => (
        <div key={key} style={{ background: "var(--fill-inset)", borderRadius: 12, padding: "13px 15px", border: "1px solid var(--divider)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: ".04em", textTransform: "uppercase" as const }}>
              {label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)", letterSpacing: "-.03em" }}>{durations[key]}h</div>
          </div>
          <input type="range" min={1} max={168} value={durations[key]}
            onChange={(e) => onChange({ ...durations, [key]: Number(e.target.value) })}
            style={{ width: "100%", accentColor: "var(--accent)" }}
          />
        </div>
      ))}
    </div>
  );
}

export function CreateRoundForm({
  durations,
  onCreated,
  onCancel,
}: {
  durations: { sub: number; listenVote: number };
  onCreated: (round: RoundRow) => void;
  onCancel: () => void;
}) {
  const now = new Date();
  const addHours = (h: number) => {
    const d = new Date(now.getTime() + h * 3600000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [form, setForm] = useState({
    season: 1,
    submissionEndsAt: addHours(durations.sub),
    listeningEndsAt: addHours(durations.sub),
    listenVoteEndsAt: addHours(durations.sub + durations.listenVote),
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy]   = useState(false);

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: "1px solid var(--divider-strong)", background: "var(--surface)",
    color: "var(--text)", fontSize: 13, outline: "none",
    boxSizing: "border-box", fontFamily: "inherit",
  };

  async function handleCreate() {
    if (!form.submissionEndsAt || !form.listeningEndsAt || !form.listenVoteEndsAt) {
      setError("Preencha todas as datas");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          season: form.season,
          submissionEndsAt: inputToISO(form.submissionEndsAt),
          listeningEndsAt: inputToISO(form.listeningEndsAt),
          rankingEndsAt: inputToISO(form.listenVoteEndsAt),
        }),
      });
      const data = (await res.json()) as RoundRow & { error?: string };
      if (!res.ok) { setError(data.error ?? "Erro"); return; }
      onCreated({ ...data, submissionCount: 0 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      padding: "18px 20px", borderRadius: 14, background: "var(--surface)",
      border: "1px solid var(--divider)", display: "flex", flexDirection: "column", gap: 12, marginBottom: 20,
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Nova rodada</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -4 }}>
        O título será gerado automaticamente: Push - Temporada N - Rodada N
      </div>
      <div style={{ maxWidth: 120 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Temporada</label>
        <input type="number" value={form.season}
          onChange={(e) => setForm((f) => ({ ...f, season: Number(e.target.value) }))}
          min={1} style={inputStyle} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Inscrições até</label>
          <input type="datetime-local" value={form.submissionEndsAt}
            onChange={(e) => setForm((f) => ({ ...f, submissionEndsAt: e.target.value }))} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Escuta começa</label>
          <input type="datetime-local" value={form.listeningEndsAt}
            onChange={(e) => setForm((f) => ({ ...f, listeningEndsAt: e.target.value }))} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Escuta & Avaliação até</label>
          <input type="datetime-local" value={form.listenVoteEndsAt}
            onChange={(e) => setForm((f) => ({ ...f, listenVoteEndsAt: e.target.value }))} style={inputStyle} />
        </div>
      </div>
      {error && <div style={{ color: "var(--accent)", fontSize: 13 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={handleCreate} disabled={busy}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13, cursor: busy ? "not-allowed" : "pointer", background: "var(--accent)", color: "white", fontFamily: "inherit" }}>
          {busy ? "Criando…" : "Criar rodada"}
        </button>
        <button type="button" onClick={onCancel}
          style={{ padding: "8px 14px", borderRadius: 8, border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer", background: "var(--fill-inset)", color: "var(--text)", fontFamily: "inherit" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// Re-export for convenience
export { PHASE_COLORS };

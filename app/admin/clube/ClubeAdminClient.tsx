"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClubeAdminRound } from "@/lib/clube-album";
import {
  CLUBE_SCHEDULE_RULES,
  buildScheduleFromWednesday,
  parseDateInput,
  schedulePreview,
  suggestNextWednesday,
  toDateInputValue,
} from "@/lib/clube-schedule";

const PHASE_LABELS: Record<string, string> = {
  NOMINATIONS: "Inscrições",
  POLL: "Enquete",
  RESULT: "Resultado",
  LISTENING: "Escuta",
  COMPLETED: "Concluída",
};

function formatIso(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ClubeAdminClient({
  initialActive,
  initialCompleted,
}: {
  initialActive: ClubeAdminRound | null;
  initialCompleted: ClubeAdminRound[];
}) {
  const router = useRouter();
  const [active, setActive] = useState(initialActive);
  const [completed, setCompleted] = useState(initialCompleted);
  const [theme, setTheme] = useState(initialActive?.theme ?? "");
  const [wednesdayDate, setWednesdayDate] = useState(
    initialActive
      ? toDateInputValue(new Date(initialActive.nominationsOpenAt))
      : toDateInputValue(suggestNextWednesday()),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const preview = useMemo(() => {
    const wednesday = parseDateInput(wednesdayDate);
    if (!wednesday) return null;
    const schedule = buildScheduleFromWednesday(wednesday);
    return { dateRange: schedule.dateRange, rows: schedulePreview(schedule) };
  }, [wednesdayDate]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/clube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, wednesdayDate }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar rodada");
        return;
      }
      setSuccess("Rodada criada com sucesso!");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/clube/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, wednesdayDate }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar");
        return;
      }
      setSuccess("Rodada atualizada!");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    if (!active || !confirm("Encerrar a rodada atual?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clube/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Erro ao encerrar");
        return;
      }
      setSuccess("Rodada encerrada.");
      setActive(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    setActive(initialActive);
    setCompleted(initialCompleted);
    if (initialActive) {
      setTheme(initialActive.theme);
      setWednesdayDate(toDateInputValue(new Date(initialActive.nominationsOpenAt)));
    }
  }, [initialActive, initialCompleted]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 720 }}>
      {/* Regras de horário */}
      <section style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 16, padding: "20px 22px" }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 14px", color: "var(--text)" }}>Horários pré-definidos</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {CLUBE_SCHEDULE_RULES.map((rule) => (
            <div key={rule.phase} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 13 }}>
              <span style={{ flexShrink: 0, width: 52, fontWeight: 700, color: "var(--accent)", fontSize: 12 }}>Fase {rule.phase}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "var(--text)" }}>{rule.label}</div>
                <div style={{ color: "var(--text-muted)", marginTop: 2, lineHeight: 1.45 }}>{rule.desc}</div>
              </div>
              <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: "var(--text-subtle)", whiteSpace: "nowrap" }}>{rule.when}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Rodada ativa */}
      {active && (
        <section style={{ background: "var(--accent-tint)", border: "1px solid rgba(250,36,60,0.2)", borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 4 }}>
                Rodada ativa · #{active.number}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>{active.theme}</div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, background: "var(--surface)", padding: "6px 12px", borderRadius: 100, border: "1px solid var(--divider)" }}>
              {PHASE_LABELS[active.phase] ?? active.phase}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
            <div>Inscrições: {formatIso(active.nominationsOpenAt)} → {formatIso(active.nominationsCloseAt)}</div>
            <div>Enquete até: {formatIso(active.pollCloseAt)}</div>
            <div>Escuta até: {active.listeningCloseAt ? formatIso(active.listeningCloseAt) : "—"}</div>
            <div>{active.nominationCount} indicações · {active.voteCount} votos</div>
          </div>

          <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              Tema da semana
              <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="Ex.: Rap Clássico dos Anos 90"
                style={inputStyle}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              Quarta-feira de início
              <input type="date" value={wednesdayDate} onChange={(e) => setWednesdayDate(e.target.value)} style={inputStyle} />
              <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)" }}>
                Deve ser uma quarta-feira. Os horários das fases são calculados automaticamente.
              </span>
            </label>
            {preview && (
              <div style={{ background: "var(--surface)", borderRadius: 12, padding: "12px 14px", border: "1px solid var(--divider)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Prévia · {preview.dateRange}
                </div>
                {preview.rows.map((row) => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, padding: "4px 0", color: "var(--text-subtle)" }}>
                    <span>{row.label}</span>
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>{row.at}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="submit" disabled={saving} style={primaryBtnStyle}>
                {saving ? "Salvando…" : "Salvar alterações"}
              </button>
              <button type="button" onClick={handleComplete} disabled={saving} style={dangerBtnStyle}>
                Encerrar rodada
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Nova rodada */}
      {!active && (
        <section style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 16, padding: "20px 22px" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px", color: "var(--text)" }}>Nova rodada</h2>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              Tema da semana
              <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="Ex.: Jazz Fusion"
                required
                style={inputStyle}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              Quarta-feira de início
              <input type="date" value={wednesdayDate} onChange={(e) => setWednesdayDate(e.target.value)} required style={inputStyle} />
            </label>
            {preview && (
              <div style={{ background: "var(--fill-inset)", borderRadius: 12, padding: "12px 14px", border: "1px solid var(--divider)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Cronograma · {preview.dateRange}
                </div>
                {preview.rows.map((row) => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, padding: "4px 0" }}>
                    <span style={{ color: "var(--text-muted)" }}>{row.label}</span>
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>{row.at}</span>
                  </div>
                ))}
              </div>
            )}
            <button type="submit" disabled={saving} style={{ ...primaryBtnStyle, alignSelf: "flex-start" }}>
              {saving ? "Criando…" : "Publicar rodada"}
            </button>
          </form>
        </section>
      )}

      {error && <div style={{ color: "#C5291C", fontSize: 13, fontWeight: 600 }}>{error}</div>}
      {success && <div style={{ color: "#1B873F", fontSize: 13, fontWeight: 600 }}>{success}</div>}

      {/* Histórico admin */}
      {completed.length > 0 && (
        <section>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px", color: "var(--text)" }}>Rodadas concluídas</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {completed.map((r) => (
              <div key={r.id} style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>#{r.number} · {r.theme}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{r.dateRange}</div>
                </div>
                <span style={{ fontSize: 11, color: "var(--text-disabled)" }}>{r.nominationCount} indicações</span>
              </div>
            ))}
          </div>
        </section>
      )}
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

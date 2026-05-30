"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AlbumClubPhase } from "@prisma/client";
import type { ClubeAdminPollPreview, ClubeAdminRound } from "@/lib/clube-album";
import {
  CLUBE_SCHEDULE_RULES,
  buildScheduleFromWednesday,
  parseDateInput,
  schedulePreview,
  suggestNextWednesday,
  toDateInputValue,
  toDateTimeLocalValue,
} from "@/lib/clube-schedule";

const PHASE_LABELS: Record<string, string> = {
  NOMINATIONS: "Inscrições",
  POLL: "Enquete",
  RESULT: "Resultado",
  LISTENING: "Escuta",
  COMPLETED: "Concluída",
};

type ScheduleForm = {
  nominationsOpenAt: string;
  nominationsCloseAt: string;
  pollCloseAt: string;
  resultCloseAt: string;
  listeningCloseAt: string;
};

function scheduleFromRound(r: ClubeAdminRound): ScheduleForm {
  return {
    nominationsOpenAt: toDateTimeLocalValue(new Date(r.nominationsOpenAt)),
    nominationsCloseAt: toDateTimeLocalValue(new Date(r.nominationsCloseAt)),
    pollCloseAt: toDateTimeLocalValue(new Date(r.pollCloseAt)),
    resultCloseAt: toDateTimeLocalValue(new Date(r.resultCloseAt ?? r.pollCloseAt)),
    listeningCloseAt: toDateTimeLocalValue(new Date(r.listeningCloseAt ?? r.pollCloseAt)),
  };
}

function scheduleFromTemplate(wednesdayDate: string): ScheduleForm | null {
  const wednesday = parseDateInput(wednesdayDate);
  if (!wednesday) return null;
  const s = buildScheduleFromWednesday(wednesday);
  return {
    nominationsOpenAt: toDateTimeLocalValue(s.nominationsOpenAt),
    nominationsCloseAt: toDateTimeLocalValue(s.nominationsCloseAt),
    pollCloseAt: toDateTimeLocalValue(s.pollCloseAt),
    resultCloseAt: toDateTimeLocalValue(s.resultCloseAt),
    listeningCloseAt: toDateTimeLocalValue(s.listeningCloseAt),
  };
}

function ScheduleFields({
  schedule,
  onChange,
}: {
  schedule: ScheduleForm;
  onChange: (next: ScheduleForm) => void;
}) {
  const fields: { key: keyof ScheduleForm; label: string; hint: string }[] = [
    { key: "nominationsOpenAt", label: "Inscrições abrem", hint: "Fase 1 — início" },
    { key: "nominationsCloseAt", label: "Inscrições fecham", hint: "Fase 1 → 2" },
    { key: "pollCloseAt", label: "Enquete fecha", hint: "Fase 2 → 3" },
    { key: "resultCloseAt", label: "Resultado publicado", hint: "Fase 3 → 4" },
    { key: "listeningCloseAt", label: "Escuta encerra", hint: "Fase 4 · revelação" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {fields.map(({ key, label, hint }) => (
        <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
          <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            {label}
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)" }}>{hint}</span>
          </span>
          <input
            type="datetime-local"
            value={schedule[key]}
            onChange={(e) => onChange({ ...schedule, [key]: e.target.value })}
            style={inputStyle}
          />
        </label>
      ))}
    </div>
  );
}

function PollPreviewSection({
  phase,
  preview,
}: {
  phase: AlbumClubPhase;
  preview: ClubeAdminPollPreview;
}) {
  const [showVoters, setShowVoters] = useState(true);
  const maxVotes = Math.max(1, ...preview.entries.map((e) => e.votes));
  const pollOpen = phase === "POLL" || phase === "RESULT" || phase === "LISTENING";
  const topTwo = preview.entries.filter((e) => e.rank <= 2 && e.votes > 0);

  return (
    <div style={{ background: "var(--surface)", borderRadius: 12, padding: "16px", border: "1px solid var(--divider)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Prévia da votação</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {preview.voterCount} votante{preview.voterCount !== 1 ? "s" : ""} · {preview.totalVotes} voto{preview.totalVotes !== 1 ? "s" : ""}
        </div>
      </div>

      {!pollOpen && preview.totalVotes === 0 && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.45 }}>
          A enquete ainda não abriu. Os votos aparecerão aqui assim que a fase 2 começar.
        </div>
      )}

      {pollOpen && topTwo.length > 0 && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.45 }}>
          Top 2 projetado{topTwo.length > 1 ? "s" : ""}:{" "}
          {topTwo.map((e, i) => (
            <span key={e.nominationId}>
              {i > 0 && " · "}
              <strong style={{ color: "var(--text)" }}>{e.title}</strong> ({e.votes})
            </span>
          ))}
        </div>
      )}

      {preview.entries.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Nenhuma indicação ainda.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto" }}>
          {preview.entries.map((entry) => {
            const isTop = entry.rank <= 2 && entry.votes > 0 && pollOpen;
            return (
              <div
                key={entry.nominationId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: isTop ? "1px solid rgba(250,36,60,0.25)" : "1px solid var(--divider)",
                  background: isTop ? "var(--accent-tint)" : "var(--fill-inset)",
                }}
              >
                <span style={{ width: 22, flexShrink: 0, fontSize: 11, fontWeight: 800, color: isTop ? "var(--accent)" : "var(--text-muted)", textAlign: "center" }}>
                  {entry.rank}
                </span>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    flexShrink: 0,
                    borderRadius: 8,
                    overflow: "hidden",
                    background: "var(--divider)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 14,
                    fontWeight: 800,
                    color: "white",
                  }}
                >
                  {entry.coverUrl ? (
                    <img src={entry.coverUrl} alt={entry.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    entry.title[0]?.toUpperCase()
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.title}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                    {entry.artist} · @{entry.nominatedBy}
                  </div>
                  <div style={{ marginTop: 6, height: 4, borderRadius: 100, background: "var(--divider)", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${(entry.votes / maxVotes) * 100}%`,
                        background: isTop ? "var(--accent)" : "var(--text-subtle)",
                        borderRadius: 100,
                        transition: "width 0.2s",
                      }}
                    />
                  </div>
                </div>
                <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 800, color: "var(--text)", fontVariantNumeric: "tabular-nums", minWidth: 28, textAlign: "right" }}>
                  {entry.votes}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {preview.voters.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--divider)" }}>
          <button
            type="button"
            onClick={() => setShowVoters((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: 0,
              border: "none",
              background: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              marginBottom: showVoters ? 12 : 0,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
              Votantes ({preview.voters.length})
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>
              {showVoters ? "Ocultar" : "Mostrar"}
            </span>
          </button>

          {showVoters && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 480, overflowY: "auto" }}>
              {preview.voters.map((voter) => (
                <div
                  key={voter.userId}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--divider)",
                    background: "var(--fill-inset)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>@{voter.handle}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {voter.selections.length} álbum{voter.selections.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <ul style={{ margin: 0, padding: "0 0 0 16px", display: "flex", flexDirection: "column", gap: 4 }}>
                    {voter.selections.map((sel) => (
                      <li key={sel.nominationId} style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                        <strong style={{ color: "var(--text)", fontWeight: 600 }}>{sel.title}</strong>
                        {" · "}
                        {sel.artist}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ClubeAdminClient({
  initialActive,
  initialCompleted,
  initialPollPreview,
}: {
  initialActive: ClubeAdminRound | null;
  initialCompleted: ClubeAdminRound[];
  initialPollPreview: ClubeAdminPollPreview | null;
}) {
  const router = useRouter();
  const [active, setActive] = useState(initialActive);
  const [completed, setCompleted] = useState(initialCompleted);
  const [pollPreview, setPollPreview] = useState(initialPollPreview);
  const [theme, setTheme] = useState(initialActive?.theme ?? "");
  const [wednesdayDate, setWednesdayDate] = useState(
    initialActive
      ? toDateInputValue(new Date(initialActive.nominationsOpenAt))
      : toDateInputValue(suggestNextWednesday()),
  );
  const [schedule, setSchedule] = useState<ScheduleForm>(() =>
    initialActive ? scheduleFromRound(initialActive) : scheduleFromTemplate(toDateInputValue(suggestNextWednesday()))!,
  );
  const [phaseOverride, setPhaseOverride] = useState<AlbumClubPhase | "AUTO">("AUTO");
  const [useCustomSchedule, setUseCustomSchedule] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const preview = useMemo(() => {
    const wednesday = parseDateInput(wednesdayDate);
    if (!wednesday) return null;
    const s = buildScheduleFromWednesday(wednesday);
    return { dateRange: s.dateRange, rows: schedulePreview(s) };
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
        body: JSON.stringify({
          theme,
          wednesdayDate: useCustomSchedule ? undefined : wednesdayDate,
          schedule: useCustomSchedule ? schedule : undefined,
        }),
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
        body: JSON.stringify({ theme, schedule, phase: phaseOverride }),
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

  async function handleApplyTemplate() {
    if (!active) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/clube/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applyWednesdayTemplate: true, wednesdayDate }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Erro ao aplicar template");
        return;
      }
      setSuccess("Cronograma padrão aplicado!");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleOpenPollNow() {
    if (!active || !confirm("Abrir a enquete agora? Inscrições serão encerradas imediatamente.")) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/clube/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "openPollNow" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Erro ao abrir enquete");
        return;
      }
      setSuccess("Enquete aberta!");
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
    setPollPreview(initialPollPreview);
    if (initialActive) {
      setTheme(initialActive.theme);
      setWednesdayDate(toDateInputValue(new Date(initialActive.nominationsOpenAt)));
      setSchedule(scheduleFromRound(initialActive));
      setPhaseOverride("AUTO");
    }
  }, [initialActive, initialCompleted, initialPollPreview]);

  useEffect(() => {
    if (!useCustomSchedule && !active) {
      const next = scheduleFromTemplate(wednesdayDate);
      if (next) setSchedule(next);
    }
  }, [wednesdayDate, useCustomSchedule, active]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 720 }}>
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
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 14, marginBottom: 0, lineHeight: 1.5 }}>
          Você pode ajustar cada marco manualmente na rodada ativa — útil para abrir a enquete fora do cronograma padrão.
        </p>
      </section>

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
            <div>{active.nominationCount} indicações · {active.voteCount} votos</div>
            <div>Período: {active.dateRange}</div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
            <button type="button" onClick={handleOpenPollNow} disabled={saving || active.phase === "POLL"} style={secondaryBtnStyle}>
              Abrir enquete agora
            </button>
          </div>

          {pollPreview && <PollPreviewSection phase={active.phase} preview={pollPreview} />}

          <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 20 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              Tema da semana
              <input type="text" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Ex.: Rap Clássico dos Anos 90" style={inputStyle} />
            </label>

            <div style={{ background: "var(--surface)", borderRadius: 12, padding: "16px", border: "1px solid var(--divider)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>Datas de cada fase</div>
              <ScheduleFields schedule={schedule} onChange={setSchedule} />
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              Fase atual
              <select
                value={phaseOverride}
                onChange={(e) => setPhaseOverride(e.target.value as AlbumClubPhase | "AUTO")}
                style={inputStyle}
              >
                <option value="AUTO">Automática (calculada pelas datas)</option>
                <option value="NOMINATIONS">1 — Inscrições</option>
                <option value="POLL">2 — Enquete</option>
                <option value="RESULT">3 — Resultado</option>
                <option value="LISTENING">4 — Escuta</option>
              </select>
              <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)" }}>
                Use &quot;Enquete&quot; para forçar a votação mesmo que as datas ainda não tenham passado.
              </span>
            </label>

            <div style={{ background: "var(--surface)", borderRadius: 12, padding: "14px 16px", border: "1px solid var(--divider)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Aplicar cronograma padrão (quarta)
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                <label style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600 }}>
                  Quarta-feira de referência
                  <input type="date" value={wednesdayDate} onChange={(e) => setWednesdayDate(e.target.value)} style={inputStyle} />
                </label>
                <button type="button" onClick={handleApplyTemplate} disabled={saving} style={secondaryBtnStyle}>
                  Aplicar template
                </button>
              </div>
              {preview && (
                <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-muted)" }}>
                  Prévia: {preview.dateRange}
                  {preview.rows.map((row) => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 8, paddingTop: 4 }}>
                      <span>{row.label}</span>
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>{row.at}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

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

      {!active && (
        <section style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 16, padding: "20px 22px" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px", color: "var(--text)" }}>Nova rodada</h2>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              Tema da semana
              <input type="text" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Ex.: Jazz Fusion" required style={inputStyle} />
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--text)", cursor: "pointer" }}>
              <input type="checkbox" checked={useCustomSchedule} onChange={(e) => setUseCustomSchedule(e.target.checked)} />
              Usar datas personalizadas
            </label>

            {useCustomSchedule ? (
              <div style={{ background: "var(--fill-inset)", borderRadius: 12, padding: "16px", border: "1px solid var(--divider)" }}>
                <ScheduleFields schedule={schedule} onChange={setSchedule} />
              </div>
            ) : (
              <>
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
              </>
            )}

            <button type="submit" disabled={saving} style={{ ...primaryBtnStyle, alignSelf: "flex-start" }}>
              {saving ? "Criando…" : "Publicar rodada"}
            </button>
          </form>
        </section>
      )}

      {error && <div style={{ color: "#C5291C", fontSize: 13, fontWeight: 600 }}>{error}</div>}
      {success && <div style={{ color: "#1B873F", fontSize: 13, fontWeight: 600 }}>{success}</div>}

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

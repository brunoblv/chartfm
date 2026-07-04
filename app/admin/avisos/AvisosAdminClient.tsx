"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type {
  AnnouncementContext,
  AnnouncementTemplateId,
  AnnouncementTemplateMeta,
} from "@/lib/admin-announcement-templates";

type ScheduledRow = {
  id: string;
  label: string | null;
  text: string;
  targetUrl: string | null;
  status: string;
  scheduleMode: string;
  scheduledAt: string | null;
  intervalHours: number | null;
  nextRunAt: string | null;
  lastSentAt: string | null;
  runCount: number;
  maxRuns: number | null;
  createdAt: string;
};

type FeedRow = {
  id: string;
  kind: string;
  text: string;
  targetUrl: string | null;
  createdAt: string;
};

type ApiData = {
  templates: AnnouncementTemplateMeta[];
  context: AnnouncementContext;
  scheduled: ScheduledRow[];
  recentFeed: FeedRow[];
};

const CATEGORY_LABEL: Record<string, string> = {
  global: "Rankings globais",
  push: "Push",
  copa: "Copa ChartFM",
  clube: "Clube do Álbum",
  custom: "Personalizado",
};

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function defaultScheduledAtLocal() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AvisosAdminClient() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [templateId, setTemplateId] = useState<AnnouncementTemplateId>("global_100");
  const [contextKey, setContextKey] = useState("");
  const [text, setText] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [label, setLabel] = useState("");
  const [delivery, setDelivery] = useState<"now" | "scheduled">("now");
  const [scheduleMode, setScheduleMode] = useState<"once" | "recurring">("once");
  const [scheduledAt, setScheduledAt] = useState(defaultScheduledAtLocal);
  const [intervalHours, setIntervalHours] = useState(6);
  const [maxRuns, setMaxRuns] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/avisos");
      if (!res.ok) throw new Error("Falha ao carregar");
      const json = (await res.json()) as ApiData;
      setData(json);
    } catch {
      setError("Não foi possível carregar os dados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const template = useMemo(
    () => data?.templates.find((t) => t.id === templateId),
    [data, templateId],
  );

  const contextOptions = useMemo(() => {
    if (!data || !template?.needsContext) return [];
    if (template.needsContext === "push") {
      return data.context.pushRounds.map((r) => ({
        value: r.id,
        label: `${r.label} · ${r.phaseLabel}`,
      }));
    }
    if (template.needsContext === "copa") {
      return data.context.copas.map((c) => ({
        value: c.id,
        label: `${c.name} · ${c.statusLabel}${c.incompleteSinglesCount ? ` · ${c.incompleteSinglesCount} incompletos` : ""}`,
      }));
    }
    return data.context.clubeRounds.map((r) => ({
      value: r.id,
      label: `${r.label} · ${r.phaseLabel}`,
    }));
  }, [data, template]);

  useEffect(() => {
    if (!contextOptions.length) {
      setContextKey("");
      return;
    }
    if (!contextOptions.some((o) => o.value === contextKey)) {
      setContextKey(contextOptions[0].value);
    }
  }, [contextOptions, contextKey]);

  useEffect(() => {
    if (!data) return;
    if (templateId === "custom") return;

    const globals = data.context.globals;
    const preset: Record<string, { text: string; url: string }> = {
      global_100: {
        text: `A Parada Global (${globals.weekLabel}) foi publicada! Confira os results.`,
        url: "/global/100",
      },
      global_airplay: {
        text: `O Global 100 Air Play (${globals.weekLabel}) foi publicado! Veja o top de reproduções da semana.`,
        url: "/global/airplay",
      },
      global_albums: {
        text: `O Global Álbuns (${globals.weekLabel}) foi publicado! Descubra os álbuns mais ouvidos da semana.`,
        url: "/global/albums",
      },
    };

    const p = preset[templateId];
    if (p) {
      setText(p.text.replace("results", "resultados"));
      setTargetUrl(p.url);
      return;
    }

    const push = data.context.pushRounds.find((r) => r.id === contextKey);
    const copa = data.context.copas.find((c) => c.id === contextKey);
    const clube = data.context.clubeRounds.find((r) => r.id === contextKey);

    const pushName = push?.label ?? "Push";
    const copaName = copa?.name ?? "Copa";
    const clubeName = clube ? `Clube do Álbum #${clube.number} (${clube.theme})` : "Clube do Álbum";

    const map: Partial<Record<AnnouncementTemplateId, { text: string; url: string }>> = {
      push_registration: { text: `O ${pushName} abriu as inscrições! Indique sua música e participe.`, url: "/push" },
      push_listening: {
        text: `O ${pushName} entrou na fase de escuta e avaliação! Ouça as indicações e avalie.`,
        url: "/push",
      },
      push_result: { text: `O ${pushName} chegou ao resultado! Confira o ranking final.`, url: "/push" },
      copa_registration: { text: `A ${copaName} abriu as inscrições! Monte seu time e participe.`, url: "/copa" },
      copa_group_stage: {
        text: `A ${copaName} iniciou a fase de grupos! Acompanhe os jogos ao vivo.`,
        url: "/copa",
      },
      copa_knockout: { text: `A ${copaName} entrou no mata-mata! Vote nos confrontos decisivos.`, url: "/copa" },
      copa_vote: { text: `Jogos da ${copaName} estão abertos para votação! Entre e vote agora.`, url: "/copa" },
      copa_incomplete_singles: {
        text: `Faltam músicas no seu time da ${copaName}! Acesse Meu Time e complete as 8 músicas de cada artista.`,
        url: "/copa/meu-time",
      },
      clube_registration: { text: `O ${clubeName} abriu as inscrições! Indique seus álbuns.`, url: "/criticsfm" },
      clube_poll: { text: `${clubeName}: a enquete está aberta! Vote nos álbuns indicados.`, url: "/criticsfm" },
      clube_listening: {
        text: `${clubeName} entrou no período de escuta! Ouça os álbuns escolhidos.`,
        url: "/criticsfm",
      },
      clube_result: {
        text: `${clubeName}: o resultado foi publicado! Confira os escolhidos.`,
        url: "/criticsfm",
      },
    };

    const m = map[templateId];
    if (m) {
      setText(m.text);
      setTargetUrl(m.url);
    }
  }, [templateId, contextKey, data]);

  async function submit() {
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/avisos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          contextKey: contextKey || null,
          text: templateId === "custom" ? text : undefined,
          targetUrl: templateId === "custom" ? targetUrl : undefined,
          label: label.trim() || null,
          delivery,
          scheduleMode,
          scheduledAt: delivery === "scheduled" && scheduleMode === "once" ? new Date(scheduledAt).toISOString() : undefined,
          intervalHours: delivery === "scheduled" && scheduleMode === "recurring" ? intervalHours : undefined,
          maxRuns: maxRuns ? Number(maxRuns) : null,
        }),
      });
      const json = (await res.json()) as { error?: string; recipients?: number; delivery?: string; message?: string; targeted?: boolean };
      if (!res.ok) {
        setError(json.error ?? "Não foi possível enviar.");
        return;
      }
      if (json.delivery === "now") {
        if (json.message) {
          setMessage(json.message);
        } else if (json.targeted) {
          setMessage(`Aviso direcionado enviado para ${json.recipients ?? 0} participante(s) (só no sino).`);
        } else {
          setMessage(`Aviso enviado para ${json.recipients ?? 0} usuários (timeline + sino).`);
        }
      } else {
        setMessage("Aviso agendado com sucesso.");
      }
      await load();
    } catch {
      setError("Erro de conexão.");
    } finally {
      setSubmitting(false);
    }
  }

  async function patchRow(id: string, body: Record<string, string>) {
    const res = await fetch(`/api/admin/avisos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setError(json.error ?? "Ação falhou.");
      return;
    }
    setMessage(body.action === "send_now" ? "Aviso enviado agora." : "Atualizado.");
    await load();
  }

  async function deleteRow(id: string) {
    if (!confirm("Excluir este aviso agendado?")) return;
    await fetch(`/api/admin/avisos/${id}`, { method: "DELETE" });
    await load();
  }

  if (loading && !data) {
    return <p style={{ color: "var(--text-muted)", marginTop: 16 }}>Carregando…</p>;
  }

  const groupedTemplates = (data?.templates ?? []).reduce<Record<string, AnnouncementTemplateMeta[]>>((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div style={{ marginTop: 20, display: "grid", gap: 28 }}>
      <section style={cardStyle}>
        <h2 style={sectionTitle}>Novo aviso</h2>
        <p style={hintStyle}>
          Cada aviso aparece no feed da home (ChartFM) e no sino de notificações de todos os usuários.
        </p>

        <div style={fieldGrid}>
          <label style={labelStyle}>
            Modelo
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value as AnnouncementTemplateId)}
              style={inputStyle}
            >
              {Object.entries(groupedTemplates).map(([cat, items]) => (
                <optgroup key={cat} label={CATEGORY_LABEL[cat] ?? cat}>
                  {items.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {template && <span style={hintStyle}>{template.description}</span>}
            {template?.targeted && (
              <span style={{ ...hintStyle, color: "#C5291C" }}>
                Aviso direcionado — só quem está incompleto recebe no sino (não aparece no feed global).
                {templateId === "copa_incomplete_singles" && contextKey && data && (
                  <>
                    {" "}
                    Destinatários agora:{" "}
                    <strong>
                      {data.context.copas.find((c) => c.id === contextKey)?.incompleteSinglesCount ?? 0}
                    </strong>
                  </>
                )}
              </span>
            )}
          </label>

          {template?.needsContext && (
            <label style={labelStyle}>
              {template.needsContext === "push" ? "Rodada Push" : template.needsContext === "copa" ? "Copa" : "Rodada Clube"}
              <select value={contextKey} onChange={(e) => setContextKey(e.target.value)} style={inputStyle}>
                {contextOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
            Texto do aviso
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              readOnly={templateId !== "custom"}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
            />
          </label>

          <label style={labelStyle}>
            Link (opcional)
            <input
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="/push"
              readOnly={templateId !== "custom"}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Rótulo interno (opcional)
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: lembrete votação sábado" style={inputStyle} />
          </label>
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="button" onClick={() => setDelivery("now")} style={toggleBtn(delivery === "now")}>
            Publicar agora
          </button>
          <button type="button" onClick={() => setDelivery("scheduled")} style={toggleBtn(delivery === "scheduled")}>
            Agendar
          </button>
        </div>

        {delivery === "scheduled" && (
          <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setScheduleMode("once")} style={toggleBtn(scheduleMode === "once", true)}>
                Uma vez
              </button>
              <button type="button" onClick={() => setScheduleMode("recurring")} style={toggleBtn(scheduleMode === "recurring", true)}>
                A cada X horas
              </button>
            </div>

            {scheduleMode === "once" ? (
              <label style={labelStyle}>
                Data e hora
                <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} style={inputStyle} />
              </label>
            ) : (
              <div style={fieldGrid}>
                <label style={labelStyle}>
                  Intervalo (horas)
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={intervalHours}
                    onChange={(e) => setIntervalHours(Number(e.target.value))}
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  Máx. envios (opcional)
                  <input
                    type="number"
                    min={1}
                    value={maxRuns}
                    onChange={(e) => setMaxRuns(e.target.value)}
                    placeholder="Ilimitado"
                    style={inputStyle}
                  />
                </label>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button type="button" onClick={submit} disabled={submitting || !text.trim()} style={primaryBtn(submitting || !text.trim())}>
            {submitting ? "Enviando…" : delivery === "now" ? "Publicar aviso" : "Agendar aviso"}
          </button>
          {message && <span style={{ color: "#0F9D58", fontSize: 13 }}>{message}</span>}
          {error && <span style={{ color: "#C5291C", fontSize: 13 }}>{error}</span>}
        </div>
      </section>

      {data && (
        <>
          <section style={cardStyle}>
            <h2 style={sectionTitle}>Contexto da semana</h2>
            <p style={hintStyle}>
              Semana {data.context.globals.weekLabel} · Global 100{" "}
              {data.context.globals.hasGlobal100 ? "✓ publicado" : "— pendente"} · Air Play{" "}
              {data.context.globals.hasAirplay ? "✓" : "—"} · Álbuns {data.context.globals.hasAlbums ? "✓" : "—"}
            </p>
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitle}>Agendados ({data.scheduled.filter((s) => s.status === "active").length} ativos)</h2>
            {data.scheduled.length === 0 ? (
              <p style={hintStyle}>Nenhum aviso agendado.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {data.scheduled.map((row) => (
                  <div key={row.id} style={rowStyle}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{row.label ?? row.text.slice(0, 60)}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{row.text}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                        {row.scheduleMode === "recurring"
                          ? `A cada ${row.intervalHours}h · ${row.runCount} envios`
                          : "Envio único"}{" "}
                        · Próximo: {formatDateTime(row.nextRunAt)} · Status: {row.status}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                      {row.status === "active" && (
                        <button type="button" style={smallBtn} onClick={() => patchRow(row.id, { action: "send_now" })}>
                          Enviar agora
                        </button>
                      )}
                      {row.status === "active" ? (
                        <button type="button" style={smallBtn} onClick={() => patchRow(row.id, { status: "paused" })}>
                          Pausar
                        </button>
                      ) : row.status === "paused" ? (
                        <button type="button" style={smallBtn} onClick={() => patchRow(row.id, { status: "active" })}>
                          Retomar
                        </button>
                      ) : null}
                      <button type="button" style={{ ...smallBtn, color: "#C5291C" }} onClick={() => deleteRow(row.id)}>
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitle}>Últimos posts no feed (ChartFM)</h2>
            <div style={{ display: "grid", gap: 8 }}>
              {data.recentFeed.map((p) => (
                <div key={p.id} style={{ fontSize: 13, padding: "10px 0", borderBottom: "1px solid var(--divider-soft)" }}>
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{formatDateTime(p.createdAt)} · {p.kind}</span>
                  <div>{p.text}</div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--divider)",
  borderRadius: 16,
  padding: "20px 22px",
};

const sectionTitle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 17,
  fontWeight: 800,
};

const hintStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "var(--text-muted)",
  lineHeight: 1.5,
};

const fieldGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
  marginTop: 16,
};

const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text)",
};

const inputStyle: CSSProperties = {
  border: "1px solid var(--divider-strong)",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  background: "var(--surface)",
  color: "var(--text)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const rowStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid var(--divider-soft)",
  background: "var(--fill-inset)",
};

const toggleBtn = (active: boolean, compact?: boolean): CSSProperties => ({
  border: active ? "1px solid var(--accent)" : "1px solid var(--divider-strong)",
  background: active ? "var(--accent-tint)" : "var(--surface)",
  color: active ? "var(--accent)" : "var(--text)",
  borderRadius: 999,
  padding: compact ? "8px 14px" : "10px 18px",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
});

const primaryBtn = (disabled: boolean): CSSProperties => ({
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  borderRadius: 10,
  padding: "11px 18px",
  fontWeight: 700,
  opacity: disabled ? 0.55 : 1,
  cursor: disabled ? "not-allowed" : "pointer",
});

const smallBtn: CSSProperties = {
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  color: "var(--text)",
};

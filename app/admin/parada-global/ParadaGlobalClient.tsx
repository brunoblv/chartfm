"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { adminInputStyle, adminPanelStyle } from "@/components/admin/admin-styles";
import { getGlobalSnapshotDeadline, getRankingWeekReference, type GlobalPublishSlot } from "@/lib/chart-week";
import type { GlobalAdminAction, GlobalDateKind, GlobalSnapshotDateInfo } from "@/lib/admin-global-ops";

const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MANUAL_PUBLISH_UNLOCK_DELAY_MS = 5 * 60 * 1000;

type WeekOption = { weekIndex: number; weekLabel: string; hasGlobal100: boolean };

type WeekStatus = {
  weekIndex: number;
  weekLabel: string;
  snapshots: {
    global100: boolean;
    airplay: boolean;
    albums: boolean;
    curators: boolean;
    genreCount: number;
  };
  dates: {
    global100: GlobalSnapshotDateInfo;
    airplay: GlobalSnapshotDateInfo;
    albums: GlobalSnapshotDateInfo;
    genres: GlobalSnapshotDateInfo;
  };
  playlists: {
    youtubeGlobal100: string | null;
    youtubeAirplay: string | null;
  };
  editorial: { slug: string; publishedAt: string } | null;
  socialPosts: Array<{ eventType: string; status: string; id: string }>;
};

const DATE_FIELDS: Array<{
  kind: GlobalDateKind;
  label: string;
  hint: string;
}> = [
  {
    kind: "global100",
    label: "Global 100",
    hint: "Rótulo e intervalo exibidos em /global/100.",
  },
  {
    kind: "airplay",
    label: "Global Airplay",
    hint: "Atualiza weekLabel, dateRange e scoringWindow (janela Last.fm no hero).",
  },
  {
    kind: "albums",
    label: "Global Álbuns",
    hint: "Atualiza weekLabel, dateRange e scoringWindow (janela Last.fm no hero).",
  },
  {
    kind: "genres",
    label: "Gêneros",
    hint: "Aplica a mesma data a todos os snapshots de gênero da semana.",
  },
];

function emptyDates(): WeekStatus["dates"] {
  const empty: GlobalSnapshotDateInfo = {
    exists: false,
    weekLabel: null,
    dateRange: null,
    scoringWindow: null,
    weekDate: null,
  };
  return { global100: empty, airplay: empty, albums: empty, genres: empty };
}

function formatBrt(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

const buttonStyle = (disabled: boolean, variant: "primary" | "secondary" = "primary"): CSSProperties => ({
  border: variant === "primary" ? "none" : "1px solid var(--divider-strong)",
  background: variant === "primary" ? "var(--accent)" : "var(--surface)",
  color: variant === "primary" ? "#fff" : "var(--text)",
  borderRadius: 10,
  padding: "9px 12px",
  fontWeight: 700,
  fontSize: 13,
  opacity: disabled ? 0.55 : 1,
  cursor: disabled ? "not-allowed" : "pointer",
  textAlign: "left" as const,
});

const badge = (ok: boolean): CSSProperties => ({
  display: "inline-block",
  fontSize: 11,
  fontWeight: 700,
  padding: "2px 8px",
  borderRadius: 999,
  background: ok ? "rgba(91,209,106,0.15)" : "rgba(224,102,102,0.15)",
  color: ok ? "#5BD16A" : "#e06666",
});

type ActionDef = {
  action: GlobalAdminAction;
  label: string;
  hint: string;
  danger?: boolean;
};

const ACTION_GROUPS: Array<{ title: string; items: ActionDef[] }> = [
  {
    title: "Publicação",
    items: [
      {
        action: "publish",
        label: "Publicar semana (completo)",
        hint: "Cria o que faltar: snapshots, playlists, posts, editorial, notificações e comunidades. Não sobrescreve o que já existe.",
      },
      {
        action: "recalculate",
        label: "Recalcular snapshots",
        hint: "Refaz Global 100, Airplay, Álbuns, Curadores e gêneros (sobrescreve).",
        danger: true,
      },
    ],
  },
  {
    title: "Playlists",
    items: [
      {
        action: "sync-spotify",
        label: "Atualizar playlist Spotify",
        hint: "Playlist fixa do Global 100 (@bruno) — troca faixas e título.",
      },
      {
        action: "sync-youtube",
        label: "Criar playlists YouTube",
        hint: "Global 100 e Airplay. Se já existirem, não recria (idempotente).",
      },
    ],
  },
  {
    title: "Posts e avisos",
    items: [
      {
        action: "social-posts",
        label: "Enfileirar posts sociais",
        hint: "Agenda posts do Global 100, Airplay e Álbuns na automação social.",
      },
      {
        action: "editorial",
        label: "Gerar panorama editorial",
        hint: "Post editorial da semana no site (não duplica se já existir).",
      },
      {
        action: "notify",
        label: "Reenviar notificações",
        hint: "Push/in-app das três paradas globais (mesmo se já publicadas).",
      },
    ],
  },
  {
    title: "Peças avulsas",
    items: [
      { action: "recalc-global100", label: "Recalcular só Global 100", hint: "Snapshot do Global 100.", danger: true },
      { action: "recalc-airplay", label: "Recalcular só Airplay", hint: "Last.fm airplay (sem Spotify /search).", danger: true },
      { action: "recalc-albums", label: "Recalcular só Álbuns", hint: "Last.fm álbuns (sem Spotify /search).", danger: true },
      { action: "recalc-curators", label: "Recalcular Curadores", hint: "Top curadores da semana.", danger: true },
      { action: "recalc-genres", label: "Recalcular gêneros", hint: "Todas as paradas por gênero.", danger: true },
      { action: "communities", label: "Congelar comunidades", hint: "Airplay/Álbuns Last.fm de todas as comunidades." },
      { action: "poll-close", label: "Fechar Votação da Semana", hint: "Apura Melhor da Semana + Flashback." },
    ],
  },
];

export default function ParadaGlobalClient({
  initialSlot,
  initialPollOpenSlot,
  initialPollCloseSlot,
  weekLabel,
  deadlineIso,
  publishAtIso,
  alreadyPublished,
  initialWeekIndex,
  initialWeeks,
  initialStatus,
}: {
  initialSlot: GlobalPublishSlot;
  initialPollOpenSlot: GlobalPublishSlot;
  initialPollCloseSlot: GlobalPublishSlot;
  weekLabel: string;
  deadlineIso: string;
  publishAtIso: string;
  alreadyPublished: boolean;
  initialWeekIndex: number;
  initialWeeks: WeekOption[];
  initialStatus: WeekStatus;
}) {
  const [slot, setSlot] = useState(initialSlot);
  const [pollOpenSlot, setPollOpenSlot] = useState(initialPollOpenSlot);
  const [pollCloseSlot, setPollCloseSlot] = useState(initialPollCloseSlot);
  const [saving, setSaving] = useState(false);
  const [savingPoll, setSavingPoll] = useState<"open" | "close" | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pollSavedAt, setPollSavedAt] = useState<number | null>(null);
  const [published, setPublished] = useState(alreadyPublished);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const [weekIndex, setWeekIndex] = useState(initialWeekIndex);
  const [weeks, setWeeks] = useState(initialWeeks);
  const [status, setStatus] = useState(() => ({
    ...initialStatus,
    dates: initialStatus.dates ?? emptyDates(),
  }));
  const [dateDrafts, setDateDrafts] = useState<Record<GlobalDateKind, string>>(() => ({
    global100: initialStatus.dates?.global100.weekDate ?? "",
    airplay: initialStatus.dates?.airplay.weekDate ?? "",
    albums: initialStatus.dates?.albums.weekDate ?? "",
    genres: initialStatus.dates?.genres.weekDate ?? "",
  }));
  const [savingDateKind, setSavingDateKind] = useState<GlobalDateKind | null>(null);
  const [dateMsg, setDateMsg] = useState<string | null>(null);
  const [dateErr, setDateErr] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<GlobalAdminAction | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<unknown>(null);

  const applyStatus = useCallback((next: WeekStatus) => {
    const withDates = { ...next, dates: next.dates ?? emptyDates() };
    setStatus(withDates);
    setDateDrafts({
      global100: withDates.dates.global100.weekDate ?? "",
      airplay: withDates.dates.airplay.weekDate ?? "",
      albums: withDates.dates.albums.weekDate ?? "",
      genres: withDates.dates.genres.weekDate ?? "",
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const preview = useMemo(() => {
    const rankingWeek = getRankingWeekReference(new Date(), slot);
    const deadline = getGlobalSnapshotDeadline(rankingWeek.weekIndex, slot);
    const publishAt = new Date(deadline.getTime() + 60 * 60 * 1000);
    return { deadline: deadline.toISOString(), publishAt: publishAt.toISOString() };
  }, [slot]);

  const unlockAtMs = useMemo(
    () => new Date(preview.publishAt).getTime() + MANUAL_PUBLISH_UNLOCK_DELAY_MS,
    [preview.publishAt],
  );
  const canPublishManually = !published && nowTick >= unlockAtMs;

  const refreshStatus = useCallback(async (wi: number) => {
    const res = await fetch(`/api/admin/parada-global/actions?weekIndex=${wi}`);
    const data = (await res.json()) as {
      ok?: boolean;
      weeks?: WeekOption[];
      status?: WeekStatus;
    };
    if (data.weeks) setWeeks(data.weeks);
    if (data.status) applyStatus(data.status);
  }, [applyStatus]);

  async function save(patch: Partial<GlobalPublishSlot>) {
    const next = { ...slot, ...patch };
    setSlot(next);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/social/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "event-schedule", eventType: "GLOBAL100_PUBLISHED", ...next }),
      });
      if (res.ok) setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  async function savePollSlot(
    which: "open" | "close",
    patch: Partial<GlobalPublishSlot>,
  ) {
    const current = which === "open" ? pollOpenSlot : pollCloseSlot;
    const next = { ...current, ...patch };
    if (which === "open") setPollOpenSlot(next);
    else setPollCloseSlot(next);
    setSavingPoll(which);
    try {
      const eventType = which === "open" ? "WEEKLY_POLL_OPEN" : "WEEKLY_POLL_CLOSE";
      const res = await fetch("/api/admin/social/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "event-schedule", eventType, ...next }),
      });
      if (res.ok) setPollSavedAt(Date.now());
    } finally {
      setSavingPoll(null);
    }
  }

  async function publishNow() {
    setPublishing(true);
    setPublishError(null);
    setPublishMessage(null);
    try {
      const res = await fetch("/api/admin/parada-global/publish", { method: "POST" });
      const data = (await res.json()) as { error?: string; weekLabel?: string };
      if (!res.ok) {
        setPublishError(data.error ?? "Não foi possível publicar.");
        if (res.status === 409) setPublished(true);
        return;
      }
      setPublished(true);
      setPublishMessage("Parada Global publicada com sucesso!");
      await refreshStatus(weekIndex);
    } catch {
      setPublishError("Erro de conexão ao publicar.");
    } finally {
      setPublishing(false);
    }
  }

  async function runAction(action: GlobalAdminAction) {
    const def = ACTION_GROUPS.flatMap((g) => g.items).find((i) => i.action === action);
    if (def?.danger) {
      const ok = window.confirm(
        `Confirmar “${def.label}” para ${status.weekLabel} (${weekIndex})?\n\n${def.hint}`,
      );
      if (!ok) return;
    }

    setBusyAction(action);
    setActionErr(null);
    setActionMsg(null);
    setLastResult(null);
    try {
      const res = await fetch("/api/admin/parada-global/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, weekIndex }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        result?: unknown;
        status?: WeekStatus;
      };
      if (!res.ok || !data.ok) {
        setActionErr(data.error ?? "Falha ao executar ação.");
        return;
      }
      if (data.status) applyStatus(data.status);
      setLastResult(data.result);
      setActionMsg(`Concluído: ${def?.label ?? action}.`);
      if (data.status?.snapshots.global100) setPublished(true);
      await refreshStatus(weekIndex);
    } catch {
      setActionErr("Erro de conexão ao executar ação.");
    } finally {
      setBusyAction(null);
    }
  }

  async function onWeekChange(next: number) {
    setWeekIndex(next);
    setActionErr(null);
    setActionMsg(null);
    setDateErr(null);
    setDateMsg(null);
    setLastResult(null);
    try {
      await refreshStatus(next);
    } catch {
      setActionErr("Não foi possível carregar o status da semana.");
    }
  }

  async function saveDate(kind: GlobalDateKind) {
    const weekDate = dateDrafts[kind]?.trim() ?? "";
    if (!weekDate) {
      setDateErr("Escolha uma data antes de salvar.");
      return;
    }
    setSavingDateKind(kind);
    setDateErr(null);
    setDateMsg(null);
    try {
      const res = await fetch("/api/admin/parada-global/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "set-dates", dateKind: kind, weekDate, weekIndex }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        status?: WeekStatus;
        result?: { weekLabel?: string; dateRange?: string; updatedCount?: number };
      };
      if (!res.ok || !data.ok) {
        setDateErr(data.error ?? "Não foi possível salvar a data.");
        return;
      }
      if (data.status) applyStatus(data.status);
      const label = DATE_FIELDS.find((f) => f.kind === kind)?.label ?? kind;
      const range = data.result?.dateRange ? ` → ${data.result.dateRange}` : "";
      const count =
        kind === "genres" && data.result?.updatedCount
          ? ` (${data.result.updatedCount} gêneros)`
          : "";
      setDateMsg(`Data de ${label} salva${count}${range}.`);
    } catch {
      setDateErr("Erro de conexão ao salvar a data.");
    } finally {
      setSavingDateKind(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 720 }}>
      <section style={{ ...adminPanelStyle, padding: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Publicação da Parada Global</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
          Dia da semana e horário (América/São_Paulo) em que a Parada Global (Global 100, Air Play e Álbuns) é
          publicada. As paradas pessoais dos usuários precisam ser enviadas até 1h antes desse horário para entrar
          no cálculo da semana.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <select
            value={slot.weekday}
            onChange={(e) => save({ weekday: Number(e.target.value) })}
            style={{ ...adminInputStyle, width: 160 }}
          >
            {WEEKDAY_LABELS.map((label, idx) => (
              <option key={idx} value={idx}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="time"
            value={slot.time}
            onChange={(e) => save({ time: e.target.value })}
            style={{ ...adminInputStyle, width: 120 }}
          />
          {saving && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Salvando…</span>}
          {!saving && savedAt && <span style={{ fontSize: 12, color: "#5BD16A" }}>Salvo</span>}
        </div>
      </section>

      <section style={{ ...adminPanelStyle, padding: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Votação da Semana</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
          Horários (América/São_Paulo) em que a enquete Melhor da Semana + Flashback abre e fecha.
          Os crons reconciliam de hora em hora e só executam depois do horário salvo.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Abertura</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <select
                value={pollOpenSlot.weekday}
                onChange={(e) => savePollSlot("open", { weekday: Number(e.target.value) })}
                style={{ ...adminInputStyle, width: 160 }}
              >
                {WEEKDAY_LABELS.map((label, idx) => (
                  <option key={idx} value={idx}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={pollOpenSlot.time}
                onChange={(e) => savePollSlot("open", { time: e.target.value })}
                style={{ ...adminInputStyle, width: 120 }}
              />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Fechamento</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <select
                value={pollCloseSlot.weekday}
                onChange={(e) => savePollSlot("close", { weekday: Number(e.target.value) })}
                style={{ ...adminInputStyle, width: 160 }}
              >
                {WEEKDAY_LABELS.map((label, idx) => (
                  <option key={idx} value={idx}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={pollCloseSlot.time}
                onChange={(e) => savePollSlot("close", { time: e.target.value })}
                style={{ ...adminInputStyle, width: 120 }}
              />
            </div>
          </div>
          {savingPoll && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Salvando…</span>}
          {!savingPoll && pollSavedAt && <span style={{ fontSize: 12, color: "#5BD16A" }}>Salvo</span>}
        </div>
      </section>

      <section style={{ ...adminPanelStyle, padding: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Semana atual ({weekLabel})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Data limite para envio das paradas: </span>
            <strong>{formatBrt(preview.deadline)}</strong>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Publicação da Parada Global: </span>
            <strong>{formatBrt(preview.publishAt)}</strong>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>
          Valores calculados a partir do horário salvo acima (servidor mostrou {formatBrt(deadlineIso)} /{" "}
          {formatBrt(publishAtIso)} ao carregar a página).
        </div>
      </section>

      <section style={{ ...adminPanelStyle, padding: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Publicação manual (semana corrente)</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
          Use só se o cron automático não publicar sozinho. Libera 5 minutos depois do horário configurado. Para
          semanas antigas ou ações avulsas, use o painel de gerenciamento abaixo.
        </div>
        {published ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            A Parada Global desta semana ({weekLabel}) já foi publicada.
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={publishNow}
              disabled={!canPublishManually || publishing}
              style={buttonStyle(!canPublishManually || publishing)}
            >
              {publishing ? "Publicando…" : "Publicar agora"}
            </button>
            {!canPublishManually && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                Libera às {formatBrt(new Date(unlockAtMs).toISOString())}.
              </div>
            )}
          </>
        )}
        {publishMessage && <div style={{ fontSize: 13, color: "#5BD16A", marginTop: 8 }}>{publishMessage}</div>}
        {publishError && <div style={{ fontSize: 13, color: "#e06666", marginTop: 8 }}>{publishError}</div>}
      </section>

      <section style={{ ...adminPanelStyle, padding: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Gerenciamento</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
          Tudo o que o cron faz automaticamente — para recuperar falhas (playlist, posts, snapshot). Escolha a
          semana (inclusive retroativa) e rode só o que faltou.
        </div>

        <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
          Semana
        </label>
        <select
          value={weekIndex}
          onChange={(e) => onWeekChange(Number(e.target.value))}
          style={{ ...adminInputStyle, marginBottom: 16 }}
          disabled={busyAction != null}
        >
          {weeks.map((w) => (
            <option key={w.weekIndex} value={w.weekIndex}>
              {w.weekLabel} ({w.weekIndex}){w.hasGlobal100 ? "" : " — sem snapshot"}
            </option>
          ))}
        </select>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 16,
            fontSize: 12,
          }}
        >
          <span style={badge(status.snapshots.global100)}>Global 100</span>
          <span style={badge(status.snapshots.airplay)}>Airplay</span>
          <span style={badge(status.snapshots.albums)}>Álbuns</span>
          <span style={badge(status.snapshots.curators)}>Curadores</span>
          <span style={badge(status.snapshots.genreCount > 0)}>
            Gêneros ({status.snapshots.genreCount})
          </span>
          <span style={badge(Boolean(status.editorial))}>Editorial</span>
          <span style={badge(Boolean(status.playlists.youtubeGlobal100))}>YT Global</span>
          <span style={badge(Boolean(status.playlists.youtubeAirplay))}>YT Airplay</span>
          <span style={badge(status.socialPosts.length > 0)}>
            Posts sociais ({status.socialPosts.length})
          </span>
        </div>

        <div
          style={{
            marginBottom: 20,
            padding: 14,
            borderRadius: 12,
            border: "1px solid var(--divider)",
            background: "var(--bg)",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Datas exibidas</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
            Ajusta o rótulo e o intervalo de cada global desta semana sem recalcular o ranking. Um
            recalcular sobrescreve esses valores. Airplay e Álbuns também atualizam a janela
            Last.fm do hero.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {DATE_FIELDS.map((field) => {
              const info = status.dates[field.kind];
              const disabled =
                !info.exists || savingDateKind != null || busyAction != null;
              const dirty = (dateDrafts[field.kind] || "") !== (info.weekDate || "");
              return (
                <div
                  key={field.kind}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(110px, 140px) minmax(140px, 1fr) auto",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{field.label}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {info.exists
                        ? info.scoringWindow || info.dateRange || info.weekLabel || "—"
                        : "Sem snapshot"}
                    </div>
                  </div>
                  <input
                    type="date"
                    value={dateDrafts[field.kind] || ""}
                    onChange={(e) =>
                      setDateDrafts((prev) => ({ ...prev, [field.kind]: e.target.value }))
                    }
                    disabled={disabled}
                    style={{ ...adminInputStyle, width: "100%" }}
                    title={field.hint}
                  />
                  <button
                    type="button"
                    onClick={() => saveDate(field.kind)}
                    disabled={disabled || !dirty || !dateDrafts[field.kind]}
                    style={buttonStyle(disabled || !dirty || !dateDrafts[field.kind], "secondary")}
                  >
                    {savingDateKind === field.kind ? "Salvando…" : "Salvar"}
                  </button>
                </div>
              );
            })}
          </div>
          {dateMsg && <div style={{ fontSize: 13, color: "#5BD16A", marginTop: 10 }}>{dateMsg}</div>}
          {dateErr && <div style={{ fontSize: 13, color: "#e06666", marginTop: 10 }}>{dateErr}</div>}
        </div>

        {ACTION_GROUPS.map((group) => (
          <div key={group.title} style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{group.title}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {group.items.map((item) => (
                <div key={item.action}>
                  <button
                    type="button"
                    onClick={() => runAction(item.action)}
                    disabled={busyAction != null}
                    style={buttonStyle(busyAction != null, item.danger ? "secondary" : "primary")}
                  >
                    {busyAction === item.action ? "Executando…" : item.label}
                  </button>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{item.hint}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {actionMsg && <div style={{ fontSize: 13, color: "#5BD16A", marginTop: 8 }}>{actionMsg}</div>}
        {actionErr && <div style={{ fontSize: 13, color: "#e06666", marginTop: 8 }}>{actionErr}</div>}
        {lastResult != null && (
          <pre
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 10,
              background: "var(--bg)",
              border: "1px solid var(--divider)",
              fontSize: 11,
              overflow: "auto",
              maxHeight: 220,
            }}
          >
            {JSON.stringify(lastResult, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}

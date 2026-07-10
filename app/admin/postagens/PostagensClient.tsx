"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { AdminTablePagination } from "@/components/admin/AdminTablePagination";
import {
  adminCellEllipsis,
  adminCompactTableStyle,
  adminCompactTdStyle,
  adminCompactThStyle,
  adminInputStyle,
} from "@/components/admin/admin-styles";
import { buildWeekIndexFromDate } from "@/lib/chart-week";

type Publication = {
  id: string;
  platform: string;
  status: string;
  externalId: string | null;
  error: string | null;
  publishedAt: string | null;
};

type SocialPostRow = {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  priority: string;
  status: string;
  createdAt: string;
  scheduledAt: string | null;
  expiresAt: string | null;
  publishedAt: string | null;
  platforms: string[];
  captionInstagram: string | null;
  captionFacebook: string | null;
  captionThreads: string | null;
  captionTelegram: string | null;
  imageFeed45: string | null;
  imageTelegram11: string | null;
  imageStory916: string | null;
  hashtags: string[];
  retryCount: number;
  lastError: string | null;
  publications: Publication[];
};

type PlatformConfig = { platform: string; enabled: boolean };
type AutomationToggle = { eventType: string; enabled: boolean };
type PushRoundOption = { id: string; number: number };
type CopaEditionOption = { id: string; name: string; year: number };
type AlbumOption = { id: number; title: string; artist: { name: string } };
type EventScheduleRow = { eventType: string; weekday: number; time: string };

const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
/** As paradas oficiais têm dia/horário configurável (as outras automações usam o próximo slot livre). */
const CHART_EVENT_TYPES = ["GLOBAL100_PUBLISHED", "AIRPLAY_PUBLISHED", "ALBUMS_CHART_PUBLISHED"];
const CHART_LABELS: Record<string, string> = {
  GLOBAL100_PUBLISHED: "Global 100",
  AIRPLAY_PUBLISHED: "Global 100 Air Play",
  ALBUMS_CHART_PUBLISHED: "Global 100 Álbuns",
};

/** Como preencher entityType/entityId para cada tipo de evento na criação manual. */
const EVENT_META: Record<string, { entityType: string; mode: "album" | "week" | "push" | "copa" }> = {
  ALBUM_REVIEW_MILESTONE: { entityType: "album", mode: "album" },
  ALBUM_CLUB_WINNER: { entityType: "album", mode: "album" },
  GLOBAL100_PUBLISHED: { entityType: "chart_week", mode: "week" },
  AIRPLAY_PUBLISHED: { entityType: "chart_week", mode: "week" },
  ALBUMS_CHART_PUBLISHED: { entityType: "chart_week", mode: "week" },
  WEEKLY_POLL_OPEN: { entityType: "weekly_poll", mode: "week" },
  PUSH_PHASE_CHANGE: { entityType: "push_round", mode: "push" },
  COPA_ROUND_START: { entityType: "copa_edition", mode: "copa" },
  COPA_ROUND_RESULT: { entityType: "copa_edition", mode: "copa" },
  COPA_FINAL_RESULT: { entityType: "copa_edition", mode: "copa" },
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#86868B",
  SCHEDULED: "#0A84FF",
  GENERATING: "#FF9500",
  READY: "#5BD16A",
  PUBLISHING: "#FF9500",
  PUBLISHED: "#2EB550",
  PARTIALLY_PUBLISHED: "#FFC542",
  FAILED: "#FF3B30",
  CANCELLED: "#86868B",
};

const PAGE_SIZE = 10;

export default function PostagensClient({
  initialPosts,
  platformConfigs,
  automationToggles,
  scheduleConfig,
  pushRounds,
  copaEditions,
  latestWeekIndex,
  eventSchedules,
}: {
  initialPosts: SocialPostRow[];
  platformConfigs: PlatformConfig[];
  automationToggles: AutomationToggle[];
  scheduleConfig: { slots: string[]; timezone: string };
  pushRounds: PushRoundOption[];
  copaEditions: CopaEditionOption[];
  /** Última semana com snapshot congelado por eventType — pode não existir a semana calendário atual ainda. */
  latestWeekIndex: Record<string, number | null>;
  eventSchedules: EventScheduleRow[];
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [platforms, setPlatforms] = useState(platformConfigs);
  const [toggles, setToggles] = useState(automationToggles);
  const [schedules, setSchedules] = useState(eventSchedules);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [platformFilter, setPlatformFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<"fila" | "agenda">("fila");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [captionDrafts, setCaptionDrafts] = useState<Record<string, string>>({});

  const currentWeekIndex = useMemo(() => buildWeekIndexFromDate(new Date()), []);
  const [manualForm, setManualForm] = useState({
    eventType: "ALBUM_REVIEW_MILESTONE",
    entityType: "album",
    entityId: "",
  });
  const [albumQuery, setAlbumQuery] = useState("");
  const [albumResults, setAlbumResults] = useState<AlbumOption[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumOption | null>(null);
  const [albumSearchLoading, setAlbumSearchLoading] = useState(false);
  const albumDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const manualMode = EVENT_META[manualForm.eventType]?.mode ?? "album";

  function selectEventType(eventType: string) {
    const meta = EVENT_META[eventType];
    setSelectedAlbum(null);
    setAlbumQuery("");
    setAlbumResults([]);
    const defaultWeek = latestWeekIndex[eventType] ?? currentWeekIndex;
    setManualForm({
      eventType,
      entityType: meta?.entityType ?? "",
      entityId: meta?.mode === "week" ? String(defaultWeek) : "",
    });
  }

  useEffect(() => {
    const q = albumQuery.trim();
    if (manualMode !== "album" || q.length < 2) {
      setAlbumResults([]);
      return;
    }
    if (albumDebounceRef.current) clearTimeout(albumDebounceRef.current);
    setAlbumSearchLoading(true);
    const ctrl = new AbortController();
    albumDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/edicao-de-dados/search?kind=albums&q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
          cache: "no-store",
        });
        const data = res.ok ? ((await res.json()) as { items?: AlbumOption[] }) : { items: [] };
        setAlbumResults(data.items ?? []);
      } catch {
        // request abortado/erro de rede — ignora
      } finally {
        setAlbumSearchLoading(false);
      }
    }, 250);
    return () => {
      ctrl.abort();
      if (albumDebounceRef.current) clearTimeout(albumDebounceRef.current);
    };
  }, [albumQuery, manualMode]);

  function pickAlbum(album: AlbumOption) {
    setSelectedAlbum(album);
    setAlbumQuery(`${album.title} — ${album.artist.name}`);
    setAlbumResults([]);
    setManualForm((prev) => ({ ...prev, entityId: String(album.id) }));
  }

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (platformFilter !== "ALL" && !p.platforms.includes(platformFilter)) return false;
      return true;
    });
  }, [posts, statusFilter, platformFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, platformFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function callAction(id: string, payload: Record<string, unknown>) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/social/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Falha na ação");
        return;
      }
      if (data.post) {
        setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...normalizePost(data.post) } : p)));
      }
    } finally {
      setBusyId(null);
    }
  }

  function toggleExpand(post: SocialPostRow) {
    setExpandedId((prev) => {
      if (prev === post.id) return null;
      setCaptionDrafts({
        facebook: post.captionFacebook ?? "",
        threads: post.captionThreads ?? "",
        telegram: post.captionTelegram ?? "",
      });
      return post.id;
    });
  }

  function updateCaptionLocal(postId: string, caption: string) {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, captionInstagram: caption } : p)));
  }

  async function saveCaptions(postId: string) {
    setBusyId(postId);
    try {
      const platforms: Array<"facebook" | "threads" | "telegram"> = ["facebook", "threads", "telegram"];
      for (const platform of platforms) {
        await fetch(`/api/admin/social/posts/${postId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "caption", platform, caption: captionDrafts[platform] ?? "" }),
        });
      }
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                captionFacebook: captionDrafts.facebook ?? p.captionFacebook,
                captionThreads: captionDrafts.threads ?? p.captionThreads,
                captionTelegram: captionDrafts.telegram ?? p.captionTelegram,
              }
            : p,
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function regenerateCaption(postId: string) {
    setBusyId(postId);
    try {
      const res = await fetch(`/api/admin/social/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate-caption" }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Falha ao gerar nova variação de texto");
        return;
      }
      const updated = normalizePost(data.post);
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...updated } : p)));
      if (expandedId === postId) {
        setCaptionDrafts({
          facebook: updated.captionFacebook ?? "",
          threads: updated.captionThreads ?? "",
          telegram: updated.captionTelegram ?? "",
        });
      }
    } finally {
      setBusyId(null);
    }
  }

  async function updatePlatformConfig(platform: string, patch: { enabled?: boolean }) {
    const res = await fetch("/api/admin/social/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "platform", platform, ...patch }),
    });
    if (res.ok) {
      const data = await res.json();
      setPlatforms((prev) => prev.map((p) => (p.platform === platform ? data.config : p)));
    }
  }

  async function updateEventSchedule(eventType: string, patch: { weekday?: number; time?: string }) {
    const current = schedules.find((s) => s.eventType === eventType);
    const weekday = patch.weekday ?? current?.weekday ?? 2;
    const time = patch.time ?? current?.time ?? "09:00";
    const res = await fetch("/api/admin/social/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "event-schedule", eventType, weekday, time }),
    });
    if (res.ok) {
      const data = await res.json();
      setSchedules((prev) => {
        const exists = prev.some((s) => s.eventType === eventType);
        return exists ? prev.map((s) => (s.eventType === eventType ? data.config : s)) : [...prev, data.config];
      });
    }
  }

  async function updateToggle(eventType: string, enabled: boolean) {
    const res = await fetch("/api/admin/social/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "automation", eventType, enabled }),
    });
    if (res.ok) {
      const data = await res.json();
      setToggles((prev) => {
        const exists = prev.some((t) => t.eventType === eventType);
        return exists ? prev.map((t) => (t.eventType === eventType ? data.toggle : t)) : [...prev, data.toggle];
      });
    }
  }

  async function createManualPost() {
    if (!manualForm.entityType.trim() || !manualForm.entityId.trim()) {
      alert(
        manualMode === "album"
          ? "Busque e selecione um álbum antes de criar."
          : "Preencha entityType e entityId antes de criar.",
      );
      return;
    }
    const res = await fetch("/api/admin/social/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(manualForm),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Falha ao criar publicação");
      return;
    }
    setPosts((prev) => [normalizePost(data.post), ...prev]);
    selectEventType(manualForm.eventType);
  }

  const eventTypes = [
    "GLOBAL100_PUBLISHED",
    "AIRPLAY_PUBLISHED",
    "ALBUMS_CHART_PUBLISHED",
    "ALBUM_REVIEW_MILESTONE",
    "ALBUM_CLUB_WINNER",
    "PUSH_PHASE_CHANGE",
    "COPA_ROUND_START",
    "COPA_ROUND_RESULT",
    "COPA_FINAL_RESULT",
    "WEEKLY_POLL_OPEN",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--divider)" }}>
        {(
          [
            { id: "fila" as const, label: "Fila" },
            { id: "agenda" as const, label: "Agenda das Paradas" },
          ]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "10px 16px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 700,
              color: tab === t.id ? "#FA243C" : "var(--text-muted)",
              borderBottom: tab === t.id ? "2px solid #FA243C" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "agenda" && (
        <section style={{ border: "1px solid var(--divider)", borderRadius: 12, padding: 16, maxWidth: 520 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Agenda das paradas oficiais</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
            Dia da semana e horário (América/São_Paulo) em que cada parada é postada. As 3 edições são publicadas juntas pelo cron de
            terça — se configuradas para o mesmo dia/horário, saem juntas no mesmo slot em todas as redes.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {CHART_EVENT_TYPES.map((eventType) => {
              const cfg = schedules.find((s) => s.eventType === eventType);
              return (
                <div key={eventType} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 180, fontSize: 13, fontWeight: 600 }}>{CHART_LABELS[eventType]}</div>
                  <select
                    value={cfg?.weekday ?? 2}
                    onChange={(e) => updateEventSchedule(eventType, { weekday: Number(e.target.value) })}
                    style={{ ...adminInputStyle, width: 130 }}
                  >
                    {WEEKDAY_LABELS.map((label, idx) => (
                      <option key={idx} value={idx}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={cfg?.time ?? "09:00"}
                    onChange={(e) => updateEventSchedule(eventType, { time: e.target.value })}
                    style={{ ...adminInputStyle, width: 110 }}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {tab === "fila" && (
        <>
      <section style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {["FACEBOOK", "INSTAGRAM_FEED", "INSTAGRAM_STORY", "THREADS", "TELEGRAM"].map((platform) => {
          const cfg = platforms.find((p) => p.platform === platform);
          return (
            <label
              key={platform}
              style={{ display: "flex", gap: 8, alignItems: "center", border: "1px solid var(--divider)", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 600 }}
            >
              <input type="checkbox" checked={cfg?.enabled ?? true} onChange={(e) => updatePlatformConfig(platform, { enabled: e.target.checked })} />
              {platform}
            </label>
          );
        })}
      </section>

      <section>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Automações por tipo de evento</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {eventTypes.map((et) => {
            const toggle = toggles.find((t) => t.eventType === et);
            const enabled = toggle?.enabled ?? true;
            return (
              <label key={et} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, border: "1px solid var(--divider)", borderRadius: 999, padding: "6px 12px" }}>
                <input type="checkbox" checked={enabled} onChange={(e) => updateToggle(et, e.target.checked)} />
                {et}
              </label>
            );
          })}
        </div>
      </section>

      <section style={{ border: "1px solid var(--divider)", borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Criar publicação manual</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
          <select value={manualForm.eventType} onChange={(e) => selectEventType(e.target.value)} style={{ ...adminInputStyle, width: 220 }}>
            {eventTypes.map((et) => (
              <option key={et} value={et}>
                {et}
              </option>
            ))}
          </select>

          {manualMode === "album" && (
            <div style={{ position: "relative", width: 280 }}>
              <input
                placeholder="Buscar álbum por nome ou artista…"
                value={albumQuery}
                onChange={(e) => {
                  setAlbumQuery(e.target.value);
                  setSelectedAlbum(null);
                  setManualForm((prev) => ({ ...prev, entityId: "" }));
                }}
                style={{ ...adminInputStyle, width: "100%" }}
              />
              {albumSearchLoading && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Buscando…</div>}
              {albumResults.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    background: "var(--surface)",
                    border: "1px solid var(--divider-strong)",
                    borderRadius: 8,
                    maxHeight: 240,
                    overflowY: "auto",
                    marginTop: 2,
                  }}
                >
                  {albumResults.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => pickAlbum(a)}
                      style={{ padding: "8px 10px", fontSize: 13, cursor: "pointer", borderBottom: "1px solid var(--divider)" }}
                    >
                      {a.title} <span style={{ color: "var(--text-muted)" }}>— {a.artist.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {selectedAlbum && (
                <div style={{ fontSize: 11, color: "#2D7A32", marginTop: 2 }}>
                  Selecionado: #{selectedAlbum.id} — {selectedAlbum.title}
                </div>
              )}
            </div>
          )}

          {manualMode === "week" && (
            <div>
              <input
                placeholder="Semana (ano*100 + semana ISO)"
                value={manualForm.entityId}
                onChange={(e) => setManualForm({ ...manualForm, entityId: e.target.value })}
                style={{ ...adminInputStyle, width: 200 }}
              />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                {latestWeekIndex[manualForm.eventType] != null
                  ? `Última semana com dados: ${latestWeekIndex[manualForm.eventType]} (semana calendário atual: ${currentWeekIndex})`
                  : `Nenhuma semana com dados ainda para este evento — semana calendário atual: ${currentWeekIndex}`}
              </div>
            </div>
          )}

          {manualMode === "push" && (
            <select
              value={manualForm.entityId}
              onChange={(e) => setManualForm({ ...manualForm, entityId: e.target.value })}
              style={{ ...adminInputStyle, width: 200 }}
            >
              <option value="">Selecione a rodada…</option>
              {pushRounds.map((r) => (
                <option key={r.id} value={r.id}>
                  Rodada {r.number}
                </option>
              ))}
            </select>
          )}

          {manualMode === "copa" && (
            <select
              value={manualForm.entityId}
              onChange={(e) => setManualForm({ ...manualForm, entityId: e.target.value })}
              style={{ ...adminInputStyle, width: 220 }}
            >
              <option value="">Selecione a edição…</option>
              {copaEditions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.year})
                </option>
              ))}
            </select>
          )}

          <button onClick={createManualPost} style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "#FA243C", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
            Criar
          </button>
        </div>
      </section>

      <section style={{ display: "flex", gap: 12 }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...adminInputStyle, width: 200 }}>
          <option value="ALL">Todos os status</option>
          {Object.keys(STATUS_COLORS).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} style={{ ...adminInputStyle, width: 200 }}>
          <option value="ALL">Todas as plataformas</option>
          {["FACEBOOK", "INSTAGRAM_FEED", "INSTAGRAM_STORY", "THREADS", "TELEGRAM"].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </section>

      <AdminPanel maxWidth={1200} scroll={false}>
        <table style={adminCompactTableStyle}>
          <colgroup>
            <col style={{ width: "11%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>
          <thead>
            <tr style={{ background: "var(--fill-inset)" }}>
              <th style={adminCompactThStyle}>Tipo</th>
              <th style={adminCompactThStyle}>Entidade</th>
              <th style={adminCompactThStyle}>Prior.</th>
              <th style={adminCompactThStyle}>Status</th>
              <th style={adminCompactThStyle}>Agendado</th>
              <th style={adminCompactThStyle}>Plataformas</th>
              <th style={adminCompactThStyle}>Arte</th>
              <th style={adminCompactThStyle}>Texto</th>
              <th style={adminCompactThStyle}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((post) => (
              <Fragment key={post.id}>
              <tr>
                <td style={{ ...adminCompactTdStyle, ...adminCellEllipsis }} title={post.eventType}>
                  {post.eventType}
                </td>
                <td style={{ ...adminCompactTdStyle, ...adminCellEllipsis }} title={`${post.entityType} #${post.entityId}`}>
                  {post.entityType} #{post.entityId}
                </td>
                <td style={adminCompactTdStyle}>
                  <select
                    value={post.priority}
                    onChange={(e) => callAction(post.id, { action: "priority", priority: e.target.value })}
                    style={{ ...compactInputStyle, width: "100%" }}
                  >
                    {["CRITICAL", "HIGH", "NORMAL", "LOW"].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={adminCompactTdStyle}>
                  <span style={{ color: STATUS_COLORS[post.status] ?? "var(--text)", fontWeight: 700, fontSize: 11 }}>{post.status}</span>
                  {post.lastError && (
                    <div title={post.lastError} style={{ fontSize: 10, color: "#FF3B30", ...adminCellEllipsis }}>
                      {post.lastError}
                    </div>
                  )}
                </td>
                <td style={adminCompactTdStyle}>
                  <input
                    type="datetime-local"
                    defaultValue={post.scheduledAt ? toDatetimeLocal(post.scheduledAt) : ""}
                    onBlur={(e) => e.target.value && callAction(post.id, { action: "reschedule", scheduledAt: new Date(e.target.value).toISOString() })}
                    style={{ ...compactInputStyle, width: "100%" }}
                  />
                </td>
                <td style={adminCompactTdStyle}>
                  {post.publications.map((pub) => (
                    <div key={pub.id} style={{ fontSize: 10, ...adminCellEllipsis }} title={`${pub.platform}: ${pub.status}`}>
                      {pub.platform}: <span style={{ color: pub.status === "PUBLISHED" ? "#2EB550" : pub.status === "FAILED" ? "#FF3B30" : "var(--text-muted)" }}>{pub.status}</span>
                    </div>
                  ))}
                </td>
                <td style={adminCompactTdStyle}>
                  {post.imageFeed45 || post.imageStory916 || post.imageTelegram11 ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      {[
                        { label: "Feed", src: post.imageFeed45 },
                        { label: "Story", src: post.imageStory916 },
                        { label: "Telegram", src: post.imageTelegram11 },
                      ]
                        .filter((v) => v.src)
                        .map((v) => (
                          <a key={v.label} href={v.src!} target="_blank" rel="noreferrer" title={`Abrir ${v.label} em tamanho real`}>
                            <img
                              src={v.src!}
                              alt={v.label}
                              style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 4, border: "1px solid var(--divider-strong)", display: "block" }}
                            />
                          </a>
                        ))}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>sem arte</span>
                      <button disabled={busyId === post.id} onClick={() => callAction(post.id, { action: "generate-preview" })} style={actionBtnStyle}>
                        Gerar
                      </button>
                    </div>
                  )}
                </td>
                <td style={adminCompactTdStyle}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <textarea
                      value={post.captionInstagram ?? ""}
                      onChange={(e) => updateCaptionLocal(post.id, e.target.value)}
                      onBlur={(e) => callAction(post.id, { action: "caption", platform: "instagram", caption: e.target.value })}
                      rows={2}
                      placeholder="Texto ainda não gerado"
                      style={{ ...compactInputStyle, width: "100%", fontFamily: "inherit", resize: "vertical", minHeight: 44 }}
                    />
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                      <button disabled={busyId === post.id} onClick={() => regenerateCaption(post.id)} style={actionBtnStyle}>
                        {busyId === post.id ? "…" : "Regenerar"}
                      </button>
                      <button disabled={busyId === post.id} onClick={() => toggleExpand(post)} style={actionBtnStyle}>
                        {expandedId === post.id ? "Fechar" : "Redes"}
                      </button>
                    </div>
                  </div>
                </td>
                <td style={adminCompactTdStyle}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <button disabled={busyId === post.id} onClick={() => callAction(post.id, { action: "generate-preview" })} style={actionBtnStyle}>
                      Preview
                    </button>
                    <button disabled={busyId === post.id} onClick={() => callAction(post.id, { action: "publish-now" })} style={actionBtnStyle}>
                      Publicar
                    </button>
                    <button disabled={busyId === post.id} onClick={() => callAction(post.id, { action: "retry" })} style={actionBtnStyle}>
                      Retry
                    </button>
                    <button disabled={busyId === post.id} onClick={() => callAction(post.id, { action: "cancel" })} style={{ ...actionBtnStyle, color: "#FF3B30" }}>
                      Cancelar
                    </button>
                  </div>
                </td>
              </tr>
              {expandedId === post.id && (
                <tr>
                  <td colSpan={9} style={{ ...adminCompactTdStyle, background: "var(--surface-secondary, rgba(127,127,127,0.06))" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 4 }}>
                      <div style={{ fontWeight: 700, fontSize: 12 }}>Texto nas outras redes</div>
                      {(
                        [
                          { key: "facebook" as const, label: "Facebook" },
                          { key: "threads" as const, label: "Threads" },
                          { key: "telegram" as const, label: "Telegram" },
                        ]
                      ).map((f) => (
                        <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <label style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>{f.label}</label>
                          <textarea
                            value={captionDrafts[f.key] ?? ""}
                            onChange={(e) => setCaptionDrafts((prev) => ({ ...prev, [f.key]: e.target.value }))}
                            rows={3}
                            style={{ ...compactInputStyle, width: "100%", fontFamily: "inherit", resize: "vertical" }}
                          />
                        </div>
                      ))}
                      <div>
                        <button disabled={busyId === post.id} onClick={() => saveCaptions(post.id)} style={{ ...actionBtnStyle, background: "#FA243C", color: "#fff", fontWeight: 700, border: "none" }}>
                          Salvar texto
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: 12, fontSize: 12, color: "var(--text-muted)" }}>Nenhuma publicação encontrada.</div>
        )}
        <AdminTablePagination
          page={page}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={PAGE_SIZE}
          onChange={setPage}
        />
      </AdminPanel>
        </>
      )}
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  fontSize: 10,
  padding: "3px 6px",
  borderRadius: 6,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  color: "var(--text)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const compactInputStyle: React.CSSProperties = {
  ...adminInputStyle,
  padding: "4px 6px",
  fontSize: 11,
  borderRadius: 6,
};

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function normalizePost(p: any): SocialPostRow {
  return {
    ...p,
    createdAt: typeof p.createdAt === "string" ? p.createdAt : new Date(p.createdAt).toISOString(),
    scheduledAt: p.scheduledAt ? (typeof p.scheduledAt === "string" ? p.scheduledAt : new Date(p.scheduledAt).toISOString()) : null,
    expiresAt: p.expiresAt ? (typeof p.expiresAt === "string" ? p.expiresAt : new Date(p.expiresAt).toISOString()) : null,
    publishedAt: p.publishedAt ? (typeof p.publishedAt === "string" ? p.publishedAt : new Date(p.publishedAt).toISOString()) : null,
    publications: (p.publications ?? []).map((pub: any) => ({
      ...pub,
      publishedAt: pub.publishedAt ? (typeof pub.publishedAt === "string" ? pub.publishedAt : new Date(pub.publishedAt).toISOString()) : null,
    })),
  };
}

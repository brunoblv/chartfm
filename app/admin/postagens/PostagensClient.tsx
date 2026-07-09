"use client";

import { useMemo, useState } from "react";
import { adminPanelScrollStyle, adminTdStyle, adminThStyle, adminInputStyle } from "@/components/admin/admin-styles";

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

type PlatformConfig = { platform: string; dailyLimit: number; enabled: boolean };
type AutomationToggle = { eventType: string; enabled: boolean };

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

export default function PostagensClient({
  initialPosts,
  platformConfigs,
  automationToggles,
  scheduleConfig,
}: {
  initialPosts: SocialPostRow[];
  platformConfigs: PlatformConfig[];
  automationToggles: AutomationToggle[];
  scheduleConfig: { slots: string[]; timezone: string };
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [platforms, setPlatforms] = useState(platformConfigs);
  const [toggles, setToggles] = useState(automationToggles);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [platformFilter, setPlatformFilter] = useState<string>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState({ eventType: "ALBUM_REVIEW_MILESTONE", entityType: "album", entityId: "" });

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (platformFilter !== "ALL" && !p.platforms.includes(platformFilter)) return false;
      return true;
    });
  }, [posts, statusFilter, platformFilter]);

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

  async function updatePlatformConfig(platform: string, patch: { dailyLimit?: number; enabled?: boolean }) {
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
    if (!manualForm.entityId.trim()) return;
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
    setManualForm({ ...manualForm, entityId: "" });
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
      <section style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {["FACEBOOK", "INSTAGRAM_FEED", "INSTAGRAM_STORY", "THREADS", "TELEGRAM"].map((platform) => {
          const cfg = platforms.find((p) => p.platform === platform);
          return (
            <div key={platform} style={{ border: "1px solid var(--divider)", borderRadius: 12, padding: 12, minWidth: 180 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{platform}</div>
              <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, fontSize: 13 }}>
                Limite/dia
                <input
                  type="number"
                  min={0}
                  value={cfg?.dailyLimit ?? 0}
                  onChange={(e) => updatePlatformConfig(platform, { dailyLimit: Number(e.target.value) })}
                  style={{ ...adminInputStyle, width: 70 }}
                />
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, fontSize: 13 }}>
                <input type="checkbox" checked={cfg?.enabled ?? true} onChange={(e) => updatePlatformConfig(platform, { enabled: e.target.checked })} />
                Ativo
              </label>
            </div>
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={manualForm.eventType} onChange={(e) => setManualForm({ ...manualForm, eventType: e.target.value })} style={{ ...adminInputStyle, width: 220 }}>
            {eventTypes.map((et) => (
              <option key={et} value={et}>
                {et}
              </option>
            ))}
          </select>
          <input placeholder="entityType (ex.: album)" value={manualForm.entityType} onChange={(e) => setManualForm({ ...manualForm, entityType: e.target.value })} style={{ ...adminInputStyle, width: 160 }} />
          <input placeholder="entityId" value={manualForm.entityId} onChange={(e) => setManualForm({ ...manualForm, entityId: e.target.value })} style={{ ...adminInputStyle, width: 160 }} />
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

      <div style={adminPanelScrollStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={adminThStyle}>Tipo</th>
              <th style={adminThStyle}>Entidade</th>
              <th style={adminThStyle}>Prioridade</th>
              <th style={adminThStyle}>Status</th>
              <th style={adminThStyle}>Agendado</th>
              <th style={adminThStyle}>Plataformas</th>
              <th style={adminThStyle}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((post) => (
              <tr key={post.id}>
                <td style={adminTdStyle}>{post.eventType}</td>
                <td style={adminTdStyle}>
                  {post.entityType} #{post.entityId}
                </td>
                <td style={adminTdStyle}>
                  <select
                    value={post.priority}
                    onChange={(e) => callAction(post.id, { action: "priority", priority: e.target.value })}
                    style={{ ...adminInputStyle, width: 110 }}
                  >
                    {["CRITICAL", "HIGH", "NORMAL", "LOW"].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={adminTdStyle}>
                  <span style={{ color: STATUS_COLORS[post.status] ?? "var(--text)", fontWeight: 700 }}>{post.status}</span>
                  {post.lastError && (
                    <div title={post.lastError} style={{ fontSize: 11, color: "#FF3B30", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {post.lastError}
                    </div>
                  )}
                </td>
                <td style={adminTdStyle}>
                  <input
                    type="datetime-local"
                    defaultValue={post.scheduledAt ? toDatetimeLocal(post.scheduledAt) : ""}
                    onBlur={(e) => e.target.value && callAction(post.id, { action: "reschedule", scheduledAt: new Date(e.target.value).toISOString() })}
                    style={{ ...adminInputStyle, width: 190 }}
                  />
                </td>
                <td style={adminTdStyle}>
                  {post.publications.map((pub) => (
                    <div key={pub.id} style={{ fontSize: 11 }}>
                      {pub.platform}: <span style={{ color: pub.status === "PUBLISHED" ? "#2EB550" : pub.status === "FAILED" ? "#FF3B30" : "var(--text-muted)" }}>{pub.status}</span>
                    </div>
                  ))}
                </td>
                <td style={adminTdStyle}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {post.imageFeed45 && (
                      <a href={post.imageFeed45} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>
                        preview arte
                      </a>
                    )}
                    <button disabled={busyId === post.id} onClick={() => callAction(post.id, { action: "publish-now" })} style={actionBtnStyle}>
                      Publicar agora
                    </button>
                    <button disabled={busyId === post.id} onClick={() => callAction(post.id, { action: "retry" })} style={actionBtnStyle}>
                      Tentar de novo
                    </button>
                    <button disabled={busyId === post.id} onClick={() => callAction(post.id, { action: "cancel" })} style={{ ...actionBtnStyle, color: "#FF3B30" }}>
                      Cancelar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  fontSize: 11,
  padding: "4px 8px",
  borderRadius: 8,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  color: "var(--text)",
  cursor: "pointer",
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

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Bug, Lightbulb, ArrowLeft, Send, Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useTranslations } from "@/hooks/useTranslations";

type TicketType = "BUG" | "SUGGESTION";
type TicketStatus = "OPEN" | "IN_PROGRESS" | "CLOSED";

type TicketUser = {
  id: string;
  handle: string;
  name: string;
  avatarColor: string;
  image: string | null;
};

type TicketSummary = {
  id: string;
  type: TicketType;
  subject: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  messageCount: number;
  user: TicketUser;
};

type TicketMessage = {
  id: string;
  body: string;
  isStaff: boolean;
  createdAt: string;
  user: TicketUser;
};

type TicketDetail = TicketSummary & { messages: TicketMessage[] };

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusStyle(status: TicketStatus): React.CSSProperties {
  const colors: Record<TicketStatus, { bg: string; color: string }> = {
    OPEN: { bg: "rgba(52,199,89,0.12)", color: "#34C759" },
    IN_PROGRESS: { bg: "rgba(255,149,0,0.12)", color: "#FF9500" },
    CLOSED: { bg: "var(--fill-inset)", color: "var(--text-muted)" },
  };
  const c = colors[status];
  return {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 100,
    background: c.bg,
    color: c.color,
    flexShrink: 0,
  };
}

export function AdminSupportClient() {
  const { t } = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketId = searchParams.get("ticket");
  const statusFilter = (searchParams.get("status") as TicketStatus | null) ?? null;

  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/support/tickets${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error("load_failed");
      setTickets((await res.json()) as TicketSummary[]);
    } catch {
      setError(t("support.errorLoad"));
    } finally {
      setListLoading(false);
    }
  }, [statusFilter, t]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/support/tickets/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("load_failed");
      setDetail((await res.json()) as TicketDetail);
    } catch {
      setError(t("support.errorLoad"));
    } finally {
      setDetailLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (ticketId) {
      void loadDetail(ticketId);
    } else {
      setDetail(null);
      void loadTickets();
    }
  }, [ticketId, statusFilter, loadDetail, loadTickets]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!detail || !reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/support/tickets/${detail.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply }),
      });
      if (!res.ok) throw new Error("send_failed");
      const msg = (await res.json()) as TicketMessage;
      setDetail((d) =>
        d ? { ...d, messages: [...d.messages, msg], status: d.status === "OPEN" ? "IN_PROGRESS" : d.status } : d,
      );
      setReply("");
    } catch {
      setError(t("support.errorSend"));
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(status: TicketStatus) {
    if (!detail) return;
    setUpdatingStatus(true);
    setError(null);
    try {
      const res = await fetch(`/api/support/tickets/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("status_failed");
      const updated = (await res.json()) as TicketSummary;
      setDetail((d) => (d ? { ...d, status: updated.status } : d));
    } catch {
      setError(t("support.errorStatus"));
    } finally {
      setUpdatingStatus(false);
    }
  }

  const statusLabel = (s: TicketStatus) => {
    if (s === "OPEN") return t("support.statusOpen");
    if (s === "IN_PROGRESS") return t("support.statusInProgress");
    return t("support.statusClosed");
  };

  const filters: { value: TicketStatus | null; label: string }[] = [
    { value: null, label: t("support.filterAll") },
    { value: "OPEN", label: t("support.statusOpen") },
    { value: "IN_PROGRESS", label: t("support.statusInProgress") },
    { value: "CLOSED", label: t("support.statusClosed") },
  ];

  if (ticketId) {
    return (
      <div style={{ maxWidth: 760 }}>
        <button
          type="button"
          onClick={() => router.push("/admin/support")}
          style={backBtnStyle}
        >
          <ArrowLeft size={16} />
          {t("support.backToList")}
        </button>

        {detailLoading || !detail ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <Loader2 size={24} style={{ color: "var(--text-muted)" }} />
          </div>
        ) : (
          <>
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                <Avatar
                  user={{ name: detail.user.name, avatar: detail.user.avatarColor }}
                  imageUrl={detail.user.image}
                  size={40}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{detail.user.name}</div>
                  <Link
                    href={`/profile/${detail.user.handle}`}
                    style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}
                  >
                    @{detail.user.handle}
                  </Link>
                </div>
                <span style={statusStyle(detail.status)}>{statusLabel(detail.status)}</span>
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 6px" }}>{detail.subject}</h2>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                {detail.type === "BUG" ? "Bug" : "Sugestão"} · {formatDate(detail.createdAt)}
              </p>

              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                {(["OPEN", "IN_PROGRESS", "CLOSED"] as TicketStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={updatingStatus || detail.status === s}
                    onClick={() => void changeStatus(s)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 100,
                      border: detail.status === s ? "2px solid var(--accent)" : "1px solid var(--divider-strong)",
                      background: detail.status === s ? "var(--accent-tint)" : "var(--surface)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: detail.status === s ? "default" : "pointer",
                      color: "var(--text)",
                    }}
                  >
                    {statusLabel(s)}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              {detail.messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    flexDirection: msg.isStaff ? "row-reverse" : "row",
                  }}
                >
                  <Avatar
                    user={{ name: msg.user.name, avatar: msg.user.avatarColor }}
                    imageUrl={msg.user.image}
                    size={36}
                  />
                  <div
                    style={{
                      maxWidth: "78%",
                      borderRadius: 14,
                      padding: "12px 14px",
                      background: msg.isStaff ? "var(--accent-tint)" : "var(--fill-inset)",
                      border: "1px solid var(--divider)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>
                        {msg.isStaff ? msg.user.name : detail.user.name}
                        {msg.isStaff && (
                          <span style={{ fontSize: 11, color: "var(--accent)", marginLeft: 6 }}>staff</span>
                        )}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {formatDate(msg.createdAt)}
                      </span>
                    </div>
                    <p style={{ fontSize: 14, lineHeight: 1.55, margin: 0, whiteSpace: "pre-wrap" }}>{msg.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleReply} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                maxLength={4000}
                placeholder={t("support.adminReplyPlaceholder")}
                style={textareaStyle}
              />
              <button type="submit" disabled={sending || !reply.trim()} style={sendBtnStyle}>
                {sending ? <Loader2 size={16} /> : <Send size={16} />}
                {t("support.send")}
              </button>
            </form>

            {error && <p style={{ color: "#FF3B30", fontSize: 13, marginTop: 12 }}>{error}</p>}
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {filters.map((f) => {
          const active = statusFilter === f.value;
          const href = f.value ? `/admin/support?status=${f.value}` : "/admin/support";
          return (
            <Link
              key={f.label}
              href={href}
              style={{
                padding: "6px 14px",
                borderRadius: 100,
                fontSize: 12,
                fontWeight: 600,
                textDecoration: "none",
                border: active ? "2px solid var(--accent)" : "1px solid var(--divider-strong)",
                background: active ? "var(--accent-tint)" : "var(--surface)",
                color: active ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {listLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <Loader2 size={24} style={{ color: "var(--text-muted)" }} />
        </div>
      ) : tickets.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{t("support.adminEmpty")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/admin/support?ticket=${ticket.id}`}
              style={{
                display: "block",
                borderRadius: 12,
                border: "1px solid var(--divider)",
                background: "var(--surface)",
                padding: "14px 16px",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                {ticket.type === "BUG" ? (
                  <Bug size={14} color="#FF3B30" />
                ) : (
                  <Lightbulb size={14} color="#5856D6" />
                )}
                <span style={statusStyle(ticket.status)}>{statusLabel(ticket.status)}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
                  {formatDate(ticket.lastMessageAt)}
                </span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{ticket.subject}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                @{ticket.user.handle} · {ticket.messageCount}{" "}
                {ticket.messageCount === 1 ? t("support.message") : t("support.messages")}
              </div>
            </Link>
          ))}
        </div>
      )}

      {error && <p style={{ color: "#FF3B30", fontSize: 13, marginTop: 12 }}>{error}</p>}
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  border: "none",
  background: "none",
  color: "var(--text-muted)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  marginBottom: 20,
  padding: 0,
};

const cardStyle: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid var(--divider)",
  background: "var(--surface)",
  padding: "18px 20px",
  marginBottom: 20,
};

const textareaStyle: React.CSSProperties = {
  flex: 1,
  padding: "11px 14px",
  borderRadius: 10,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  fontSize: 14,
  color: "var(--text)",
  resize: "vertical",
  minHeight: 72,
  outline: "none",
};

const sendBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 18px",
  borderRadius: 100,
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  flexShrink: 0,
};

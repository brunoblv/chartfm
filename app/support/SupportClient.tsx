"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bug, Lightbulb, MessageSquarePlus, ArrowLeft, Send, Loader2 } from "lucide-react";
import { InstitutionalLayout } from "@/components/institutional/InstitutionalLayout";
import { InstitutionalTitle } from "@/components/institutional/InstitutionalPrimitives";
import { Avatar } from "@/components/ui/Avatar";
import {
  SUPPORT_MESSAGE_MIN,
  SUPPORT_SUBJECT_MIN,
  supportTicketErrorKey,
  validateSupportTicketCreate,
} from "@/lib/support-ticket-validation";
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

function TypeBadge({ type }: { type: TicketType }) {
  const isBug = type === "BUG";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 700,
        color: isBug ? "#FF3B30" : "#5856D6",
      }}
    >
      {isBug ? <Bug size={12} /> : <Lightbulb size={12} />}
      {isBug ? "Bug" : "Sugestão"}
    </span>
  );
}

export function SupportClient() {
  const { status } = useSession();
  const { t } = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketId = searchParams.get("ticket");
  const showNew = searchParams.get("new") === "1";

  const authed = status === "authenticated";
  const loading = status === "loading";

  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newType, setNewType] = useState<TicketType>("BUG");
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [creating, setCreating] = useState(false);

  const loadTickets = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/support/tickets", { cache: "no-store" });
      if (!res.ok) throw new Error("load_failed");
      setTickets((await res.json()) as TicketSummary[]);
    } catch {
      setError(t("support.errorLoad"));
    } finally {
      setListLoading(false);
    }
  }, [t]);

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
    if (!authed) return;
    if (ticketId) {
      void loadDetail(ticketId);
    } else {
      setDetail(null);
      void loadTickets();
    }
  }, [authed, ticketId, loadDetail, loadTickets]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);

    const subject = newSubject.trim();
    const message = newMessage.trim();
    const local = validateSupportTicketCreate({ type: newType, subject, message });
    if (!local.ok) {
      setError(t(`support.${supportTicketErrorKey(local.error)}`));
      setCreating(false);
      return;
    }

    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(local.data),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
      if (!res.ok) {
        setError(t(`support.${supportTicketErrorKey(payload.error)}`));
        return;
      }
      const created = payload as TicketSummary;
      router.push(`/support?ticket=${created.id}`);
    } catch {
      setError(t("support.errorCreate"));
    } finally {
      setCreating(false);
    }
  }

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
      setDetail((d) => (d ? { ...d, messages: [...d.messages, msg] } : d));
      setReply("");
    } catch {
      setError(t("support.errorSend"));
    } finally {
      setSending(false);
    }
  }

  const statusLabel = (s: TicketStatus) => {
    if (s === "OPEN") return t("support.statusOpen");
    if (s === "IN_PROGRESS") return t("support.statusInProgress");
    return t("support.statusClosed");
  };

  return (
    <InstitutionalLayout>
      <InstitutionalTitle subtitle={t("support.subtitle")}>{t("support.title")}</InstitutionalTitle>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <Loader2 size={24} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />
        </div>
      ) : !authed ? (
        <div
          style={{
            borderRadius: 14,
            border: "1px solid var(--divider)",
            background: "var(--surface)",
            padding: 28,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 15, color: "var(--text-subtle)", margin: "0 0 20px", lineHeight: 1.6 }}>
            {t("support.loginRequired")}
          </p>
          <Link
            href="/login"
            style={{
              display: "inline-block",
              padding: "10px 24px",
              borderRadius: 100,
              background: "var(--accent)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {t("nav.signIn")}
          </Link>
        </div>
      ) : showNew ? (
        <div style={{ maxWidth: 560 }}>
          <button
            type="button"
            onClick={() => router.push("/support")}
            style={{
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
            }}
          >
            <ArrowLeft size={16} />
            {t("support.backToList")}
          </button>

          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>{t("support.typeLabel")}</label>
              <div style={{ display: "flex", gap: 10 }}>
                {(["BUG", "SUGGESTION"] as TicketType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setNewType(type)}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: newType === type ? "2px solid var(--accent)" : "1px solid var(--divider-strong)",
                      background: newType === type ? "var(--accent-tint)" : "var(--surface)",
                      color: "var(--text)",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {type === "BUG" ? <Bug size={16} /> : <Lightbulb size={16} />}
                    {type === "BUG" ? t("support.typeBug") : t("support.typeSuggestion")}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>{t("support.subjectLabel")}</label>
              <input
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                minLength={SUPPORT_SUBJECT_MIN}
                maxLength={120}
                required
                placeholder={t("support.subjectPlaceholder")}
                style={inputStyle}
              />
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 0" }}>
                {t("support.subjectHint")}
              </p>
            </div>

            <div>
              <label style={labelStyle}>{t("support.messageLabel")}</label>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                minLength={SUPPORT_MESSAGE_MIN}
                required
                rows={6}
                maxLength={4000}
                placeholder={t("support.messagePlaceholder")}
                style={{ ...inputStyle, resize: "vertical", minHeight: 120 }}
              />
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 0" }}>
                {t("support.messageHint")}
              </p>
            </div>

            {error && <p style={{ color: "#FF3B30", fontSize: 13, margin: 0 }}>{error}</p>}

            <button type="submit" disabled={creating} style={primaryBtnStyle}>
              {creating ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <MessageSquarePlus size={16} />}
              {t("support.createTicket")}
            </button>
          </form>
        </div>
      ) : ticketId ? (
        <div style={{ maxWidth: 680, minWidth: 0, width: "100%" }}>
          <button
            type="button"
            onClick={() => router.push("/support")}
            style={{
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
            }}
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
              <div
                style={{
                  borderRadius: 14,
                  border: "1px solid var(--divider)",
                  background: "var(--surface)",
                  padding: "18px 20px",
                  marginBottom: 20,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                  <TypeBadge type={detail.type} />
                  <span style={statusStyle(detail.status)}>{statusLabel(detail.status)}</span>
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
                  {detail.subject}
                </h2>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                  {t("support.openedAt")} {formatDate(detail.createdAt)}
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20, minWidth: 0, width: "100%" }}>
                {detail.messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      gap: 12,
                      flexDirection: msg.isStaff ? "row" : "row-reverse",
                      minWidth: 0,
                      width: "100%",
                    }}
                  >
                    <div style={{ flexShrink: 0 }}>
                      <Avatar
                        user={{ name: msg.user.name, avatar: msg.user.avatarColor }}
                        imageUrl={msg.user.image}
                        size={36}
                      />
                    </div>
                    <div
                      style={{
                        maxWidth: "78%",
                        minWidth: 0,
                        flex: "1 1 auto",
                        borderRadius: 14,
                        padding: "12px 14px",
                        background: msg.isStaff ? "var(--accent-tint)" : "var(--fill-inset)",
                        border: msg.isStaff ? "1px solid rgba(250,36,60,0.15)" : "1px solid var(--divider)",
                        overflow: "hidden",
                        boxSizing: "border-box",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 6,
                          flexWrap: "wrap",
                          minWidth: 0,
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 700, minWidth: 0 }}>
                          {msg.isStaff ? t("support.teamChartfm") : msg.user.name}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                          {formatDate(msg.createdAt)}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: 14,
                          lineHeight: 1.55,
                          margin: 0,
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                          wordBreak: "break-word",
                        }}
                      >
                        {msg.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {detail.status !== "CLOSED" ? (
                <form onSubmit={handleReply} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={3}
                    maxLength={4000}
                    placeholder={t("support.replyPlaceholder")}
                    style={{ ...inputStyle, flex: 1, resize: "vertical", minHeight: 72 }}
                  />
                  <button type="submit" disabled={sending || !reply.trim()} style={primaryBtnStyle}>
                    {sending ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={16} />}
                    {t("support.send")}
                  </button>
                </form>
              ) : (
                <p style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>
                  {t("support.ticketClosed")}
                </p>
              )}

              {error && <p style={{ color: "#FF3B30", fontSize: 13, marginTop: 12 }}>{error}</p>}
            </>
          )}
        </div>
      ) : (
        <div style={{ maxWidth: 680, minWidth: 0, width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
            <Link href="/support?new=1" style={{ ...primaryBtnStyle, textDecoration: "none" }}>
              <MessageSquarePlus size={16} />
              {t("support.newTicket")}
            </Link>
          </div>

          {listLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
              <Loader2 size={24} style={{ color: "var(--text-muted)" }} />
            </div>
          ) : tickets.length === 0 ? (
            <div
              style={{
                borderRadius: 14,
                border: "1px dashed var(--divider-strong)",
                padding: 40,
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: 15, color: "var(--text-muted)", margin: "0 0 16px" }}>
                {t("support.empty")}
              </p>
              <Link href="/support?new=1" style={{ color: "var(--accent)", fontWeight: 600, fontSize: 14 }}>
                {t("support.createFirst")}
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {tickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/support?ticket=${ticket.id}`}
                  style={{
                    display: "block",
                    borderRadius: 12,
                    border: "1px solid var(--divider)",
                    background: "var(--surface)",
                    padding: "14px 16px",
                    textDecoration: "none",
                    color: "inherit",
                    transition: "border-color 120ms",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <TypeBadge type={ticket.type} />
                    <span style={statusStyle(ticket.status)}>{statusLabel(ticket.status)}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
                      {formatDate(ticket.lastMessageAt)}
                    </span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>{ticket.subject}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    {ticket.messageCount} {ticket.messageCount === 1 ? t("support.message") : t("support.messages")}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {error && <p style={{ color: "#FF3B30", fontSize: 13, marginTop: 12 }}>{error}</p>}
        </div>
      )}
    </InstitutionalLayout>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text-muted)",
  marginBottom: 8,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
  boxSizing: "border-box",
};

const primaryBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
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

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/time-ago";
import { useTranslations } from "@/hooks/useTranslations";

export type NotifRow = {
  id: string;
  type: string;
  text: string;
  targetUrl: string | null;
  read: boolean;
  createdAt: string;
  actor: {
    id: string;
    handle: string;
    name: string;
    avatarColor: string;
    image: string | null;
  } | null;
  isFollowingBack?: boolean;
};

export function NotificationsClient({ initial }: { initial: NotifRow[] }) {
  const { t } = useTranslations();
  const [items, setItems] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [followedBack, setFollowedBack] = useState<Set<string>>(
    () => new Set(initial.filter((n) => n.isFollowingBack).map((n) => n.id))
  );

  const unreadCount = items.filter((n) => !n.read).length;

  function markAllRead() {
    startTransition(async () => {
      await fetch("/api/notifications", { method: "PATCH" });
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    });
  }

  async function followBack(actorId: string, notifId: string) {
    await fetch("/api/user/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId: actorId }),
    });
    setFollowedBack((prev) => new Set(prev).add(notifId));
  }

  return (
    <>
      {unreadCount > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button
            onClick={markAllRead}
            disabled={isPending}
            style={{
              background: "none",
              border: "none",
              color: "#FA243C",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              padding: "4px 0",
              opacity: isPending ? 0.5 : 1,
            }}
          >
            {t("notifications.markAllRead")}
          </button>
        </div>
      )}

      <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", overflow: "hidden" }}>
        {items.length === 0 && (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
            {t("notifications.empty")}
          </div>
        )}
        {items.map((n, i) => {
          const actor = n.actor;
          const avatarUser = actor
            ? { name: actor.name, avatar: actor.avatarColor }
            : null;

          return (
            <div
              key={n.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                padding: "16px 20px",
                borderBottom: i < items.length - 1 ? "1px solid var(--divider-soft)" : "none",
                background: !n.read ? "rgba(250,36,60,0.02)" : "transparent",
              }}
            >
              {n.type === "global_chart" ? (
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: "linear-gradient(135deg, #1D1D1F, #3A3A3C)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                  }}
                >
                  🌐
                </div>
              ) : n.type === "global_airplay" ? (
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: "linear-gradient(135deg, #8338EC, #3A86FF)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                  }}
                >
                  📻
                </div>
              ) : n.type === "global_albums" ? (
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: "linear-gradient(135deg, #06D6A0, #073B4C)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                  }}
                >
                  💿
                </div>
              ) : n.type === "milestone" || !actor ? (
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: "linear-gradient(135deg, #FFD166, #FA243C)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                  }}
                >
                  🏆
                </div>
              ) : (
                <Link href={`/profile/${actor.handle}`}>
                  <Avatar user={avatarUser!} imageUrl={actor.image} size={44} />
                </Link>
              )}

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text)" }}>
                  {actor && (
                    <Link
                      href={`/profile/${actor.handle}`}
                      style={{ fontWeight: 700, textDecoration: "none", color: "inherit" }}
                    >
                      {actor.name}{" "}
                    </Link>
                  )}
                  {n.targetUrl ? (
                    <Link href={n.targetUrl} style={{ textDecoration: "none", color: "inherit" }}>
                      {n.text}
                    </Link>
                  ) : (
                    n.text
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  {timeAgo(n.createdAt)}
                </div>
                {n.type === "follow" && actor && !followedBack.has(n.id) && (
                  <button
                    onClick={() => followBack(actor.id, n.id)}
                    style={{
                      marginTop: 10,
                      background: "var(--btn-dark-bg)",
                      color: "var(--btn-dark-fg)",
                      border: "none",
                      padding: "6px 16px",
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {t("notifications.followBack")}
                  </button>
                )}
                {n.type === "follow" && actor && followedBack.has(n.id) && (
                  <span style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
                    {t("notifications.following")}
                  </span>
                )}
              </div>

              {!n.read && (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#FA243C",
                    flexShrink: 0,
                    marginTop: 6,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

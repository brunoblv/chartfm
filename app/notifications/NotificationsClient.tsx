"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/time-ago";

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
};

export function NotificationsClient({ initial }: { initial: NotifRow[] }) {
  const [items, setItems] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [followedBack, setFollowedBack] = useState<Set<string>>(new Set());

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
            Marcar tudo como lido
          </button>
        </div>
      )}

      <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
        {items.length === 0 && (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "#86868B", fontSize: 14 }}>
            Nenhuma notificação por aqui ainda.
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
                borderBottom: i < items.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                background: !n.read ? "rgba(250,36,60,0.02)" : "transparent",
              }}
            >
              {n.type === "milestone" || !actor ? (
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
                <div style={{ fontSize: 14, lineHeight: 1.5, color: "#1D1D1F" }}>
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
                <div style={{ fontSize: 12, color: "#86868B", marginTop: 4 }}>
                  {timeAgo(n.createdAt)}
                </div>
                {n.type === "follow" && actor && !followedBack.has(n.id) && (
                  <button
                    onClick={() => followBack(actor.id, n.id)}
                    style={{
                      marginTop: 10,
                      background: "#1D1D1F",
                      color: "white",
                      border: "none",
                      padding: "6px 16px",
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Seguir de volta
                  </button>
                )}
                {n.type === "follow" && actor && followedBack.has(n.id) && (
                  <span style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: "#86868B" }}>
                    Seguindo
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

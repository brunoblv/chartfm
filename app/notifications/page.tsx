import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { Avatar } from "@/components/ui/Avatar";
import { NOTIFICATIONS } from "@/lib/data";

export default function NotificationsPage() {
  const unreadCount = NOTIFICATIONS.filter((n) => n.unread).length;

  return (
    <Shell title="Notificações" subtitle={`${unreadCount} não lidas`}>
      <div style={{ maxWidth: 680 }}>
        <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
          {NOTIFICATIONS.map((n, i) => (
            <div
              key={n.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                padding: "16px 20px",
                borderBottom: i < NOTIFICATIONS.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                background: n.unread ? "rgba(250,36,60,0.02)" : "transparent",
              }}
            >
              {/* Avatar or milestone icon */}
              {n.type === "milestone" ? (
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg, #FFD166, #FA243C)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20,
                }}>
                  🏆
                </div>
              ) : n.user ? (
                <Link href={`/profile/${n.user.handle}`}>
                  <Avatar user={n.user} size={44} />
                </Link>
              ) : null}

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, lineHeight: 1.5, color: "#1D1D1F" }}>
                  {n.user && (
                    <Link href={`/profile/${n.user.handle}`} style={{ fontWeight: 700, textDecoration: "none", color: "inherit" }}>
                      {n.user.name}{" "}
                    </Link>
                  )}
                  {n.text}
                  {n.target && (
                    <span style={{ color: "#FA243C", fontWeight: 600 }}> {n.target}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#86868B", marginTop: 4 }}>{n.time}</div>
                {n.type === "follow" && (
                  <button style={{
                    marginTop: 10, background: "#1D1D1F", color: "white", border: "none",
                    padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                  }}>
                    Seguir de volta
                  </button>
                )}
              </div>

              {/* Unread dot */}
              {n.unread && (
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#FA243C", flexShrink: 0, marginTop: 6,
                }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

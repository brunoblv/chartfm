"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell } from "lucide-react";

export function NotificationBell({ size = 20 }: { size?: number }) {
  const { status } = useSession();
  const authed = status === "authenticated";
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!authed) {
      setUnreadCount(0);
      return;
    }
    if (pathname === "/notifications") {
      setUnreadCount(0);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const rows = (await res.json()) as Array<{ read: boolean }>;
        if (!cancelled) {
          setUnreadCount(rows.filter((r) => !r.read).length);
        }
      } catch {
        if (!cancelled) setUnreadCount(0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authed, pathname]);

  useEffect(() => {
    if (!authed) return;
    function onNotificationsRead() {
      setUnreadCount(0);
    }
    window.addEventListener("notifications-read", onNotificationsRead);
    return () => window.removeEventListener("notifications-read", onNotificationsRead);
  }, [authed]);

  return (
    <Link
      href={authed ? "/notifications" : "/login"}
      aria-label="Notificações"
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text)",
        textDecoration: "none",
        padding: 4,
        flexShrink: 0,
      }}
    >
      <Bell size={size} strokeWidth={1.8} />
      {authed && unreadCount > 0 && (
        <span
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--accent)",
            boxShadow: "0 0 0 2px var(--bg-topbar)",
          }}
        />
      )}
    </Link>
  );
}

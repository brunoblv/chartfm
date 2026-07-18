"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const SESSION_KEY = "cfm_sid";
const SESSION_IDLE_MS = 30 * 60 * 1000; // 30 min sem atividade rotaciona a sessão
const HEARTBEAT_MS = 60 * 1000;

// Espelha o id em cookie (não-httpOnly) para o servidor conseguir vincular
// eventos server-side (ex: cadastro) à mesma sessão do tracking client-side.
function syncSessionCookie(id: string) {
  try {
    document.cookie = `${SESSION_KEY}=${id}; Max-Age=${Math.floor(SESSION_IDLE_MS / 1000)}; Path=/; SameSite=Lax`;
  } catch {
    // cookies indisponíveis — segue só com localStorage
  }
}

function getSessionId(): string {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const { id, ts } = JSON.parse(raw) as { id: string; ts: number };
      if (id && Date.now() - ts < SESSION_IDLE_MS) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ id, ts: Date.now() }));
        syncSessionCookie(id);
        return id;
      }
    }
  } catch {
    // localStorage indisponível ou corrompido — gera id novo
  }
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id, ts: Date.now() }));
  } catch {
    // sem persistência: sessão vale só para esta página
  }
  syncSessionCookie(id);
  return id;
}

function send(type: "pageview" | "heartbeat", path: string, referrer?: string) {
  const payload = JSON.stringify({
    type,
    path,
    sessionId: getSessionId(),
    referrer: referrer || undefined,
    device: window.innerWidth < 768 ? "mobile" : "desktop",
  });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/track", new Blob([payload], { type: "application/json" }));
      return;
    }
  } catch {
    // sendBeacon bloqueado — cai no fetch
  }
  fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  // Pageview a cada mudança de rota
  useEffect(() => {
    if (!pathname || pathname === lastPath.current) return;
    const referrer = lastPath.current === null ? document.referrer : undefined;
    lastPath.current = pathname;
    send("pageview", pathname, referrer);
  }, [pathname]);

  // Heartbeat a cada 60s enquanto a aba está visível (mede tempo real no site)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && lastPath.current) {
        send("heartbeat", lastPath.current);
      }
    }, HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, []);

  return null;
}

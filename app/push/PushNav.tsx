"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap } from "lucide-react";

const NAV = [
  { href: "/push/sobre", label: "Sobre" },
  { href: "/push", label: "Início", exact: true },
  { href: "/push/ranking", label: "Ranking" },
  { href: "/push/historico", label: "Histórico" },
];

export function PushNav() {
  const pathname = usePathname();

  return (
    <div
      style={{
        borderBottom: "1px solid var(--divider)",
        background: "var(--surface)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 24px 0",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "linear-gradient(135deg, var(--accent), #FF7070)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <Zap size={15} color="#fff" fill="#fff" />
        </div>
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            Push
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginTop: 2,
            }}
          >
            Jogo de descoberta musical
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 2,
          padding: "0 16px",
          marginTop: 10,
          overflowX: "auto",
        }}
      >
        {NAV.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "9px 14px",
                borderRadius: "8px 8px 0 0",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
                whiteSpace: "nowrap",
                borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                color: isActive ? "var(--text)" : "var(--text-muted)",
                transition: "color 0.1s",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/copa", label: "Início", exact: true },
  { href: "/copa/ao-vivo", label: "Ao Vivo" },
  { href: "/copa/meu-time", label: "Meu Time" },
  { href: "/copa/grupos", label: "Grupos" },
  { href: "/copa/chaveamento", label: "Chaveamento" },
];

export function CopaNav() {
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
            background: "#FFD426",
            display: "grid",
            placeItems: "center",
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          🏆
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
            Copa ChartFM
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginTop: 2,
            }}
          >
            Torneio Musical
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

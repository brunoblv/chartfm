"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Search } from "lucide-react";

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const { status } = useSession();
  const authed = status === "authenticated";

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        padding: "18px 40px",
        background: "rgba(251,251,253,0.82)",
        backdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 13, color: "#86868B", marginTop: 1 }}>{subtitle}</div>
        )}
      </div>

      {/* Search box */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "rgba(120,120,128,0.1)",
        borderRadius: 8,
        padding: "8px 12px",
        width: 220,
      }}>
        <Search size={14} color="#86868B" />
        <input
          type="text"
          placeholder="Buscar..."
          style={{
            border: "none",
            background: "transparent",
            outline: "none",
            fontSize: 14,
            color: "#1D1D1F",
            width: "100%",
          }}
        />
      </div>

      {!authed && (
        <Link
          href="/login"
          style={{
            color: "#1D1D1F",
            textDecoration: "none",
            padding: "8px 14px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            border: "1px solid rgba(0,0,0,0.12)",
          }}
        >
          Entrar
        </Link>
      )}
      <Link
        href="/create"
        style={{
          background: "#1D1D1F",
          color: "white",
          textDecoration: "none",
          padding: "8px 14px",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          whiteSpace: "nowrap",
        }}
      >
        Nova parada
      </Link>
    </div>
  );
}

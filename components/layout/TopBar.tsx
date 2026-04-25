"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Search, Menu, Plus } from "lucide-react";

interface TopBarProps {
  title: string;
  subtitle?: string;
  isMobile?: boolean;
  onMenuToggle?: () => void;
}

export function TopBar({ title, subtitle, isMobile = false, onMenuToggle }: TopBarProps) {
  const { status } = useSession();
  const authed = status === "authenticated";

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        padding: isMobile ? "14px 16px" : "18px 40px",
        background: "rgba(251,251,253,0.92)",
        backdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        display: "flex",
        alignItems: "center",
        gap: isMobile ? 10 : 16,
      }}
    >
      {isMobile && (
        <button
          onClick={onMenuToggle}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            display: "flex",
            alignItems: "center",
            color: "#1D1D1F",
            flexShrink: 0,
          }}
        >
          <Menu size={22} />
        </button>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: isMobile ? 16 : 18,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
        {subtitle && !isMobile && (
          <div style={{ fontSize: 13, color: "#86868B", marginTop: 1 }}>{subtitle}</div>
        )}
      </div>

      {!isMobile && (
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
      )}

      {!authed && !isMobile && (
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

      {isMobile ? (
        <Link
          href="/create"
          style={{
            background: "#FA243C",
            color: "white",
            textDecoration: "none",
            width: 34,
            height: 34,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Plus size={18} />
        </Link>
      ) : (
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
      )}
    </div>
  );
}

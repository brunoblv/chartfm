"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Search, Menu, Plus, X } from "lucide-react";
import { SearchBar } from "./SearchBar";

interface TopBarProps {
  isMobile?: boolean;
  onMenuToggle?: () => void;
}

export function TopBar({ isMobile = false, onMenuToggle }: TopBarProps) {
  const { status } = useSession();
  const authed = status === "authenticated";
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(251,251,253,0.92)",
        backdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          padding: isMobile ? "14px 16px" : "18px 40px",
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

        {!isMobile && (
          <div style={{ flex: 1, maxWidth: 420 }}>
            <SearchBar />
          </div>
        )}

        <div style={{ flex: 1 }} />

        {isMobile && (
          <button
            onClick={() => setMobileSearchOpen((o) => !o)}
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
            {mobileSearchOpen ? <X size={20} /> : <Search size={20} />}
          </button>
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

        {isMobile && !authed ? (
          <Link
            href="/login"
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
              flexShrink: 0,
            }}
          >
            Entrar
          </Link>
        ) : isMobile ? (
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

      {isMobile && mobileSearchOpen && (
        <div
          style={{
            padding: "0 16px 12px",
            borderTop: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ paddingTop: 12 }}>
            <SearchBar
              autoFocus
              onClose={() => setMobileSearchOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

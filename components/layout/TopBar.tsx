"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Bell, X, Globe, Award } from "lucide-react";
import { SearchBar } from "./SearchBar";
import { ChartFMLogo } from "@/components/ui/ChartFMLogo";

interface TopBarProps {
  isMobile?: boolean;
  onMenuToggle?: () => void;
}

export function TopBar({ isMobile = false }: TopBarProps) {
  const { status } = useSession();
  const authed = status === "authenticated";
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const pathname = usePathname();

  if (isMobile) {
    return (
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(251,251,253,0.92)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: mobileSearchOpen ? "1px solid rgba(0,0,0,0.06)" : "none",
        }}
      >
        <div style={{ padding: "12px 16px 10px", display: "flex", alignItems: "center", gap: 10 }}>
          {/* Logo */}
          <ChartFMLogo size={30} />

          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.025em", color: "#1D1D1F" }}>
            ChartFM
          </span>

          <div style={{ flex: 1 }} />

          {/* Global 100 */}
          <Link
            href="/global"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", color: pathname === "/global" || pathname.startsWith("/global/") ? "#FA243C" : "#86868B", textDecoration: "none", padding: 4 }}
          >
            <Globe size={20} strokeWidth={pathname === "/global" || pathname.startsWith("/global/") ? 2.2 : 1.8} />
          </Link>

          {/* CriticsFM */}
          <Link
            href="/criticsfm"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", color: pathname === "/criticsfm" || pathname.startsWith("/criticsfm/") ? "#FA243C" : "#86868B", textDecoration: "none", padding: 4 }}
          >
            <Award size={20} strokeWidth={pathname === "/criticsfm" || pathname.startsWith("/criticsfm/") ? 2.2 : 1.8} />
          </Link>

          {/* Search toggle */}
          <button
            onClick={() => setMobileSearchOpen((o) => !o)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: "#1D1D1F" }}
          >
            {mobileSearchOpen
              ? <X size={20} />
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            }
          </button>

          {/* Notification bell */}
          <Link
            href={authed ? "/notifications" : "/login"}
            style={{ position: "relative", display: "flex", alignItems: "center", color: "#1D1D1F", textDecoration: "none", padding: 4 }}
          >
            <Bell size={20} strokeWidth={1.8} />
          </Link>
        </div>

        {mobileSearchOpen && (
          <div style={{ padding: "0 16px 12px" }}>
            <SearchBar autoFocus onClose={() => setMobileSearchOpen(false)} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(251,251,253,0.92)",
        backdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        padding: "18px 40px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div style={{ flex: 1, maxWidth: 420 }}>
        <SearchBar />
      </div>
      <div style={{ flex: 1 }} />
      {!authed && (
        <Link
          href="/login"
          style={{
            color: "#1D1D1F", textDecoration: "none",
            padding: "8px 14px", borderRadius: 8,
            fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em",
            whiteSpace: "nowrap", border: "1px solid rgba(0,0,0,0.12)",
          }}
        >
          Entrar
        </Link>
      )}
      <Link
        href="/create"
        style={{
          background: "#1D1D1F", color: "white", textDecoration: "none",
          padding: "8px 14px", borderRadius: 8,
          fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap",
        }}
      >
        Nova parada
      </Link>
    </div>
  );
}

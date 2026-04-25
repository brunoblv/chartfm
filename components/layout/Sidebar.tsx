"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Home, Search, Globe, Users, Bell, Plus, User, Flame, LogOut, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { CURRENT_USER } from "@/lib/data";

const NAV = [
  { href: "/", label: "Início", icon: Home },
  { href: "/discover", label: "Descobrir", icon: Search },
  { href: "/global", label: "Parada Global", icon: Globe },
  { href: "/communities", label: "Comunidades", icon: Users },
  { href: "/notifications", label: "Notificações", icon: Bell, badge: 3 },
];

interface SidebarProps {
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isMobile = false, isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const authed = status === "authenticated" && session?.user?.handle;
  const profileHandle = authed ? session.user.handle! : CURRENT_USER.handle;
  const profilePath = `/profile/${profileHandle}`;
  const profileActive = pathname === profilePath || pathname.startsWith(`${profilePath}/`);

  const displayName = authed ? (session.user.name ?? "Usuário") : CURRENT_USER.name;
  const displayStreak = authed ? (session.user.streak ?? 0) : CURRENT_USER.streak;
  const avatarUser = authed ? { name: session!.user.name ?? "Usuário", avatar: "#FA243C" } : CURRENT_USER;

  const handleNavClick = () => {
    if (isMobile && onClose) onClose();
  };

  if (isMobile) {
    return (
      <>
        {/* Overlay */}
        {isOpen && (
          <div
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              zIndex: 190,
            }}
          />
        )}

        {/* Drawer */}
        <aside
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: 280,
            height: "100vh",
            background: "#F5F5F7",
            borderRight: "1px solid rgba(0,0,0,0.06)",
            padding: "22px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            overflowY: "auto",
            zIndex: 200,
            transform: isOpen ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 260ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <div style={{ padding: "4px 10px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #FA243C, #FF5858)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 12V9M7 12V6M11 12V3M15 12V7M19 12V5" />
                </svg>
              </div>
              <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em", color: "#1D1D1F" }}>Charts</span>
            </div>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: "#86868B" }}
            >
              <X size={20} />
            </button>
          </div>

          <SidebarContent
            pathname={pathname}
            profilePath={profilePath}
            profileActive={profileActive}
            displayName={displayName}
            displayStreak={displayStreak}
            avatarUser={avatarUser}
            authed={!!authed}
            session={session}
            onNavClick={handleNavClick}
          />
        </aside>
      </>
    );
  }

  return (
    <aside
      style={{
        width: 240,
        background: "#F5F5F7",
        borderRight: "1px solid rgba(0,0,0,0.06)",
        padding: "22px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
        flexShrink: 0,
      }}
    >
      <div style={{ padding: "4px 10px 16px 10px", display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "linear-gradient(135deg, #FA243C, #FF5858)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <path d="M3 12V9M7 12V6M11 12V3M15 12V7M19 12V5" />
          </svg>
        </div>
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em", color: "#1D1D1F" }}>Charts</span>
      </div>

      <SidebarContent
        pathname={pathname}
        profilePath={profilePath}
        profileActive={profileActive}
        displayName={displayName}
        displayStreak={displayStreak}
        avatarUser={avatarUser}
        authed={!!authed}
        session={session}
        onNavClick={() => {}}
      />
    </aside>
  );
}

function SidebarContent({
  pathname,
  profilePath,
  profileActive,
  displayName,
  displayStreak,
  avatarUser,
  authed,
  session,
  onNavClick,
}: {
  pathname: string;
  profilePath: string;
  profileActive: boolean;
  displayName: string;
  displayStreak: number;
  avatarUser: { name: string; avatar: string };
  authed: boolean;
  session: ReturnType<typeof useSession>["data"];
  onNavClick: () => void;
}) {
  return (
    <>
      {NAV.map(({ href, label, icon: Icon, badge }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavClick}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "9px 10px",
              borderRadius: 8,
              textDecoration: "none",
              color: active ? "#FA243C" : "#1D1D1F",
              background: active ? "rgba(250,36,60,0.08)" : "transparent",
              fontWeight: active ? 600 : 500,
              fontSize: 15,
              letterSpacing: "-0.01em",
              position: "relative",
              transition: "background 120ms",
            }}
          >
            <Icon size={20} />
            {label}
            {badge && (
              <span
                style={{
                  marginLeft: "auto",
                  background: "#FA243C",
                  color: "white",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 10,
                }}
              >
                {badge}
              </span>
            )}
          </Link>
        );
      })}

      <div style={{ padding: "14px 10px 6px 10px" }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B" }}>
          Minhas paradas
        </div>
      </div>

      <Link
        href="/create"
        onClick={onNavClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "9px 10px",
          borderRadius: 8,
          textDecoration: "none",
          color: "#1D1D1F",
          fontWeight: 500,
          fontSize: 15,
          letterSpacing: "-0.01em",
        }}
      >
        <Plus size={20} />
        Nova parada
      </Link>

      <Link
        href={profilePath}
        onClick={onNavClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "9px 10px",
          borderRadius: 8,
          textDecoration: "none",
          color: profileActive ? "#FA243C" : "#1D1D1F",
          background: profileActive ? "rgba(250,36,60,0.08)" : "transparent",
          fontWeight: profileActive ? 600 : 500,
          fontSize: 15,
          letterSpacing: "-0.01em",
        }}
      >
        <User size={20} />
        Meu perfil
      </Link>

      <div style={{ flex: 1 }} />

      {authed ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "10px 8px",
            borderRadius: 10,
            background: "rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar user={avatarUser} imageUrl={session!.user.image} size={36} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {displayName}
              </div>
              <div style={{ fontSize: 12, color: "#86868B", display: "flex", alignItems: "center", gap: 3 }}>
                <Flame size={12} color="#FA243C" fill="#FA243C" />
                <span style={{ color: "#FA243C", fontWeight: 600 }}>{displayStreak}</span>
                <span>semanas</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "8px 10px",
              borderRadius: 8,
              border: "none",
              background: "white",
              fontSize: 13,
              fontWeight: 600,
              color: "#6B6B70",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
            }}
          >
            <LogOut size={14} />
            Sair
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 10px",
              borderRadius: 10,
              background: "rgba(0,0,0,0.04)",
            }}
          >
            <Avatar user={CURRENT_USER} size={36} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {CURRENT_USER.name}
              </div>
              <div style={{ fontSize: 12, color: "#86868B", display: "flex", alignItems: "center", gap: 3 }}>
                <Flame size={12} color="#FA243C" fill="#FA243C" />
                <span style={{ color: "#FA243C", fontWeight: 600 }}>{CURRENT_USER.streak}</span>
                <span>semanas</span>
              </div>
            </div>
          </div>
          <Link
            href="/login"
            onClick={onNavClick}
            style={{
              textAlign: "center",
              padding: "10px 12px",
              borderRadius: 10,
              background: "#1D1D1F",
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Entrar com Google
          </Link>
        </div>
      )}
    </>
  );
}

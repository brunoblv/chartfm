"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Home, Search, Users, User, LogOut, UserCircle } from "lucide-react";
import { useState } from "react";

export function BottomNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const authed = status === "authenticated" && !!session?.user?.handle;
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profilePath = authed ? `/profile/${session!.user.handle}` : "/login";
  const createPath = authed ? "/create" : "/login";
  const profileActive =
    authed &&
    (pathname === profilePath || pathname.startsWith(profilePath + "/"));

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    padding: "10px 0",
    textDecoration: "none",
    color: active ? "var(--accent)" : "var(--text-muted)",
    minHeight: 56,
  });

  const labelStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 10,
    fontWeight: active ? 600 : 500,
    letterSpacing: "0.01em",
    lineHeight: 1,
  });

  const tabs = [
    { href: "/",            label: "Início",      Icon: Home,   exact: true  },
    { href: "/discover",    label: "Descobrir",   Icon: Search, exact: false },
    { href: "/communities", label: "Comunidades", Icon: Users,  exact: false },
  ];

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: "var(--bg-topbar)",
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        borderTop: "0.5px solid var(--divider)",
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        alignItems: "center",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {tabs.slice(0, 2).map(({ href, label, Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link key={href} href={href} style={tabStyle(active)}>
            <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
            <span style={labelStyle(active)}>{label}</span>
          </Link>
        );
      })}

      {/* Create — center pill */}
      <Link
        href={createPath}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 0", textDecoration: "none" }}
      >
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          background: "var(--accent)",
          display: "grid",
          placeItems: "center",
          boxShadow: "0 4px 12px rgba(250,36,60,0.4)",
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
      </Link>

      {tabs.slice(2).map(({ href, label, Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link key={href} href={href} style={tabStyle(active)}>
            <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
            <span style={labelStyle(active)}>{label}</span>
          </Link>
        );
      })}

      {/* Perfil */}
      {authed ? (
        <>
          {profileMenuOpen && (
            <div
              onClick={() => setProfileMenuOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: 110 }}
            />
          )}
          {profileMenuOpen && (
            <div
              style={{
                position: "fixed",
                bottom: "calc(56px + env(safe-area-inset-bottom, 0px) + 8px)",
                right: 12,
                background: "var(--bg-topbar)",
                border: "0.5px solid var(--divider)",
                borderRadius: 14,
                overflow: "hidden",
                zIndex: 120,
                minWidth: 160,
                boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              }}
            >
              <Link
                href={profilePath}
                onClick={() => setProfileMenuOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "14px 16px",
                  textDecoration: "none",
                  color: "var(--text)",
                  fontSize: 14,
                  fontWeight: 600,
                  borderBottom: "0.5px solid var(--divider)",
                }}
              >
                <UserCircle size={18} />
                Ver Perfil
              </Link>
              <button
                type="button"
                onClick={() => { setProfileMenuOpen(false); signOut({ callbackUrl: "/" }); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "14px 16px",
                  width: "100%",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--accent)",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                <LogOut size={18} />
                Sair
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setProfileMenuOpen((o) => !o)}
            style={{ ...tabStyle(profileActive || profileMenuOpen), background: "none", border: "none", cursor: "pointer" }}
          >
            <User size={22} strokeWidth={(profileActive || profileMenuOpen) ? 2.2 : 1.8} />
            <span style={labelStyle(profileActive || profileMenuOpen)}>Perfil</span>
          </button>
        </>
      ) : (
        <Link href={profilePath} style={tabStyle(false)}>
          <User size={22} strokeWidth={1.8} />
          <span style={labelStyle(false)}>Perfil</span>
        </Link>
      )}
    </nav>
  );
}

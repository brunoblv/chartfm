"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { signOut, useSession } from "next-auth/react";
import { Home, Search, Globe, Users, Bell, Plus, User, Flame, LogOut, X, Settings, ChevronDown, Shield, Music2, Disc3, Library, UserCog, ImageOff, AlertCircle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

const NAV: { href: string; label: string; icon: React.ElementType; requiresAuth?: boolean }[] = [
  { href: "/", label: "Início", icon: Home },
  { href: "/discover", label: "Descobrir", icon: Search },
  { href: "/global", label: "Parada Global", icon: Globe },
  { href: "/communities", label: "Comunidades", icon: Users },
  { href: "/notifications", label: "Notificações", icon: Bell, requiresAuth: true },
];

interface SidebarProps {
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isMobile = false, isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const authed = status === "authenticated" && !!session?.user?.handle;
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const profileHandle = authed ? session!.user.handle! : null;
  const isAdmin = authed && (session?.user?.role === "ADMIN" || session?.user?.role === "DEV");
  const profilePath = profileHandle ? `/profile/${profileHandle}` : "/login";
  const profileActive =
    !!profileHandle &&
    (pathname === `/profile/${profileHandle}` || pathname.startsWith(`/profile/${profileHandle}/`));

  const displayName = authed ? (session!.user.name ?? "Usuário") : "";
  const displayStreak = authed ? (session!.user.streak ?? 0) : 0;
  const avatarUser = authed
    ? { name: session!.user.name ?? "Usuário", avatar: "#FA243C" }
    : { name: "?", avatar: "#86868B" };

  const handleNavClick = () => {
    if (isMobile && onClose) onClose();
  };

  useEffect(() => {
    if (!authed) {
      setUnreadNotifications(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const rows = (await res.json()) as Array<{ read: boolean }>;
        if (!cancelled) {
          setUnreadNotifications(rows.filter((r) => !r.read).length);
        }
      } catch {
        if (!cancelled) setUnreadNotifications(0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authed, pathname]);

  if (isMobile) {
    return (
      <>
        {isOpen && (
          <div
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 190 }}
          />
        )}
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
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #FA243C, #FF5858)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 12V9M7 12V6M11 12V3M15 12V7M19 12V5" />
                </svg>
              </div>
              <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em", color: "#1D1D1F" }}>Chartify</span>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: "#86868B" }}>
              <X size={20} />
            </button>
          </div>
          <SidebarContent
            pathname={pathname}
            profilePath={profilePath}
            profileActive={profileActive}
            unreadNotifications={unreadNotifications}
            displayName={displayName}
            displayStreak={displayStreak}
            avatarUser={avatarUser}
            authed={authed}
            session={session}
            onNavClick={handleNavClick}
            isAdmin={isAdmin}
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
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #FA243C, #FF5858)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <path d="M3 12V9M7 12V6M11 12V3M15 12V7M19 12V5" />
          </svg>
        </div>
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em", color: "#1D1D1F" }}>Chartify</span>
      </div>
      <SidebarContent
        pathname={pathname}
        profilePath={profilePath}
        profileActive={profileActive}
        unreadNotifications={unreadNotifications}
        displayName={displayName}
        displayStreak={displayStreak}
        avatarUser={avatarUser}
        authed={authed}
        session={session}
        onNavClick={() => {}}
        isAdmin={isAdmin}
      />
    </aside>
  );
}

function SidebarContent({
  pathname,
  profilePath,
  profileActive,
  unreadNotifications,
  displayName,
  displayStreak,
  avatarUser,
  authed,
  session,
  onNavClick,
  isAdmin,
}: {
  pathname: string;
  profilePath: string;
  profileActive: boolean;
  unreadNotifications: number;
  displayName: string;
  displayStreak: number;
  avatarUser: { name: string; avatar: string };
  authed: boolean;
  session: ReturnType<typeof useSession>["data"];
  onNavClick: () => void;
  isAdmin: boolean;
}) {
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  return (
    <>
      {NAV.map(({ href, label, icon: Icon, requiresAuth }) => {
        const active = pathname === href;
        const locked = requiresAuth && !authed;
        const isNotifications = href === "/notifications";
        const showUnreadBadge = isNotifications && authed && unreadNotifications > 0;
        const link = (
          <Link
            key={href}
            href={locked ? "/login" : href}
            onClick={onNavClick}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "9px 10px",
              borderRadius: 8,
              textDecoration: "none",
              color: locked ? "#C7C7CC" : active ? "#FA243C" : "#1D1D1F",
              background: active ? "rgba(250,36,60,0.08)" : "transparent",
              fontWeight: active ? 600 : 500,
              fontSize: 15,
              letterSpacing: "-0.01em",
              transition: "background 120ms",
            }}
          >
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Icon size={20} />
              {showUnreadBadge && (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -6,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#FA243C",
                    boxShadow: "0 0 0 2px #F5F5F7",
                  }}
                />
              )}
            </div>
            <span>{label}</span>
            {showUnreadBadge && <span style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: "#FA243C" }} />}
          </Link>
        );

        if (isNotifications && isAdmin) {
          return (
            <Fragment key={href}>
              {link}
              <div style={{ margin: "2px 0 4px" }}>
                <button
                  type="button"
                  onClick={() => setAdminMenuOpen((o) => !o)}
                  aria-expanded={adminMenuOpen}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "9px 10px",
                    borderRadius: 8,
                    border: "none",
                    background: adminMenuOpen ? "rgba(250,36,60,0.08)" : "transparent",
                    color: "#1D1D1F",
                    fontWeight: adminMenuOpen ? 600 : 500,
                    fontSize: 15,
                    letterSpacing: "-0.01em",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <Shield size={20} />
                  <span style={{ flex: 1 }}>Admin</span>
                  <ChevronDown
                    size={18}
                    color="#86868B"
                    style={{ transform: adminMenuOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 160ms ease" }}
                  />
                </button>
                {adminMenuOpen && (
                  <div
                    style={{
                      marginLeft: 8,
                      marginTop: 4,
                      marginBottom: 6,
                      padding: "8px 8px 10px",
                      borderLeft: "2px solid rgba(250,36,60,0.25)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <Link href="/admin/music" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/music", true)}>
                      <Music2 size={14} />
                      <span>Editar músicas</span>
                    </Link>
                    <Link href="/admin/music/no-album" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/music/no-album")}>
                      <AlertCircle size={14} />
                      <span>Músicas sem álbum</span>
                    </Link>
                    <Link href="/admin/artists" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/artists")}>
                      <Library size={14} />
                      <span>Editar artistas</span>
                    </Link>
                    <Link href="/admin/albums" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/albums")}>
                      <Disc3 size={14} />
                      <span>Editar álbuns</span>
                    </Link>
                    <Link href="/admin/albums/no-cover" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/albums/no-cover")}>
                      <ImageOff size={14} />
                      <span>Álbuns sem capa</span>
                    </Link>
                    <Link href="/admin/users" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/users")}>
                      <UserCog size={14} />
                      <span>Editar usuários</span>
                    </Link>
                  </div>
                )}
              </div>
            </Fragment>
          );
        }

        return link;
      })}

      <div style={{ padding: "14px 10px 6px 10px" }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B" }}>
          Minhas paradas
        </div>
      </div>

      <Link
        href={authed ? "/create" : "/login"}
        onClick={onNavClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "9px 10px",
          borderRadius: 8,
          textDecoration: "none",
          color: authed ? "#1D1D1F" : "#C7C7CC",
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
          color: !authed ? "#C7C7CC" : profileActive ? "#FA243C" : "#1D1D1F",
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
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 8px", borderRadius: 10, background: "rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar user={avatarUser} imageUrl={session!.user.image} size={36} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {displayName}
              </div>
              <div style={{ fontSize: 12, color: "#86868B", display: "flex", alignItems: "center", gap: 3 }}>
                <Flame size={12} color="#FA243C" fill="#FA243C" />
                <span style={{ color: "#FA243C", fontWeight: 600 }}>ativo</span>
              </div>
            </div>
            <Link
              href="/settings"
              onClick={onNavClick}
              title="Editar dados"
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
                color: "#6B6B70",
                background: "rgba(0,0,0,0.04)",
                flexShrink: 0,
              }}
            >
              <Settings size={15} />
            </Link>
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
        <div style={{
          borderRadius: 14,
          background: "linear-gradient(135deg, rgba(250,36,60,0.07), rgba(255,88,88,0.03))",
          border: "1px solid rgba(250,36,60,0.12)",
          padding: "16px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em", color: "#1D1D1F", lineHeight: 1.3 }}>
              Crie sua parada semanal
            </div>
            <div style={{ fontSize: 12, color: "#6B6B70", marginTop: 5, lineHeight: 1.5 }}>
              Registre as músicas que você mais ouviu, acompanhe seu streak e descubra o gosto musical dos seus amigos.
            </div>
          </div>
          <Link
            href="/login"
            onClick={onNavClick}
            style={{
              textAlign: "center",
              padding: "10px 12px",
              borderRadius: 100,
              background: "#FA243C",
              color: "white",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              letterSpacing: "-0.01em",
              boxShadow: "0 2px 8px rgba(250,36,60,0.25)",
            }}
          >
            Criar conta grátis
          </Link>
          <Link
            href="/login"
            onClick={onNavClick}
            style={{
              textAlign: "center",
              padding: "8px 12px",
              borderRadius: 100,
              background: "white",
              color: "#1D1D1F",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              border: "1px solid rgba(0,0,0,0.1)",
            }}
          >
            Já tenho conta — Entrar
          </Link>
        </div>
      )}
    </>
  );
}

const adminLinkStyle = (pathname: string, href: string, exactOnly?: boolean): CSSProperties => {
  const active = exactOnly ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid rgba(0,0,0,0.08)",
    background: active ? "rgba(250,36,60,0.08)" : "white",
    borderRadius: 8,
    padding: "8px 10px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    color: active ? "#FA243C" : "#1D1D1F",
    textDecoration: "none",
    transition: "background 120ms ease, color 120ms ease",
  };
};

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { signOut, useSession } from "next-auth/react";
import { Home, Search, Globe, Users, Bell, Plus, User, Flame, LogOut, X, Settings, ChevronDown, Shield, Music2, Disc3, Library, UserCog, ImageOff, AlertCircle, ListChecks, Sparkles, Star, Award, ImagePlay, Radio } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ChartFMLogo } from "@/components/ui/ChartFMLogo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useTranslations } from "@/hooks/useTranslations";

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
  const isMyTrlOwner = authed && session?.user?.handle === "bruno";
  const profilePath = profileHandle ? `/profile/${profileHandle}` : "/login";
  const profileActive =
    !!profileHandle &&
    (pathname === `/profile/${profileHandle}` || pathname.startsWith(`/profile/${profileHandle}/`));

  const { t } = useTranslations();
  const displayName = authed ? (session!.user.name ?? t("common.user")) : "";
  const displayStreak = authed ? (session!.user.streak ?? 0) : 0;
  const avatarUser = authed
    ? { name: session!.user.name ?? t("common.user"), avatar: "#FA243C" }
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
            background: "var(--sidebar-bg)",
            borderRight: "1px solid var(--divider)",
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
              <ChartFMLogo size={32} />
              <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)" }}>ChartFM</span>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: "var(--text-muted)" }}>
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
            isMyTrlOwner={isMyTrlOwner}
            t={t}
          />
        </aside>
      </>
    );
  }

  return (
    <aside
      style={{
        width: 240,
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--divider)",
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
        <ChartFMLogo size={32} />
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)" }}>ChartFM</span>
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
        isMyTrlOwner={isMyTrlOwner}
        t={t}
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
  isMyTrlOwner,
  t,
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
  isMyTrlOwner: boolean;
  t: (key: string) => string;
}) {
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [criticsfmMenuOpen, setCriticsfmMenuOpen] = useState(
    () => pathname === "/criticsfm" || pathname.startsWith("/criticsfm/"),
  );

  useEffect(() => {
    if (pathname === "/criticsfm" || pathname.startsWith("/criticsfm/")) {
      setCriticsfmMenuOpen(true);
    }
  }, [pathname]);

  const criticsfmSubLinks = [
    { href: "/criticsfm/clube", label: t("nav.criticsfmClube"), icon: Award },
    { href: "/criticsfm/lancamentos", label: t("nav.criticsfmNewAlbums"), icon: Disc3 },
  ];

  const NAV: { href: string; label: string; icon: React.ElementType; requiresAuth?: boolean; badge?: string }[] = [
    { href: "/", label: t("nav.home"), icon: Home },
    { href: "/discover", label: t("nav.discover"), icon: Search },
    { href: "/global", label: t("nav.global"), icon: Globe },
    { href: "/communities", label: t("nav.communities"), icon: Users },
    { href: "/albums", label: t("nav.albums"), icon: Star },
    { href: "/criticsfm", label: t("nav.criticsfm"), icon: Award },
    ...(isMyTrlOwner ? [{ href: "/mytrl", label: t("nav.mytrl"), icon: Radio }] : []),
    { href: "/notifications", label: t("nav.notifications"), icon: Bell, requiresAuth: true },
    { href: "/whats-new", label: t("nav.whatsNew"), icon: Sparkles, badge: t("nav.badgeNew") },
  ];

  const footerLinks = [
    { href: "/guides", label: t("nav.guides") },
    { href: "/about", label: t("nav.about") },
    { href: "/contact", label: t("nav.contact") },
    { href: "/terms-of-use", label: t("nav.terms") },
    { href: "/privacy-policy", label: t("nav.privacy") },
  ];

  return (
    <>
      {NAV.map(({ href, label, icon: Icon, requiresAuth, badge }) => {
        const active = pathname === href || (href === "/criticsfm" && pathname.startsWith("/criticsfm"));
        const locked = requiresAuth && !authed;
        const isNotifications = href === "/notifications";
        const isCriticsFM = href === "/criticsfm";
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
              color: locked ? "var(--text-disabled)" : active ? "var(--accent)" : "var(--text)",
              background: active ? "var(--accent-tint)" : "transparent",
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
                    background: "var(--accent)",
                    boxShadow: "0 0 0 2px var(--sidebar-bg)",
                  }}
                />
              )}
            </div>
            <span style={{ flex: 1 }}>{label}</span>
            {badge && !active && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                  background: "var(--accent-tint)",
                  color: "var(--accent)",
                  borderRadius: 100,
                  padding: "2px 7px",
                  flexShrink: 0,
                }}
              >
                {badge}
              </span>
            )}
            {showUnreadBadge && <span style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />}
          </Link>
        );

        if (isCriticsFM) {
          return (
            <Fragment key={href}>
              <div style={{ margin: "2px 0 4px" }}>
                <div style={{ display: "flex", alignItems: "stretch", gap: 2 }}>
                  <Link
                    href={href}
                    onClick={onNavClick}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "9px 10px",
                      borderRadius: 8,
                      textDecoration: "none",
                      color: active ? "var(--accent)" : "var(--text)",
                      background: active ? "var(--accent-tint)" : "transparent",
                      fontWeight: active ? 600 : 500,
                      fontSize: 15,
                      letterSpacing: "-0.01em",
                      transition: "background 120ms",
                      minWidth: 0,
                    }}
                  >
                    <Award size={20} />
                    <span style={{ flex: 1 }}>{label}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setCriticsfmMenuOpen((o) => !o)}
                    aria-expanded={criticsfmMenuOpen}
                    aria-label={label}
                    style={{
                      width: 36,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 8,
                      border: "none",
                      background: criticsfmMenuOpen ? "var(--accent-tint)" : "transparent",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    <ChevronDown
                      size={18}
                      style={{ transform: criticsfmMenuOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 160ms ease" }}
                    />
                  </button>
                </div>
                {criticsfmMenuOpen && (
                  <div
                    style={{
                      marginLeft: 8,
                      marginTop: 4,
                      marginBottom: 6,
                      padding: "8px 8px 10px",
                      borderLeft: "2px solid var(--accent-tint)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {criticsfmSubLinks.map(({ href: subHref, label: subLabel, icon: SubIcon }) => (
                      <Link
                        key={subHref}
                        href={subHref}
                        onClick={onNavClick}
                        style={adminLinkStyle(pathname, subHref)}
                      >
                        <SubIcon size={14} />
                        <span>{subLabel}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </Fragment>
          );
        }

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
                    background: adminMenuOpen ? "var(--accent-tint)" : "transparent",
                    color: "var(--text)",
                    fontWeight: adminMenuOpen ? 600 : 500,
                    fontSize: 15,
                    letterSpacing: "-0.01em",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <Shield size={20} />
                  <span style={{ flex: 1 }}>{t("nav.admin")}</span>
                  <ChevronDown
                    size={18}
                    color="var(--text-muted)"
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
                      borderLeft: "2px solid var(--accent-tint)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <Link href="/admin/music" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/music", true)}>
                      <Music2 size={14} />
                      <span>{t("nav.adminEditSongs")}</span>
                    </Link>
                    <Link href="/admin/music/no-album" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/music/no-album")}>
                      <AlertCircle size={14} />
                      <span>{t("nav.adminSongsNoAlbum")}</span>
                    </Link>
                    <Link href="/admin/missing-info" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/missing-info")}>
                      <ListChecks size={14} />
                      <span>{t("nav.adminMissingInfo")}</span>
                    </Link>
                    <Link href="/admin/artists" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/artists")}>
                      <Library size={14} />
                      <span>{t("nav.adminEditArtists")}</span>
                    </Link>
                    <Link href="/admin/albums" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/albums")}>
                      <Disc3 size={14} />
                      <span>{t("nav.adminEditAlbums")}</span>
                    </Link>
                    <Link href="/admin/albums/no-cover" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/albums/no-cover")}>
                      <ImageOff size={14} />
                      <span>{t("nav.adminAlbumsNoCover")}</span>
                    </Link>
                    <Link href="/admin/users" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/users")}>
                      <UserCog size={14} />
                      <span>{t("nav.adminEditUsers")}</span>
                    </Link>
                    <Link href="/admin/clube" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/clube")}>
                      <Award size={14} />
                      <span>{t("nav.adminClube")}</span>
                    </Link>
                    <Link href="/admin/lancamentos" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/lancamentos")}>
                      <Sparkles size={14} />
                      <span>Lançamentos</span>
                    </Link>
                    <Link href="/admin/gerador-de-imagens" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/gerador-de-imagens")}>
                      <ImagePlay size={14} />
                      <span>Gerador de Imagens</span>
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
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          {t("nav.myCharts")}
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
          color: authed ? "var(--text)" : "var(--text-disabled)",
          fontWeight: 500,
          fontSize: 15,
          letterSpacing: "-0.01em",
        }}
      >
        <Plus size={20} />
        {t("nav.newChart")}
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
          color: !authed ? "var(--text-disabled)" : profileActive ? "var(--accent)" : "var(--text)",
          background: profileActive ? "var(--accent-tint)" : "transparent",
          fontWeight: profileActive ? 600 : 500,
          fontSize: 15,
          letterSpacing: "-0.01em",
        }}
      >
        <User size={20} />
        {t("nav.myProfile")}
      </Link>

      <div style={{ flex: 1 }} />

      <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 10 }}>
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "6px 10px 10px" }}>
        {footerLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavClick}
            style={{
              color: "var(--text-muted)",
              fontSize: 11,
              fontWeight: 600,
              textDecoration: "none",
              lineHeight: 1.3,
            }}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {authed ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 8px", borderRadius: 10, background: "var(--fill-inset)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar user={avatarUser} imageUrl={session!.user.image} size={36} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>
                {displayName}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 3 }}>
                <Flame size={12} color="var(--accent)" fill="var(--accent)" />
                <span style={{ color: "var(--accent)", fontWeight: 600 }}>{t("nav.active")}</span>
              </div>
            </div>
            <Link
              href="/settings"
              onClick={onNavClick}
              title={t("nav.editProfile")}
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
                color: "var(--text-subtle)",
                background: "var(--fill-inset)",
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
              background: "var(--surface)",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-subtle)",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
            }}
          >
            <LogOut size={14} />
            {t("nav.signOut")}
          </button>
        </div>
      ) : (
        <div style={{
          borderRadius: 14,
          background: "linear-gradient(135deg, var(--accent-tint), transparent)",
          border: "1px solid var(--accent-tint)",
          padding: "16px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)", lineHeight: 1.3 }}>
              {t("nav.ctaTitle")}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-subtle)", marginTop: 5, lineHeight: 1.5 }}>
              {t("nav.ctaBody")}
            </div>
          </div>
          <Link
            href="/login"
            onClick={onNavClick}
            style={{
              textAlign: "center",
              padding: "10px 12px",
              borderRadius: 100,
              background: "var(--accent)",
              color: "white",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              letterSpacing: "-0.01em",
              boxShadow: "0 2px 8px rgba(250,36,60,0.25)",
            }}
          >
            {t("nav.ctaSignUp")}
          </Link>
          <Link
            href="/login"
            onClick={onNavClick}
            style={{
              textAlign: "center",
              padding: "8px 12px",
              borderRadius: 100,
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              border: "1px solid var(--divider-strong)",
            }}
          >
            {t("nav.ctaSignIn")}
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
    border: "1px solid var(--divider-strong)",
    background: active ? "var(--accent-tint)" : "var(--surface)",
    borderRadius: 8,
    padding: "8px 10px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    color: active ? "var(--accent)" : "var(--text)",
    textDecoration: "none",
    transition: "background 120ms ease, color 120ms ease",
  };
};

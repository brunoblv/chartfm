"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { signOut, useSession } from "next-auth/react";
import { Home, Search, Globe, Users, Flame, LogOut, X, Settings, ChevronDown, Shield, Database, Disc3, UserCog, Sparkles, Award, ImagePlay, Zap, ListMusic, User, LifeBuoy, MailWarning, BarChart3, Megaphone, Download, Tv, Radar, Newspaper } from "lucide-react";
import { MYTRL_OWNER_HANDLE } from "@/lib/mytrl-access";
import { Avatar } from "@/components/ui/Avatar";
import { ChartFMLogo } from "@/components/ui/ChartFMLogo";
import { useTranslations } from "@/hooks/useTranslations";

type SidebarParada = {
  id: string;
  name: string;
  logo: string | null;
};

function ParadaLogoSquare({ name, logo }: { name: string; logo: string | null }) {
  if (logo) {
    return (
      <img
        src={logo}
        alt=""
        width={32}
        height={32}
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          objectFit: "cover",
          flexShrink: 0,
          boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.08)",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 9,
        background: "linear-gradient(135deg, #FA243C, #FF8C69)",
        display: "grid",
        placeItems: "center",
        fontSize: 13,
        fontWeight: 800,
        color: "#fff",
        flexShrink: 0,
      }}
    >
      {name.trim()[0]?.toUpperCase() ?? "P"}
    </div>
  );
}

function MyParadasList({
  paradas,
  activeParadaId,
  userHandle,
  onNavClick,
}: {
  paradas: SidebarParada[];
  activeParadaId: string | null;
  userHandle: string;
  onNavClick: () => void;
}) {
  if (paradas.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 4px 8px" }}>
      {paradas.map((p) => {
        const active = activeParadaId === p.id;
        return (
          <Link
            key={p.id}
            href={`/profile/${encodeURIComponent(userHandle)}/paradas/${p.id}`}
            onClick={onNavClick}
            title={p.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px",
              borderRadius: 10,
              textDecoration: "none",
              color: active ? "var(--accent)" : "var(--text)",
              background: active ? "var(--accent-tint)" : "transparent",
              transition: "background 120ms",
            }}
          >
            <ParadaLogoSquare name={p.name} logo={p.logo} />
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 13,
                fontWeight: active ? 700 : 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                letterSpacing: "-0.01em",
              }}
            >
              {p.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

interface SidebarProps {
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isMobile = false, isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const authed = status === "authenticated" && !!session?.user?.handle;
  const isAdmin = authed && (session?.user?.role === "ADMIN" || session?.user?.role === "DEV");

  const { t } = useTranslations();
  const displayName = authed ? (session!.user.name ?? t("common.user")) : "";
  const displayStreak = authed ? (session!.user.streak ?? 0) : 0;
  const avatarUser = authed
    ? { name: session!.user.name ?? t("common.user"), avatar: "#FA243C" }
    : { name: "?", avatar: "#86868B" };

  const handleNavClick = () => {
    if (isMobile && onClose) onClose();
  };

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
            displayName={displayName}
            displayStreak={displayStreak}
            avatarUser={avatarUser}
            authed={authed}
            session={session}
            onNavClick={handleNavClick}
            isAdmin={isAdmin}
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
        displayName={displayName}
        displayStreak={displayStreak}
        avatarUser={avatarUser}
        authed={authed}
        session={session}
        onNavClick={() => {}}
        isAdmin={isAdmin}
        t={t}
      />
    </aside>
  );
}

function SidebarContent({
  pathname,
  displayName,
  displayStreak,
  avatarUser,
  authed,
  session,
  onNavClick,
  isAdmin,
  t,
}: {
  pathname: string;
  displayName: string;
  displayStreak: number;
  avatarUser: { name: string; avatar: string };
  authed: boolean;
  session: ReturnType<typeof useSession>["data"];
  onNavClick: () => void;
  isAdmin: boolean;
  t: (key: string) => string;
}) {
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [myParadas, setMyParadas] = useState<SidebarParada[]>([]);
  const searchParams = useSearchParams();
  const activeParadaIdFromCreate =
    pathname === "/create" ? searchParams.get("paradaId") : null;
  const paradaDetailMatch = pathname.match(
    /^\/profile\/[^/]+\/paradas\/([^/]+)$/,
  );
  const activeParadaId = paradaDetailMatch?.[1] ?? activeParadaIdFromCreate;
  const [criticsfmMenuOpen, setCriticsfmMenuOpen] = useState(
    () => pathname === "/criticsfm" || pathname.startsWith("/criticsfm/"),
  );

  useEffect(() => {
    if (pathname === "/criticsfm" || pathname.startsWith("/criticsfm/")) {
      setCriticsfmMenuOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (!authed) {
      setMyParadas([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user/paradas", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { paradas?: SidebarParada[] };
        if (!cancelled) setMyParadas(data.paradas ?? []);
      } catch {
        if (!cancelled) setMyParadas([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authed, pathname]);

  const criticsfmSubLinks = [
    { href: "/criticsfm/clube", label: t("nav.criticsfmClube"), icon: Award },
    { href: "/criticsfm/lancamentos", label: t("nav.criticsfmNewAlbums"), icon: Disc3 },
  ];

  const profileHref =
    authed && session?.user?.handle ? `/profile/${session.user.handle}` : "/login";

  const NAV: { href: string; label: string; icon: React.ElementType; requiresAuth?: boolean; badge?: string }[] = [
    { href: "/", label: t("nav.home"), icon: Home },
    { href: "/discover", label: t("nav.discover"), icon: Search },
    { href: "/global", label: t("nav.global"), icon: Globe },
    { href: "/communities", label: t("nav.communities"), icon: Users },
    { href: "/push", label: "Push", icon: Zap },
    { href: "/copa", label: "Copa ChartFM", icon: Flame },
    { href: "/criticsfm", label: t("nav.criticsfm"), icon: Award },
    { href: profileHref, label: t("nav.profile"), icon: User, requiresAuth: true },
  ];

  const footerLinks = [
    { href: "/guides", label: t("nav.guides") },
    { href: "/about", label: t("nav.about") },
    { href: "/contact", label: t("nav.contact") },
    { href: "/support", label: t("nav.support") },
    { href: "/terms-of-use", label: t("nav.terms") },
    { href: "/whats-new", label: t("nav.whatsNew") },
    { href: "/privacy-policy", label: t("nav.privacy") },
  ];

  return (
    <>
      {NAV.map(({ href, label, icon: Icon, requiresAuth, badge }) => {
        const active =
          pathname === href ||
          (href === "/criticsfm" && pathname.startsWith("/criticsfm")) ||
          (href === "/communities" && (pathname === "/communities" || pathname.startsWith("/community/"))) ||
          (href.startsWith("/profile/") && (pathname === href || pathname.startsWith(`${href}/`)));
        const locked = requiresAuth && !authed;
        const isCriticsFM = href === "/criticsfm";
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
            <Icon size={20} />
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

        return link;
      })}

      {isAdmin && (
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
              <Link href="/admin/analytics" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/analytics")}>
                <BarChart3 size={14} />
                <span>Analytics</span>
              </Link>
              <Link href="/admin/dados" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/dados")}>
                <Database size={14} />
                <span>{t("nav.adminDataEdit")}</span>
              </Link>
              <Link href="/admin/users" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/users")}>
                <UserCog size={14} />
                <span>{t("nav.adminEditUsers")}</span>
              </Link>
              <Link href="/admin/pending-verifications" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/pending-verifications")}>
                <MailWarning size={14} />
                <span>{t("nav.adminPendingVerifications")}</span>
              </Link>
              <Link href="/admin/support" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/support")}>
                <LifeBuoy size={14} />
                <span>{t("nav.adminSupport")}</span>
              </Link>
              <Link href="/admin/avisos" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/avisos")}>
                <Megaphone size={14} />
                <span>Avisos</span>
              </Link>
              <Link href="/admin/editorial" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/editorial")}>
                <Newspaper size={14} />
                <span>Editorial</span>
              </Link>
              <Link href="/admin/clube" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/clube")}>
                <Award size={14} />
                <span>{t("nav.adminClube")}</span>
              </Link>
              <Link href="/admin/copa" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/copa")}>
                <Flame size={14} />
                <span>Copa ChartFM</span>
              </Link>
              <Link href="/admin/push" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/push")}>
                <Zap size={14} />
                <span>Push</span>
              </Link>
              <Link href="/admin/lancamentos" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/lancamentos")}>
                <Sparkles size={14} />
                <span>Lançamentos</span>
              </Link>
              <Link href="/admin/radar-lancamentos" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/radar-lancamentos")}>
                <Radar size={14} />
                <span>Radar de Lançamentos</span>
              </Link>
              <Link href="/admin/gerador-de-imagens" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/gerador-de-imagens")}>
                <ImagePlay size={14} />
                <span>Gerador de Imagens</span>
              </Link>
              <Link href="/admin/lower-thirds-youtube" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/lower-thirds-youtube")}>
                <Tv size={14} />
                <span>{t("nav.adminLowerThirdsYoutube")}</span>
              </Link>
              <Link href="/admin/crownnote-export" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/crownnote-export")}>
                <Download size={14} />
                <span>{t("nav.adminCrownnoteExport")}</span>
              </Link>
              {session?.user?.handle === MYTRL_OWNER_HANDLE && (
                <Link href="/admin/playlists-lastfm" onClick={onNavClick} style={adminLinkStyle(pathname, "/admin/playlists-lastfm")}>
                  <ListMusic size={14} />
                  <span>Playlists Last.fm</span>
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ padding: "14px 10px 6px 10px" }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          {t("nav.myCharts")}
        </div>
      </div>

      {authed && session?.user?.handle && (
        <>
          <MyParadasList
            paradas={myParadas}
            activeParadaId={activeParadaId}
            userHandle={session.user.handle}
            onNavClick={onNavClick}
          />
          <Link
            href={`/profile/${encodeURIComponent(session.user.handle)}/paradas`}
            onClick={onNavClick}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px",
              borderRadius: 10,
              textDecoration: "none",
              color: "var(--text-muted)",
              margin: "0 4px 8px",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                border: "1.5px dashed var(--divider-strong)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                color: "var(--text-muted)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>
              {t("nav.newChart")}
            </span>
          </Link>
        </>
      )}

      <div style={{ flex: 1 }} />

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

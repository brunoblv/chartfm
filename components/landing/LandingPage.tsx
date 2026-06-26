"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { USERS_DATA, COVER_PALETTES } from "@/lib/data";
import { Avatar } from "@/components/ui/Avatar";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { GlobalChartEntry } from "@/lib/types";
import { ChartFMLogo } from "@/components/ui/ChartFMLogo";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useTranslations } from "@/hooks/useTranslations";

function StatusBadge({ status, delta, newLabel }: { status: string; delta?: number | null; newLabel: string }) {
  if (status === "new") return (
    <span style={{ background: "var(--new-bg)", color: "var(--new-fg)", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 100, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
      {newLabel}
    </span>
  );
  if (status === "up") return (
    <span style={{ background: "var(--up-bg)", color: "var(--up-fg)", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 100 }}>
      ▲ {delta}
    </span>
  );
  if (status === "down") return (
    <span style={{ background: "var(--down-bg)", color: "var(--down-fg)", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 100 }}>
      ▼ {Math.abs(delta ?? 0)}
    </span>
  );
  return (
    <span style={{ background: "var(--same-bg)", color: "var(--same-fg)", fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 100 }}>
      —
    </span>
  );
}

type RecentUser = { id: string; name: string; avatarColor: string; image: string | null };

export function LandingPage({
  globalChart,
  userCount = 0,
  recentUsers = [],
  children,
}: {
  globalChart: GlobalChartEntry[];
  userCount?: number;
  recentUsers?: RecentUser[];
  children?: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const { t, locale } = useTranslations();
  const [signingIn, setSigningIn] = useState(false);
  const year = new Date().getFullYear();

  const handleSignIn = () => {
    setSigningIn(true);
    signIn("google", { callbackUrl: "/" }).catch(() => setSigningIn(false));
  };

  const covers = Array.from({ length: 25 }, (_, i) => COVER_PALETTES[i % COVER_PALETTES.length]);
  const top10 = globalChart.slice(0, 10);
  const previewUser = USERS_DATA[2];

  const heroEntries = [
    { position: 1, title: "The Fate of Ophelia", artist: "Taylor Swift",    palette: ["#7B5EA7", "#4A2D7F"], status: "new",  delta: null },
    { position: 2, title: "So Easy (To Fall in Love)", artist: "Olivia Dean", palette: ["#FF9A9E", "#F6A07A"], status: "up",   delta: 2    },
    { position: 3, title: "Manchild",             artist: "Sabrina Carpenter", palette: ["#FF6B9D", "#FF8C42"], status: "up",   delta: 1    },
    { position: 4, title: "Homewrecker",          artist: "Sombr",            palette: ["#3A3A4A", "#1A1A2E"], status: "down", delta: 1    },
  ];
  const footerGroups: { title: string; items: { label: string; href: string }[] }[] = [
    {
      title: t("landing.footerProduct"),
      items: [
        { label: t("landing.footerHowItWorks"), href: "#como-funciona" },
        { label: t("landing.communities"), href: "#comunidades" },
        { label: t("landing.globalChart"), href: "#parada-global" },
      ],
    },
    {
      title: t("landing.footerCompany"),
      items: [
        { label: t("landing.about"), href: "/about" },
        { label: t("nav.contact"), href: "/contact" },
      ],
    },
    {
      title: t("landing.footerResources"),
      items: [
        { label: t("landing.footerGuides"), href: "/guides" },
        { label: t("landing.footerImportSpotify"), href: "/login" },
        { label: t("landing.communities"), href: "/communities" },
      ],
    },
    {
      title: t("landing.footerLegal"),
      items: [
        { label: t("landing.footerTerms"), href: "/terms-of-use" },
        { label: t("landing.footerPrivacy"), href: "/privacy-policy" },
        { label: t("landing.footerLgpd"), href: "/contact" },
      ],
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "inherit" }}>

      {/* NAVBAR */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "var(--bg-topbar)", backdropFilter: "blur(20px) saturate(160%)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        padding: isMobile ? "0 20px" : "0 56px",
        height: 60, display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ChartFMLogo size={32} style={{ boxShadow: "0 2px 6px rgba(250,36,60,0.3)", borderRadius: 9 }} />
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.025em", color: "var(--text)" }}>ChartFM</span>
        </div>
        {!isMobile && (
          <div style={{ display: "flex", gap: 28, fontSize: 14, color: "var(--text)", fontWeight: 500 }}>
            <Link href="#como-funciona" style={{ color: "inherit", textDecoration: "none" }}>{t("landing.howItWorks")}</Link>
            <Link href="#comunidades" style={{ color: "inherit", textDecoration: "none" }}>{t("landing.communities")}</Link>
            <Link href="#parada-global" style={{ color: "inherit", textDecoration: "none" }}>{t("landing.globalChart")}</Link>
            <Link href="/about" style={{ color: "inherit", textDecoration: "none" }}>{t("landing.about")}</Link>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LanguageSwitcher />
          {!isMobile && (
            <button onClick={handleSignIn} disabled={signingIn} style={{ background: "none", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "var(--text)" }}>
              {t("landing.signIn")}
            </button>
          )}
          <button
            onClick={handleSignIn}
            disabled={signingIn}
            style={{
              padding: "8px 20px", borderRadius: 100,
              background: "var(--btn-dark-bg)", color: "var(--btn-dark-fg)",
              border: "none", fontSize: 13, fontWeight: 700,
              letterSpacing: "-0.01em", cursor: signingIn ? "not-allowed" : "pointer",
              opacity: signingIn ? 0.6 : 1,
            }}
          >
            {signingIn ? t("landing.signingIn") : t("landing.signUp")}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        position: "relative",
        padding: isMobile ? "64px 24px 80px" : "80px 56px 100px",
        overflow: "hidden",
      }}>
        {/* Decorative blob */}
        <div style={{
          position: "absolute", top: -100, right: -80,
          width: 500, height: 500, borderRadius: "50%",
          background: `conic-gradient(from 0deg, ${COVER_PALETTES[0][0]}, ${COVER_PALETTES[7][1]}, ${COVER_PALETTES[14][0]}, ${COVER_PALETTES[0][0]})`,
          filter: "blur(100px)", opacity: 0.2, pointerEvents: "none",
        }} />

        <div style={{
          maxWidth: 1200, margin: "0 auto",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1.05fr 1fr",
          gap: isMobile ? 56 : 60,
          alignItems: "center",
          position: "relative",
        }}>
          {/* Left: copy */}
          <div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 14px",
              background: "rgba(250,36,60,0.08)", border: "1px solid rgba(250,36,60,0.15)",
              borderRadius: 100, marginBottom: 24,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#FA243C" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#FA243C", letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
                {t("landing.badge")}
              </span>
            </div>

            <h1 style={{
              fontSize: isMobile ? 52 : 72,
              fontWeight: 800, letterSpacing: "-0.045em",
              lineHeight: 1.0, color: "var(--text)",
              margin: "0 0 22px 0",
            }}>
              {t("landing.heroTitle1")}<br />
              <span style={{
                background: "linear-gradient(135deg, #FA243C, #FF8C42)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                {t("landing.heroTitle2")}
              </span>
            </h1>

            <p style={{
              fontSize: isMobile ? 16 : 19,
              color: "var(--text-subtle)", lineHeight: 1.6,
              margin: "0 0 36px 0", maxWidth: 520,
            }}>
              {t("landing.heroBody")}
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" as const }}>
              <button
                onClick={handleSignIn}
                disabled={signingIn}
                style={{
                  padding: "15px 28px", borderRadius: 100,
                  background: "#FA243C", color: "white",
                  border: "none", fontSize: 15, fontWeight: 700,
                  letterSpacing: "-0.01em", cursor: signingIn ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 18px rgba(250,36,60,0.3)",
                  display: "flex", alignItems: "center", gap: 10,
                  opacity: signingIn ? 0.7 : 1,
                }}
              >
                {signingIn ? t("landing.signingIn") : t("landing.ctaPrimary")}
                {!signingIn && (
                  <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </button>
            </div>

            {/* Social proof */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 32 }}>
              <div style={{ display: "flex" }}>
                {recentUsers.map((u, i) => (
                  <div key={u.id} style={{ marginLeft: i === 0 ? 0 : -10, border: "2px solid var(--bg)", borderRadius: "50%" }}>
                    <Avatar user={{ name: u.name, avatar: u.avatarColor }} imageUrl={u.image} size={32} />
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-subtle)" }}>
                <div style={{ display: "flex", gap: 1, color: "#FFB000", marginBottom: 2 }}>
                  {"★★★★★".split("").map((s, i) => <span key={i}>{s}</span>)}
                </div>
                <div>
                  <b style={{ color: "var(--text)", fontWeight: 600 }}>
                    {userCount >= 1000 ? `+${(Math.floor(userCount / 100) * 100).toLocaleString(locale)}` : `+${userCount}`}
                  </b>{" "}
                  {t("landing.curatorsOn")}
                </div>
              </div>
            </div>

            {isMobile && (
              <div style={{
                marginTop: 36,
                background: "var(--surface)",
                borderRadius: 20,
                boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
                padding: 20,
                border: "1px solid rgba(0,0,0,0.04)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <Avatar user={previewUser} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{previewUser.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("landing.top10Week", { week: t("landing.thisWeek"), year })}</div>
                  </div>
                  <div style={{ padding: "4px 10px", background: "rgba(250,36,60,0.08)", borderRadius: 20, fontSize: 11, fontWeight: 700, color: "#FA243C" }}>NOVA</div>
                </div>
                {heroEntries.map((entry) => (
                  <div key={entry.position} style={{
                    display: "grid",
                    gridTemplateColumns: "28px 40px 1fr auto",
                    gap: 10, alignItems: "center",
                    padding: "9px 0",
                    borderTop: "1px solid rgba(0,0,0,0.04)",
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: entry.position <= 3 ? "var(--accent)" : "var(--text-muted)", textAlign: "center" as const }}>
                      {entry.position}
                    </div>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: `linear-gradient(135deg, ${entry.palette[0]}, ${entry.palette[1]})` }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{entry.title}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{entry.artist}</div>
                    </div>
                    <StatusBadge status={entry.status} delta={entry.delta} newLabel={t("status.new")} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: hero visual */}
          {!isMobile && (
            <div style={{ position: "relative", height: 520 }}>
              {/* Cover wall background */}
              <div style={{
                position: "absolute", inset: 0,
                display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10,
                transform: "rotate(8deg) scale(1.15)",
                opacity: 0.7, filter: "blur(0.5px)", pointerEvents: "none",
              }}>
                {covers.slice(0, 25).map((c, i) => (
                  <div key={i} style={{
                    aspectRatio: "1", borderRadius: 10,
                    background: `linear-gradient(135deg, ${c[0]}, ${c[1]})`,
                    opacity: 0.4 + (i % 5) * 0.12,
                  }} />
                ))}
              </div>

              {/* Floating chart card */}
              <div style={{
                position: "absolute", top: 60, left: 30, right: 30,
                background: "var(--surface)", borderRadius: 20,
                boxShadow: "0 30px 80px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.08)",
                padding: 22, border: "1px solid rgba(0,0,0,0.04)",
                zIndex: 1,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <Avatar user={previewUser} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{previewUser.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("landing.top10Week", { week: t("landing.thisWeek"), year })}</div>
                  </div>
                  <div style={{ padding: "4px 10px", background: "rgba(250,36,60,0.08)", borderRadius: 20, fontSize: 11, fontWeight: 700, color: "#FA243C" }}>NOVA</div>
                </div>
                {heroEntries.map((entry) => (
                  <div key={entry.position} style={{
                    display: "grid",
                    gridTemplateColumns: "28px 40px 1fr auto",
                    gap: 10, alignItems: "center",
                    padding: "9px 0",
                    borderTop: "1px solid rgba(0,0,0,0.04)",
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: entry.position <= 3 ? "var(--accent)" : "var(--text-muted)", textAlign: "center" as const }}>
                      {entry.position}
                    </div>
                    <div style={{
                      width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                      background: `linear-gradient(135deg, ${entry.palette[0]}, ${entry.palette[1]})`,
                    }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {entry.title}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{entry.artist}</div>
                    </div>
                    <StatusBadge status={entry.status} delta={entry.delta} newLabel={t("status.new")} />
                  </div>
                ))}
              </div>

            </div>
          )}
        </div>
      </section>

      {children}

{/* COMO FUNCIONA — 3 steps */}
      <section id="como-funciona" style={{ padding: isMobile ? "60px 24px" : "100px 56px", background: "var(--surface)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center" as const, marginBottom: 60 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#FA243C", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 12 }}>Como funciona</div>
            <h2 style={{ fontSize: isMobile ? 32 : 48, fontWeight: 800, letterSpacing: "-0.04em", margin: "0 0 14px 0", lineHeight: 1.1, color: "var(--text)" }}>
            Toda semana, uma nova parada.
            </h2>
            <p style={{ fontSize: 17, color: "var(--text-subtle)", maxWidth: 560, margin: "0 auto", lineHeight: 1.5 }}>
            Monte seu ranking, compartilhe com a comunidade e ajude a definir as paradas globais.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 24 }}>
            {[
              { n: "01", title: "Monte sua parada", desc: "Escolha suas músicas favoritas da semana e organize sua parada do seu jeito.", accent: "#FA243C" },
              { n: "02", title: "Compartilhe seu gosto", desc: "Publique sua parada, siga outros usuários e interaja com fãs de música como você.", accent: "#8338EC" },
              { n: "03", title: "Influencie as paradas", desc: "Cada posição do seu ranking gera pontos para as músicas e ajuda a formar as paradas globais do ChartFM.", accent: "#06D6A0" },
            ].map((s) => (
              <div key={s.n} style={{ background: "var(--fill-subtle)", borderRadius: 20, padding: 30, border: "1px solid var(--divider)" }}>
                <div style={{ fontSize: 54, fontWeight: 800, letterSpacing: "-0.04em", color: s.accent, lineHeight: 1, marginBottom: 14 }}>{s.n}</div>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 14, color: "var(--text-subtle)", lineHeight: 1.55 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PARADA GLOBAL — dark feature section */}
      <section id="parada-global" style={{
        padding: isMobile ? "60px 24px" : "100px 56px",
        background: "#0F0F12", color: "white",
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 60, alignItems: "center",
        }}>
          {/* Left: live chart preview */}
          <div style={{ position: "relative" }}>
            <div style={{
              background: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20, padding: 24,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FA243C", boxShadow: "0 0 0 3px rgba(250,36,60,0.2)" }} />
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, opacity: 0.7 }}>Parada global · ao vivo</div>
                <div style={{ flex: 1 }} />
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>{top10[0]?.voters ?? 0}+ fãs de música</div>
              </div>
              {top10.map((entry, i) => {
                return (
                  <div key={entry.position} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 0",
                    borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
                  }}>
                    <div style={{
                      width: 28, fontSize: 18, fontWeight: 800,
                      fontVariantNumeric: "tabular-nums", textAlign: "center" as const,
                      color: i < 3 ? "#FA243C" : "rgba(255,255,255,0.5)",
                    }}>{entry.position}</div>
                    {entry.cover.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.cover.imageUrl}
                        alt={entry.song.title}
                        style={{ width: 42, height: 42, borderRadius: 8, flexShrink: 0, objectFit: "cover" as const }}
                      />
                    ) : (
                      <div style={{
                        width: 42, height: 42, borderRadius: 8, flexShrink: 0,
                        background: `linear-gradient(135deg, ${entry.cover.palette[0]}, ${entry.cover.palette[1]})`,
                      }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{entry.song.title}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{entry.song.artist}</div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <StatusBadge status={entry.status} delta={entry.delta} newLabel={t("status.new")} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums", width: 50, textAlign: "right" as const, opacity: 0.9 }}>{entry.points.toLocaleString("pt-BR")}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: copy */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#FA243C", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 14 }}>Parada Global</div>
            <h2 style={{ fontSize: isMobile ? 32 : 44, fontWeight: 800, letterSpacing: "-0.04em", margin: "0 0 18px 0", lineHeight: 1.1 }}>
              O que o mundo<br />está ouvindo.
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.85)", lineHeight: 1.55, margin: "0 0 30px 0" }}>
            Toda semana, os rankings dos usuários se transformam nas paradas globais do ChartFM. Quanto mais alta uma música aparece, mais pontos ela recebe.
            </p>
            <button
              onClick={handleSignIn}
              disabled={signingIn}
              style={{
                padding: "13px 28px", borderRadius: 100,
                background: "#FA243C", color: "white",
                border: "none", fontSize: 14, fontWeight: 700,
                letterSpacing: "-0.01em", cursor: signingIn ? "not-allowed" : "pointer",
                boxShadow: "0 4px 18px rgba(250,36,60,0.4)",
                opacity: signingIn ? 0.7 : 1,
              }}
            >
              {signingIn ? "Entrando…" : "Ver parada completa →"}
            </button>
          </div>
        </div>
      </section>

      {/* FEATURE GRID — 4 recursos */}
      <section style={{ padding: isMobile ? "60px 24px" : "100px 56px", background: "var(--surface)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center" as const, marginBottom: 50 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#FA243C", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 12 }}>Recursos</div>
            <h2 style={{ fontSize: isMobile ? 32 : 44, fontWeight: 800, letterSpacing: "-0.04em", margin: 0, lineHeight: 1.1, color: "var(--text)" }}>
              Tudo para acompanhar<br />seu gosto musical.
            </h2>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)",
            gap: 18,
          }}>
            {[
              { title: "Estatísticas completas", desc: "Acompanhe pico, semanas na parada, entradas, quedas e o histórico de cada música." },
              { title: "Pessoas com o seu gosto", desc: "Descubra usuários com gostos parecidos e encontre novas músicas através das paradas deles." },
              { title: "A trajetória das músicas", desc: "Veja como cada faixa subiu, caiu ou permaneceu na sua parada ao longo das semanas." },
              { title: "Importe suas músicas", desc: "Conecte seu last.fm para montar suas paradas a partir do seu histórico de reprodução." },
            ].map((f) => (
              <div key={f.title} style={{ padding: 24, borderRadius: 16, border: "1px solid var(--divider)", background: "var(--fill-subtle)" }}>
                <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6, color: "var(--text)" }}>{f.title}</div>
                <div style={{ fontSize: 13, color: "var(--text-subtle)", lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        padding: isMobile ? "40px 24px 28px" : "56px 56px 36px",
        background: "var(--surface)",
        borderTop: "1px solid rgba(0,0,0,0.05)",
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "1.5fr 1fr 1fr 1fr 1fr",
          gap: isMobile ? 32 : 40,
        }}>
          <div style={{ gridColumn: isMobile ? "1 / -1" : undefined }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <ChartFMLogo size={28} />
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.025em", color: "var(--text)" }}>ChartFM</div>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, maxWidth: 280 }}>
              {t("landing.footerTagline")}
            </div>
          </div>
          {footerGroups.map(({ title, items }) => (
            <div key={title}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: "var(--text)" }}>{title}</div>
              {items.map((it) => (
                <Link
                  key={it.label}
                  href={it.href}
                  style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginBottom: 8, textDecoration: "none" }}
                >
                  {it.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div style={{
          maxWidth: 1200, margin: "40px auto 0",
          paddingTop: 24, borderTop: "1px solid rgba(0,0,0,0.05)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap" as const, gap: 8,
          fontSize: 12, color: "var(--text-muted)",
        }}>
          <div>{t("landing.rights", { year })}</div>
          <LanguageSwitcher />
        </div>
      </footer>

    </div>
  );
}

"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { USERS_DATA, COVER_PALETTES, COMMUNITIES } from "@/lib/data";
import { Avatar } from "@/components/ui/Avatar";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { GlobalChartEntry } from "@/lib/types";

function ChartifyIcon({ size = 18, color = "white" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} strokeWidth="2.4" fill="none" strokeLinecap="round">
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="12" y1="20" x2="12" y2="8" />
      <line x1="18" y1="20" x2="18" y2="4" />
    </svg>
  );
}

function StatusBadge({ status, delta }: { status: string; delta?: number | null }) {
  if (status === "new") return (
    <span style={{ background: "#1D1D1F", color: "white", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 100, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
      Nova
    </span>
  );
  if (status === "up") return (
    <span style={{ background: "#E8F8EE", color: "#1B873F", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 100 }}>
      ▲ {delta}
    </span>
  );
  if (status === "down") return (
    <span style={{ background: "#FDECEC", color: "#C5291C", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 100 }}>
      ▼ {Math.abs(delta ?? 0)}
    </span>
  );
  return (
    <span style={{ background: "#F2F2F7", color: "#86868B", fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 100 }}>
      —
    </span>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" stroke="white" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function LandingPage({ globalChart }: { globalChart: GlobalChartEntry[] }) {
  const isMobile = useIsMobile();
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = () => {
    setSigningIn(true);
    signIn("google", { callbackUrl: "/" }).catch(() => setSigningIn(false));
  };

  const covers = Array.from({ length: 25 }, (_, i) => COVER_PALETTES[i % COVER_PALETTES.length]);
  const top8 = globalChart.slice(0, 8);
  const previewUser = USERS_DATA[2];

  const heroEntries = [
    { position: 1, title: "The Fate of Ophelia", artist: "Taylor Swift",    palette: ["#7B5EA7", "#4A2D7F"], status: "new",  delta: null },
    { position: 2, title: "So Easy (To Fall in Love)", artist: "Olivia Dean", palette: ["#FF9A9E", "#F6A07A"], status: "up",   delta: 2    },
    { position: 3, title: "Manchild",             artist: "Sabrina Carpenter", palette: ["#FF6B9D", "#FF8C42"], status: "up",   delta: 1    },
    { position: 4, title: "Homewrecker",          artist: "Sombr",            palette: ["#3A3A4A", "#1A1A2E"], status: "down", delta: 1    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#FBFBFD", fontFamily: "inherit" }}>

      {/* NAVBAR */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(251,251,253,0.85)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        padding: isMobile ? "0 20px" : "0 56px",
        height: 60, display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #FA243C, #FF5858)", display: "grid", placeItems: "center", boxShadow: "0 2px 6px rgba(250,36,60,0.3)" }}>
            <ChartifyIcon size={18} />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.025em", color: "#1D1D1F" }}>Chartify</span>
        </div>
        {!isMobile && (
          <div style={{ display: "flex", gap: 28, fontSize: 14, color: "#1D1D1F", fontWeight: 500 }}>
            <span style={{ cursor: "pointer" }}>Como funciona</span>
            <span style={{ cursor: "pointer" }}>Comunidades</span>
            <span style={{ cursor: "pointer" }}>Parada Global</span>
            <span style={{ cursor: "pointer" }}>Curadores</span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {!isMobile && (
            <button onClick={handleSignIn} disabled={signingIn} style={{ background: "none", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "#1D1D1F" }}>
              Entrar
            </button>
          )}
          <button
            onClick={handleSignIn}
            disabled={signingIn}
            style={{
              padding: "8px 20px", borderRadius: 100,
              background: "#1D1D1F", color: "white",
              border: "none", fontSize: 13, fontWeight: 700,
              letterSpacing: "-0.01em", cursor: signingIn ? "not-allowed" : "pointer",
              opacity: signingIn ? 0.6 : 1,
            }}
          >
            {signingIn ? "Entrando…" : "Cadastrar"}
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
                Nova semana, nova parada · Toda segunda
              </span>
            </div>

            <h1 style={{
              fontSize: isMobile ? 52 : 72,
              fontWeight: 800, letterSpacing: "-0.045em",
              lineHeight: 1.0, color: "#1D1D1F",
              margin: "0 0 22px 0",
            }}>
              Sua trilha sonora,<br />
              <span style={{
                background: "linear-gradient(135deg, #FA243C, #FF8C42)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                em rede.
              </span>
            </h1>

            <p style={{
              fontSize: isMobile ? 16 : 19,
              color: "#6B6B70", lineHeight: 1.6,
              margin: "0 0 36px 0", maxWidth: 520,
            }}>
              Toda semana, monte seu top 1 a 100. Siga curadores, debata em comunidades temáticas e veja sua música favorita subir nas paradas globais — agregadas a partir de milhares de gostos reais.
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
                {signingIn ? "Entrando…" : "Criar minha primeira parada"}
                {!signingIn && (
                  <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </button>
              <a
                href="#parada-global"
                style={{
                  padding: "15px 22px", borderRadius: 100,
                  background: "white", color: "#1D1D1F",
                  border: "1.5px solid rgba(0,0,0,0.12)", fontSize: 14, fontWeight: 600,
                  letterSpacing: "-0.01em", cursor: "pointer", textDecoration: "none",
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                Ver demo (45s)
              </a>
            </div>

            {/* Social proof */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 32 }}>
              <div style={{ display: "flex" }}>
                {USERS_DATA.slice(0, 5).map((u, i) => (
                  <div key={u.id} style={{ marginLeft: i === 0 ? 0 : -10, border: "2px solid #FBFBFD", borderRadius: "50%" }}>
                    <Avatar user={u} size={32} />
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 13, color: "#6B6B70" }}>
                <div style={{ display: "flex", gap: 1, color: "#FFB000", marginBottom: 2 }}>
                  {"★★★★★".split("").map((s, i) => <span key={i}>{s}</span>)}
                </div>
                <div><b style={{ color: "#1D1D1F", fontWeight: 600 }}>+24 mil</b> curadores ativos esta semana</div>
              </div>
            </div>
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
                background: "white", borderRadius: 20,
                boxShadow: "0 30px 80px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.08)",
                padding: 22, border: "1px solid rgba(0,0,0,0.04)",
                zIndex: 1,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <Avatar user={previewUser} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1D1D1F" }}>{previewUser.name}</div>
                    <div style={{ fontSize: 11, color: "#86868B" }}>Top 10 · Esta semana · 2026</div>
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
                    <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: entry.position <= 3 ? "#FA243C" : "#86868B", textAlign: "center" as const }}>
                      {entry.position}
                    </div>
                    <div style={{
                      width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                      background: `linear-gradient(135deg, ${entry.palette[0]}, ${entry.palette[1]})`,
                    }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1D1D1F", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {entry.title}
                      </div>
                      <div style={{ fontSize: 11, color: "#86868B", marginTop: 1 }}>{entry.artist}</div>
                    </div>
                    <StatusBadge status={entry.status} delta={entry.delta} />
                  </div>
                ))}
              </div>

              {/* Floating community pill */}
              <div style={{
                position: "absolute", bottom: 50, right: 0,
                background: "white", borderRadius: 16,
                boxShadow: "0 20px 50px rgba(0,0,0,0.12)",
                padding: 14, width: 240, border: "1px solid rgba(0,0,0,0.04)",
                display: "flex", alignItems: "center", gap: 10, zIndex: 2,
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 11, flexShrink: 0,
                  background: "linear-gradient(135deg, #FA243C, #FF5858)",
                  display: "grid", placeItems: "center", fontSize: 22,
                }}>👑</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Divas Pop</div>
                  <div style={{ fontSize: 11, color: "#86868B" }}>24,1 mil membros · ao vivo</div>
                </div>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#06D6A0", boxShadow: "0 0 0 3px rgba(6,214,160,0.2)" }} />
              </div>

              {/* Floating notification */}
              <div style={{
                position: "absolute", top: 0, right: -20,
                background: "#1D1D1F", color: "white",
                borderRadius: 14, padding: "10px 14px",
                fontSize: 12, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 8,
                boxShadow: "0 12px 30px rgba(0,0,0,0.2)", zIndex: 2,
              }}>
                <span style={{ color: "#FFB000" }}>★</span>
                &ldquo;Luther&rdquo; entrou no #1 global
              </div>
            </div>
          )}
        </div>
      </section>

{/* COMO FUNCIONA — 3 steps */}
      <section style={{ padding: isMobile ? "60px 24px" : "100px 56px", background: "white" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center" as const, marginBottom: 60 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#FA243C", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 12 }}>Como funciona</div>
            <h2 style={{ fontSize: isMobile ? 32 : 48, fontWeight: 800, letterSpacing: "-0.04em", margin: "0 0 14px 0", lineHeight: 1.1, color: "#1D1D1F" }}>
              Três passos. Toda semana.
            </h2>
            <p style={{ fontSize: 17, color: "#6B6B70", maxWidth: 560, margin: "0 auto", lineHeight: 1.5 }}>
              O ritual é simples. O que você faz com ele é que define seu lugar na cena.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 24 }}>
            {[
              { n: "01", title: "Monte sua parada", desc: "De 1 a 100 músicas. Arraste para reordenar. Importe direto do Spotify ou Apple Music. A semana fecha toda segunda às 00h.", accent: "#FA243C" },
              { n: "02", title: "Compartilhe e debata", desc: "Sua parada vai pro feed dos seguidores. Entre em comunidades temáticas (Rockeiros, Divas Pop, Sertanejo…) e poste no feed imersivo.", accent: "#8338EC" },
              { n: "03", title: "Suba na parada global", desc: "Sua música #1 vale 100 pontos pra parada global. A do #2 vale 99. Veja o ranking agregado por comunidade ou geral.", accent: "#06D6A0" },
            ].map((s) => (
              <div key={s.n} style={{ background: "#FBFBFD", borderRadius: 20, padding: 30, border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: 54, fontWeight: 800, letterSpacing: "-0.04em", color: s.accent, lineHeight: 1, marginBottom: 14 }}>{s.n}</div>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 14, color: "#6B6B70", lineHeight: 1.55 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMMUNITIES FEATURE */}
      <section style={{ padding: isMobile ? "60px 24px" : "100px 56px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 60, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#8338EC", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 14 }}>Comunidades</div>
            <h2 style={{ fontSize: isMobile ? 32 : 44, fontWeight: 800, letterSpacing: "-0.04em", margin: "0 0 18px 0", lineHeight: 1.1, color: "#1D1D1F" }}>
              Encontre sua tribo.<br />Influencie a parada.
            </h2>
            <p style={{ fontSize: 16, color: "#6B6B70", lineHeight: 1.55, marginBottom: 24, margin: "0 0 28px 0" }}>
              Comunidades temáticas com parada global própria — agregada a partir das paradas pessoais dos membros. Poste imagens, vídeos do YouTube ou textos no feed imersivo estilo Reels. Comente, debata, brigue (educadamente).
            </p>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
              {[
                "Parada agregada da comunidade em tempo real",
                "Feed imersivo full-screen para posts",
                "Moderação por admins fundadores",
                "Comunidades públicas ou só por convite",
              ].map((b) => (
                <div key={b} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: "#8338EC", display: "grid", placeItems: "center", flexShrink: 0,
                  }}>
                    <CheckIcon />
                  </span>
                  <span style={{ color: "#1D1D1F" }}>{b}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Visual: stack of community cards */}
          {!isMobile && (
            <div style={{ position: "relative", height: 440 }}>
              {COMMUNITIES.slice(0, 4).map((c, i) => (
                <div
                  key={c.id}
                  style={{
                    position: "absolute",
                    top: i * 70,
                    left: i % 2 === 0 ? 0 : 60,
                    width: 320,
                    background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)",
                    boxShadow: `0 ${10 + i * 4}px ${30 + i * 8}px rgba(0,0,0,${(0.08 - i * 0.01).toFixed(2)})`,
                    overflow: "hidden",
                    transform: `rotate(${(i % 2 === 0 ? -1 : 1) * 2}deg)`,
                  }}
                >
                  <div style={{
                    height: 80,
                    background: `linear-gradient(135deg, ${c.cover[0]}, ${c.cover[1]})`,
                    display: "grid", placeItems: "center",
                  }}>
                    <div style={{ fontSize: 36 }}>{c.icon}</div>
                  </div>
                  <div style={{ padding: 14, display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: "#86868B" }}>{c.members.toLocaleString("pt-BR")} membros · {c.posts} posts</div>
                    </div>
                    <div style={{ display: "flex" }}>
                      {(c.memberSample ?? []).slice(0, 3).map((u, j) => (
                        <div key={u.id} style={{ marginLeft: j === 0 ? 0 : -6, border: "2px solid white", borderRadius: "50%" }}>
                          <Avatar user={u} size={22} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* GLOBAL CHART PREVIEW */}
      <section id="parada-global" style={{
        padding: isMobile ? "60px 24px" : "80px 56px",
        background: "white",
        borderTop: "1px solid rgba(0,0,0,0.05)", borderBottom: "1px solid rgba(0,0,0,0.05)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#FA243C", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 10 }}>Ao vivo</div>
            <h2 style={{ fontSize: isMobile ? 32 : 42, fontWeight: 800, letterSpacing: "-0.04em", color: "#1D1D1F", margin: 0 }}>
              Parada global desta semana
            </h2>
            <p style={{ fontSize: 14, color: "#86868B", marginTop: 8 }}>
              Baseada nos tops de {top8[0]?.voters ?? 0}+ curadores ativos
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
            gap: 10,
          }}>
            {top8.map((entry) => (
              <div key={entry.position} style={{
                display: "grid",
                gridTemplateColumns: "32px 48px 1fr auto",
                gap: 12, alignItems: "center",
                padding: "12px 16px",
                background: "#FBFBFD", borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}>
                <div style={{
                  fontSize: entry.position <= 3 ? 18 : 13,
                  fontWeight: 800,
                  color: entry.position <= 3 ? "#FA243C" : "#86868B",
                  textAlign: "center" as const,
                  letterSpacing: "-0.02em",
                }}>
                  {entry.position}
                </div>
                <div style={{
                  width: 48, height: 48, borderRadius: 10, flexShrink: 0,
                  background: `linear-gradient(135deg, ${entry.cover.palette[0]}, ${entry.cover.palette[1]})`,
                }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 700, color: "#1D1D1F",
                    whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis",
                    letterSpacing: "-0.01em",
                  }}>
                    {entry.song.title}
                  </div>
                  <div style={{ fontSize: 12, color: "#86868B", marginTop: 2 }}>{entry.song.artist}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 4 }}>
                  <StatusBadge status={entry.status} delta={entry.delta} />
                  <div style={{ fontSize: 11, color: "#86868B" }}>{entry.points} pts</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center" as const, marginTop: 32 }}>
            <button
              onClick={handleSignIn}
              disabled={signingIn}
              style={{
                padding: "12px 28px", borderRadius: 100,
                background: "transparent", color: "#1D1D1F",
                border: "1.5px solid rgba(0,0,0,0.12)", fontSize: 14, fontWeight: 700,
                cursor: signingIn ? "not-allowed" : "pointer",
              }}
            >
              Ver parada completa →
            </button>
          </div>
        </div>
      </section>

      {/* CURATORS / CTA */}
      <section style={{
        padding: isMobile ? "60px 24px" : "80px 56px",
        background: "#1D1D1F",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", textAlign: "center" as const }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#FA243C", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 16 }}>
            Comunidade
          </div>
          <h2 style={{
            fontSize: isMobile ? 32 : 48, fontWeight: 800,
            letterSpacing: "-0.04em", color: "white", margin: "0 0 12px 0",
          }}>
            Mais de 3.200 curadores<br />já estão na plataforma.
          </h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", margin: "0 0 48px 0" }}>
            De Pop a Metal, de Sertanejo a K-Pop — todo gosto tem espaço aqui.
          </p>

          {/* Avatar stack */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 48 }}>
            {USERS_DATA.map((u, i) => (
              <div key={u.id} style={{
                marginLeft: i === 0 ? 0 : -14,
                border: "3px solid #1D1D1F",
                borderRadius: "50%",
                zIndex: USERS_DATA.length - i,
                position: "relative",
              }}>
                <Avatar user={u} size={52} />
              </div>
            ))}
            <div style={{
              marginLeft: -14, width: 52, height: 52,
              borderRadius: "50%", background: "#FA243C",
              border: "3px solid #1D1D1F",
              display: "grid", placeItems: "center",
              fontSize: 11, fontWeight: 800, color: "white",
              letterSpacing: "-0.01em", position: "relative",
              zIndex: 0,
            }}>
              +3k
            </div>
          </div>

          <button
            onClick={handleSignIn}
            disabled={signingIn}
            style={{
              padding: "16px 40px", borderRadius: 100,
              background: "#FA243C", color: "white",
              border: "none", fontSize: 16, fontWeight: 700,
              letterSpacing: "-0.01em", cursor: signingIn ? "not-allowed" : "pointer",
              boxShadow: "0 4px 20px rgba(250,36,60,0.4)",
              opacity: signingIn ? 0.7 : 1,
            }}
          >
            {signingIn ? "Entrando…" : "Entrar na comunidade"}
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        padding: isMobile ? "24px 24px" : "24px 56px",
        borderTop: "1px solid rgba(0,0,0,0.06)",
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap" as const, gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg, #FA243C, #FF5858)", display: "grid", placeItems: "center" }}>
            <ChartifyIcon size={13} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#1D1D1F" }}>Chartify</span>
        </div>
        <div style={{ fontSize: 12, color: "#86868B" }}>
          © 2026 Chartify · Todos os direitos reservados
        </div>
      </footer>

    </div>
  );
}

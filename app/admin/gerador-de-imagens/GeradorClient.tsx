"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { scoreBadgeColor, scoreLabel } from "@/lib/album-score";
import { useIsMobile } from "@/hooks/useIsMobile";

export type GeradorData = {
  theme: string;
  round: number;
  clubThemes: { number: number; theme: string }[];
  nominationsDeadline: string;
  pollDeadline: string;
  nominations: { title: string; artist: string; coverUrl?: string | null }[];
  winners: { title: string; artist: string; year: string; votes: number; coverUrl?: string | null }[];
  ratable: { id: number; title: string; artist: string; year: string; score: number; reviewCount: number; coverUrl?: string | null }[];
  top5: { rank: number; title: string; artist: string; plays: string; move: string; coverUrl?: string | null }[];
  posts: { album: string; artist: string; score: number; reviewer: string; excerpt: string; coverUrl?: string | null }[];
  copaName: string;
  copaYear: number;
  copaStages: string[];
  copaArtistsPerUser: number;
  copaMaxParticipants: number;
  copaParticipantCount: number;
  copaStartsAt: string | null;
};

export type GeradorAlbum = GeradorData["ratable"][number];

type SocialFmt = { id: string; label: string; ratio: string; w: number; h: number; sub: string; bgImage?: string };

const SOCIAL_FORMATS: SocialFmt[] = [
  { id: "square",    label: "Quadrado",  ratio: "1:1",  w: 1254, h: 1254, sub: "Feed · Instagram", bgImage: "/quadrada.png" },
  { id: "portrait",  label: "Retrato",   ratio: "4:5",  w: 1080, h: 1350, sub: "Instagram" },
  { id: "story",     label: "Story",     ratio: "9:16", w: 768,  h: 1376, sub: "Stories", bgImage: "/story.png" },
  { id: "landscape", label: "Paisagem",  ratio: "16:9", w: 1672, h: 941,  sub: "Twitter · X", bgImage: "/retangular.png" },
];

const TYPES = [
  { id: "inscricao",  label: "Inscrição",         desc: "Chamada para indicar álbuns",       emoji: "📀", accent: "#FA243C" },
  { id: "votacao",    label: "Votação",            desc: "Chamada para votar na enquete",     emoji: "🗳️", accent: "#FFD426" },
  { id: "escolhidos", label: "Escolhidos",         desc: "Os 2 álbuns da semana",             emoji: "⭐", accent: "#FA243C" },
  { id: "nota",       label: "Nota do álbum",      desc: "Avaliação de um álbum",             emoji: "💯", accent: "#34C759" },
  { id: "top5",       label: "Top 5 Global",       desc: "Parada da semana",                  emoji: "🌎", accent: "#B89CFF" },
  { id: "posts",      label: "Posts",              desc: "Reviews em destaque da comunidade", emoji: "📝", accent: "#FA243C" },
  { id: "twitter",    label: "Twitter / X",        desc: "Post formato tweet",                emoji: "🐦", accent: "#1D9BF0" },
  { id: "copa-inscricao", label: "Copa · Inscrição", desc: "Chamada para se inscrever no torneio", emoji: "⚽", accent: "#FFD426" },
  { id: "copa-etapa", label: "Copa · Etapa",       desc: "Início de etapa — convite para votar", emoji: "🏆", accent: "#2EB550" },
];

type TemplateData = {
  theme: string;
  round: string;
  deadline: string;
  nominations: GeradorData["nominations"];
  winners: GeradorData["winners"];
  album: GeradorData["ratable"][0] | null;
  tracks: GeradorData["top5"];
  week: string;
  posts: GeradorData["posts"];
  postsTitle: string;
  copaName: string;
  copaYear: string;
  copaStage: string;
  copaArtistsPerUser: string;
  copaMaxParticipants: string;
  copaParticipantCount: string;
};

// ── Utility functions ─────────────────────────────────────────────────────────

function sHue(t: string): number {
  return Math.abs((t || "?").split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % 360;
}

// ── Shared template components ────────────────────────────────────────────────

function SCover({ title, size, radius = 18, fontScale = 0.4, imageUrl }: { title: string; size: number; radius?: number; fontScale?: number; imageUrl?: string | null }) {
  const hue = sHue(title);
  if (imageUrl) {
    return (
      <div style={{ width: size, height: size, borderRadius: radius, flexShrink: 0, overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: `linear-gradient(145deg, hsl(${hue},52%,58%), hsl(${(hue + 40) % 360},48%,46%))`,
      display: "grid", placeItems: "center", color: "#fff", fontWeight: 800,
      fontSize: size * fontScale, userSelect: "none",
    }}>
      {(title || "?")[0].toUpperCase()}
    </div>
  );
}

function SLogo({ u }: { u: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: Math.round(11 * u) }}>
      <div style={{ width: Math.round(44 * u), height: Math.round(44 * u), borderRadius: Math.round(11 * u), background: "#FA243C", display: "grid", placeItems: "center", flexShrink: 0 }}>
        <svg width={Math.round(24 * u)} height={Math.round(24 * u)} viewBox="0 0 24 24" fill="#fff">
          <rect x="3"  y="13" width="4" height="8"  rx="1.5" />
          <rect x="10" y="8"  width="4" height="13" rx="1.5" />
          <rect x="17" y="4"  width="4" height="17" rx="1.5" />
        </svg>
      </div>
      <span style={{ fontSize: Math.round(27 * u), fontWeight: 800, letterSpacing: "-0.03em", color: "#1D1D1F" }}>ChartFM</span>
    </div>
  );
}

function SEyebrow({ u, children, color = "#FA243C", bg = "rgba(250,36,60,0.10)" }: { u: number; children: React.ReactNode; color?: string; bg?: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: Math.round(8 * u), alignSelf: "flex-start",
      background: bg, color, borderRadius: 9999, padding: `${Math.round(9 * u)}px ${Math.round(18 * u)}px`,
      fontSize: Math.round(19 * u), fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
    }}>
      {children}
    </span>
  );
}

function SClock({ u }: { u: number }) {
  return (
    <svg width={Math.round(22 * u)} height={Math.round(22 * u)} viewBox="0 0 24 24" fill="none" stroke="#FA243C" strokeWidth="2.2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function LightBg({ fmt, children }: { fmt: SocialFmt; children: React.ReactNode }) {
  const u = fmt.w / 1080;
  const v = fmt.h / 1080;

  function DotsGrid({ cols, rows, top, bottom, left, right }: { cols: number; rows: number; top?: number | string; bottom?: number | string; left?: number | string; right?: number | string }) {
    return (
      <div style={{
        position: "absolute", top, bottom, left, right,
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, ${Math.round(13 * u)}px)`,
        gap: `${Math.round(8 * u)}px`,
        pointerEvents: "none",
      }}>
        {Array.from({ length: cols * rows }).map((_, i) => (
          <div key={i} style={{ width: Math.round(4.5 * u), height: Math.round(4.5 * u), borderRadius: "50%", background: "#FA243C", opacity: 0.20 }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{
      width: fmt.w, height: fmt.h,
      background: "#FCFCFD",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
      overflow: "hidden", position: "relative", color: "#1D1D1F",
    }}>
      {/* Blob top-right */}
      <svg style={{ position: "absolute", top: 0, right: 0, pointerEvents: "none" }}
           width={Math.round(560 * u)} height={Math.round(330 * u)} viewBox="0 0 560 330">
        <defs>
          <linearGradient id="lbg1" x1="100%" y1="0" x2="0" y2="100%">
            <stop offset="0%"   stopColor="#FA243C" stopOpacity=".14" />
            <stop offset="100%" stopColor="#FFB8C2" stopOpacity=".02" />
          </linearGradient>
        </defs>
        <path d="M560,0 L560,195 Q510,330 390,296 Q210,252 228,114 Q252,-30 560,0Z" fill="url(#lbg1)" />
      </svg>

      {/* Wave bottom */}
      <svg style={{ position: "absolute", bottom: 0, left: 0, pointerEvents: "none" }}
           width={fmt.w} height={Math.round(200 * u)} viewBox="0 0 1080 200" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lbg2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#FFD0D8" stopOpacity=".20" />
            <stop offset="100%" stopColor="#FFB8C8" stopOpacity=".50" />
          </linearGradient>
        </defs>
        <path d="M0,136 Q270,68 540,104 Q810,140 1080,78 L1080,200 L0,200Z" fill="url(#lbg2)" />
      </svg>

      {/* Red pill left — height and top scale with v (vertical axis) */}
      <div style={{
        position: "absolute",
        left: Math.round(-48 * u), top: Math.round(140 * v),
        width: Math.round(110 * u), height: Math.round(680 * v),
        borderRadius: 9999,
        background: "linear-gradient(180deg,#FA243C 0%,#FF7098 55%,#FFBCCA 100%)",
        pointerEvents: "none",
      }} />

      {/* Chart bars bottom-right — heights scale with v */}
      <div style={{ position: "absolute", right: Math.round(44 * u), bottom: 0, display: "flex", alignItems: "flex-end", gap: Math.round(14 * u), pointerEvents: "none" }}>
        {[
          { h: 200, op: 0.45, c: "linear-gradient(180deg,#FFB8C8,#FFD8E2)" },
          { h: 320, op: 0.62, c: "linear-gradient(180deg,#FF88A8,#FFB8C8)" },
          { h: 470, op: 0.80, c: "linear-gradient(180deg,#FA243C,#FF88A8)" },
        ].map((b, i) => (
          <div key={i} style={{
            width: Math.round(66 * u), height: Math.round(b.h * v),
            borderRadius: `${Math.round(100 * u)}px ${Math.round(100 * u)}px 0 0`,
            background: b.c, opacity: b.op,
          }} />
        ))}
      </div>

      <DotsGrid cols={6} rows={Math.round(5 * v)} top={Math.round(68 * u)} right={Math.round(68 * u)} />
      <DotsGrid cols={6} rows={Math.max(3, Math.round(4 * v))} bottom={Math.round(68 * u)} left={Math.round(108 * u)} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", height: "100%" }}>
        {children}
      </div>
    </div>
  );
}

/** Fundo oficial (PNG) ou fallback CSS desenhado (LightBg). */
function ChartBg({ fmt, children }: { fmt: SocialFmt; children: React.ReactNode }) {
  if (fmt.bgImage) {
    return (
      <div
        style={{
          width: fmt.w,
          height: fmt.h,
          position: "relative",
          overflow: "hidden",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
          color: "#1D1D1F",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fmt.bgImage}
          alt=""
          width={fmt.w}
          height={fmt.h}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill", pointerEvents: "none" }}
        />
        <div style={{ position: "relative", zIndex: 1, width: "100%", height: "100%" }}>{children}</div>
      </div>
    );
  }
  return <LightBg fmt={fmt}>{children}</LightBg>;
}

function ChartHeader({ fmt, u, right }: { fmt: SocialFmt; u: number; right?: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: fmt.bgImage ? "flex-end" : "space-between",
        minHeight: fmt.bgImage ? Math.round(52 * u) : undefined,
      }}
    >
      {!fmt.bgImage && <SLogo u={u} />}
      {right}
    </div>
  );
}

// ── Template 1: Inscrição ─────────────────────────────────────────────────────

function TplInscricao({ fmt, d }: { fmt: SocialFmt; d: TemplateData }) {
  const u = fmt.w / 1080;
  const landscape = fmt.w > fmt.h;
  const pad = Math.round((landscape ? 56 : 72) * u);
  return (
    <ChartBg fmt={fmt}>
      <div style={{ padding: `${pad}px`, height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <ChartHeader
          fmt={fmt}
          u={u}
          right={<span style={{ fontSize: Math.round(20 * u), fontWeight: 700, color: "#86868B", letterSpacing: "-0.01em" }}>Clube do Álbum</span>}
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: Math.round(22 * u) }}>
          <SEyebrow u={u}>📀 Inscrições abertas · Rodada {d.round}</SEyebrow>
          <div style={{ fontSize: Math.round(30 * u), fontWeight: 600, color: "#86868B", letterSpacing: "-0.01em" }}>Tema da semana</div>
          <div style={{ fontSize: Math.round((landscape ? 72 : 92) * u), fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.98, color: "#1D1D1F" }}>
            {d.theme}
          </div>
          <div style={{ fontSize: Math.round(32 * u), fontWeight: 500, color: "#3A3A3C", lineHeight: 1.4, maxWidth: Math.round(820 * u), marginTop: Math.round(4 * u) }}>
            Indique <b style={{ color: "#FA243C" }}>2 álbuns</b> que combinam com o tema. As indicações viram enquete!
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1.5px solid rgba(0,0,0,0.08)", paddingTop: Math.round(32 * u) }}>
          <div style={{ display: "flex", alignItems: "center", gap: Math.round(10 * u), fontSize: Math.round(28 * u), fontWeight: 700, color: "#1D1D1F" }}>
            <SClock u={u} /> Até {d.deadline}
          </div>
          <div style={{ fontSize: Math.round(26 * u), fontWeight: 800, background: "#FA243C", color: "#fff", borderRadius: 9999, padding: `${Math.round(14 * u)}px ${Math.round(30 * u)}px` }}>
            chartfm.com.br/criticsfm
          </div>
        </div>
      </div>
    </ChartBg>
  );
}

// ── Template 2: Votação ───────────────────────────────────────────────────────

function TplVotacao({ fmt, d }: { fmt: SocialFmt; d: TemplateData }) {
  const u = fmt.w / 1080;
  const landscape = fmt.w > fmt.h;
  const pad = Math.round((landscape ? 56 : 72) * u);
  const noms = d.nominations.slice(0, 6);
  const coverSize = Math.min(Math.round(140 * u), Math.round((fmt.w - pad * 2 - Math.round(50 * u) * 5) / 6));
  return (
    <ChartBg fmt={fmt}>
      <div style={{ padding: `${pad}px`, height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <ChartHeader
          fmt={fmt}
          u={u}
          right={<span style={{ fontSize: Math.round(20 * u), fontWeight: 700, color: "#86868B" }}>Clube do Álbum · Rodada {d.round}</span>}
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: Math.round(24 * u) }}>
          <SEyebrow u={u} color="#C47500" bg="rgba(255,165,0,0.12)">🗳️ Enquete aberta</SEyebrow>
          <div style={{ fontSize: Math.round((landscape ? 64 : 78) * u), fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.0 }}>
            Vote nos álbuns<br />que quer ouvir
          </div>
          <div style={{ fontSize: Math.round(32 * u), fontWeight: 500, color: "#3A3A3C", lineHeight: 1.35 }}>
            Escolha <b style={{ color: "#1D1D1F" }}>pelo menos 7</b> entre as indicações de <b style={{ color: "#FA243C" }}>{d.theme}</b>.
          </div>
          {noms.length > 0 && (
            <div style={{ display: "flex", gap: Math.round(18 * u), marginTop: Math.round(10 * u) }}>
              {noms.map((a, i) => (
                <SCover key={i} title={a.title} size={coverSize} radius={Math.round(14 * u)} imageUrl={a.coverUrl} />
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1.5px solid rgba(0,0,0,0.08)", paddingTop: Math.round(32 * u) }}>
          <div style={{ display: "flex", alignItems: "center", gap: Math.round(10 * u), fontSize: Math.round(28 * u), fontWeight: 700, color: "#1D1D1F" }}>
            <SClock u={u} /> Enquete até {d.deadline}
          </div>
          <div style={{ fontSize: Math.round(24 * u), fontWeight: 700, color: "#86868B" }}>chartfm.com.br/criticsfm</div>
        </div>
      </div>
    </ChartBg>
  );
}

// ── Template 3: Escolhidos ────────────────────────────────────────────────────

function TplEscolhidos({ fmt, d }: { fmt: SocialFmt; d: TemplateData }) {
  const u = fmt.w / 1080;
  const m = Math.min(fmt.w, fmt.h) / 1080;
  const landscape = fmt.w > fmt.h;
  const pad = Math.round((landscape ? 56 : 72) * u);
  const coverSize = landscape
    ? Math.round(260 * m)
    : Math.min(Math.round(400 * u), Math.round((fmt.w - pad * 2 - Math.round(60 * u)) / 2));

  return (
    <ChartBg fmt={fmt}>
      <div style={{ padding: `${pad}px`, height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <ChartHeader
          fmt={fmt}
          u={u}
          right={<span style={{ fontSize: Math.round(20 * u), fontWeight: 700, color: "#86868B" }}>Rodada {d.round}</span>}
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: Math.round(18 * u), textAlign: "center" }}>
          <SEyebrow u={u}>⭐ Escolhidos da semana</SEyebrow>
          <div style={{ fontSize: Math.round((landscape ? 46 : 54) * u), fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.0, marginBottom: Math.round(8 * u) }}>
            {d.theme}
          </div>
          <div style={{ display: "flex", gap: Math.round(44 * u), justifyContent: "center", alignItems: "flex-start", marginTop: Math.round(8 * u) }}>
            {d.winners.map((w, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: Math.round(18 * u), width: coverSize }}>
                <div style={{ position: "relative" }}>
                  <SCover title={w.title} size={coverSize} radius={Math.round(22 * u)} fontScale={0.42} imageUrl={w.coverUrl} />
                  <div style={{
                    position: "absolute", top: Math.round(-16 * u), left: Math.round(-16 * u),
                    width: Math.round(56 * u), height: Math.round(56 * u), borderRadius: "50%",
                    background: i === 0 ? "#FA243C" : "#E0E0E5",
                    color: i === 0 ? "#fff" : "#1D1D1F",
                    display: "grid", placeItems: "center",
                    fontSize: Math.round(24 * u), fontWeight: 800,
                    boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
                  }}>
                    {i + 1}°
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: Math.round(30 * u), fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{w.title}</div>
                  <div style={{ fontSize: Math.round(22 * u), fontWeight: 500, color: "#86868B", marginTop: Math.round(5 * u) }}>{w.artist} · {w.year}</div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: Math.round(7 * u), marginTop: Math.round(12 * u), background: "rgba(250,36,60,0.10)", borderRadius: 9999, padding: `${Math.round(8 * u)}px ${Math.round(18 * u)}px`, fontSize: Math.round(22 * u), fontWeight: 700, color: "#FA243C" }}>
                    {w.votes} votos
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: Math.round(24 * u), fontWeight: 700, color: "#86868B" }}>
          chartfm.com.br/criticsfm
        </div>
      </div>
    </ChartBg>
  );
}

// ── Template 4: Nota do álbum ─────────────────────────────────────────────────

function TplNota({ fmt, d }: { fmt: SocialFmt; d: TemplateData }) {
  const u = fmt.w / 1080;
  const m = Math.min(fmt.w, fmt.h) / 1080;
  const landscape = fmt.w > fmt.h;
  const pad = Math.round((landscape ? 56 : 72) * u);
  const coverSize = landscape ? Math.round(340 * m) : Math.round(460 * u);
  const a = d.album;
  const sc = scoreBadgeColor(a?.score ?? 0);

  return (
    <ChartBg fmt={fmt}>
      <div style={{ padding: `${pad}px`, height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <ChartHeader
          fmt={fmt}
          u={u}
          right={
            <span style={{ fontSize: Math.round(20 * u), fontWeight: 700, color: "#86868B", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Nota da comunidade
            </span>
          }
        />

        <div style={{ flex: 1, display: "flex", flexDirection: landscape ? "row" : "column", alignItems: "center", justifyContent: "center", gap: landscape ? Math.round(64 * u) : Math.round(40 * u) }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <SCover title={a?.title ?? "?"} size={coverSize} radius={Math.round(26 * u)} fontScale={0.4} imageUrl={a?.coverUrl} />
            <div style={{
              position: "absolute", bottom: Math.round(-28 * u), right: Math.round(-28 * u),
              width: Math.round(158 * m), height: Math.round(158 * m), borderRadius: Math.round(26 * m),
              background: sc, display: "grid", placeItems: "center",
              boxShadow: `0 ${Math.round(16 * m)}px ${Math.round(40 * m)}px ${sc}55`,
              border: `${Math.max(4, Math.round(5 * u))}px solid #FCFCFD`,
            }}>
              <span style={{ fontSize: Math.round(70 * m), fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                {a?.score}
              </span>
            </div>
          </div>

          <div style={{ textAlign: landscape ? "left" : "center", maxWidth: landscape ? Math.round(500 * u) : Math.round(840 * u) }}>
            <div style={{ fontSize: Math.round((landscape ? 54 : 60) * u), fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.02 }}>
              {a?.title}
            </div>
            <div style={{ fontSize: Math.round(30 * u), fontWeight: 500, color: "#86868B", marginTop: Math.round(12 * u) }}>
              {a?.artist} · {a?.year}
            </div>
            <div style={{ display: "flex", gap: Math.round(12 * u), marginTop: Math.round(26 * u), justifyContent: landscape ? "flex-start" : "center", flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", background: `${sc}22`, color: sc, borderRadius: 9999, padding: `${Math.round(10 * u)}px ${Math.round(22 * u)}px`, fontSize: Math.round(24 * u), fontWeight: 700 }}>
                {scoreLabel(a?.score ?? 0)}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", background: "rgba(0,0,0,0.06)", borderRadius: 9999, padding: `${Math.round(10 * u)}px ${Math.round(22 * u)}px`, fontSize: Math.round(24 * u), fontWeight: 700, color: "#3A3A3C" }}>
                {a?.reviewCount} reviews
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1.5px solid rgba(0,0,0,0.08)", paddingTop: Math.round(30 * u) }}>
          <span style={{ fontSize: Math.round(24 * u), fontWeight: 600, color: "#86868B" }}>
            CriticsFM{d.theme.trim() ? ` · ${d.theme.trim()}` : ""}
          </span>
          <span style={{ fontSize: Math.round(24 * u), fontWeight: 700, color: "#86868B" }}>chartfm.com.br/criticsfm</span>
        </div>
      </div>
    </ChartBg>
  );
}

// ── Template 5: Top 5 Global ──────────────────────────────────────────────────

function MoveIcon({ move, u }: { move: string; u: number }) {
  if (move === "up")   return <svg width={Math.round(24 * u)} height={Math.round(24 * u)} viewBox="0 0 24 24" fill="none" stroke="#2EB550" strokeWidth="3" strokeLinecap="round"><polyline points="6 14 12 8 18 14" /></svg>;
  if (move === "down") return <svg width={Math.round(24 * u)} height={Math.round(24 * u)} viewBox="0 0 24 24" fill="none" stroke="#FF6B5C" strokeWidth="3" strokeLinecap="round"><polyline points="6 10 12 16 18 10" /></svg>;
  if (move === "new")  return <span style={{ fontSize: Math.round(15 * u), fontWeight: 800, color: "#FA243C", letterSpacing: "0.04em" }}>NEW</span>;
  return <span style={{ width: Math.round(20 * u), height: Math.round(3 * u), background: "rgba(0,0,0,0.2)", borderRadius: 2, display: "block" }} />;
}

function TplTop5({ fmt, d }: { fmt: SocialFmt; d: TemplateData }) {
  const u = fmt.w / 1080;
  const landscape = fmt.w > fmt.h;
  const story = fmt.h > fmt.w * 1.4;
  const trackCount = story ? 10 : 5;
  const tracks = d.tracks.slice(0, trackCount);

  const pad = Math.round((landscape ? 40 : story ? 52 : 72) * u);
  const headerReserved = Math.round((landscape ? 44 : story ? 44 : 60) * u);
  const titleReserved = Math.round((landscape ? 68 : story ? 72 : 130) * u);
  const footerReserved = Math.round((landscape ? 28 : story ? 28 : 50) * u);
  const listH = fmt.h - pad * 2 - headerReserved - titleReserved - footerReserved;
  const rowH = listH / Math.max(tracks.length, 1);

  const rankSize = landscape ? Math.round(40 * u) : story ? Math.round(34 * u) : Math.round(58 * u);
  const rankW = landscape ? Math.round(46 * u) : story ? Math.round(40 * u) : Math.round(68 * u);
  const coverSize = Math.min(
    landscape ? Math.round(64 * u) : story ? Math.round(54 * u) : Math.round(90 * u),
    Math.round(rowH * 0.82),
  );
  const titleSize = landscape ? Math.round(28 * u) : story ? Math.round(24 * u) : Math.round(36 * u);
  const artistSize = landscape ? Math.round(20 * u) : story ? Math.round(17 * u) : Math.round(25 * u);
  const playsSize = landscape ? Math.round(22 * u) : story ? Math.round(19 * u) : Math.round(28 * u);
  const ptsSize = landscape ? Math.round(15 * u) : story ? Math.round(13 * u) : Math.round(18 * u);
  const rowPadY = landscape ? Math.round(5 * u) : story ? Math.round(3 * u) : Math.round(16 * u);
  const rowGap = landscape ? Math.round(14 * u) : story ? Math.round(10 * u) : Math.round(22 * u);
  const moveW = landscape ? Math.round(36 * u) : story ? Math.round(30 * u) : Math.round(44 * u);
  const moveU = landscape ? u * 0.82 : story ? u * 0.78 : u;
  const coverRadius = Math.round((landscape ? 10 : story ? 9 : 12) * u);
  const titleMargin = landscape
    ? `${Math.round(10 * u)}px 0 ${Math.round(8 * u)}px`
    : story
      ? `${Math.round(12 * u)}px 0 ${Math.round(8 * u)}px`
      : `${Math.round(26 * u)}px 0 ${Math.round(18 * u)}px`;

  return (
    <ChartBg fmt={fmt}>
      <div style={{ padding: `${pad}px`, height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <ChartHeader
          fmt={fmt}
          u={u}
          right={<span style={{ fontSize: Math.round((landscape || story ? 17 : 20) * u), fontWeight: 700, color: "#86868B" }}>{d.week}</span>}
        />

        <div style={{ margin: titleMargin }}>
          <SEyebrow u={landscape || story ? u * 0.82 : u} color="#7B5EDB" bg="rgba(123,94,219,0.12)">🌎 Parada Global</SEyebrow>
          <div style={{
            fontSize: Math.round((landscape ? 44 : story ? 52 : 72) * u),
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1.0,
            marginTop: Math.round((landscape || story ? 8 : 16) * u),
          }}>
            {story ? "Top 10 da semana" : "Top 5 da semana"}
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: landscape || story ? "flex-start" : "center", minHeight: 0 }}>
          {tracks.map((t, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: rowGap,
              height: Math.round(rowH),
              boxSizing: "border-box",
              padding: `${rowPadY}px 0`,
              borderBottom: i < tracks.length - 1 ? "1.5px solid rgba(0,0,0,0.07)" : "none",
            }}>
              <span style={{ fontSize: rankSize, fontWeight: 800, width: rankW, textAlign: "center", flexShrink: 0, color: i === 0 ? "#FA243C" : "rgba(0,0,0,0.75)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                {t.rank}
              </span>
              <SCover title={t.title} size={coverSize} radius={coverRadius} fontScale={0.42} imageUrl={t.coverUrl} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: titleSize, fontWeight: 800, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.1 }}>{t.title}</div>
                <div style={{ fontSize: artistSize, fontWeight: 500, color: "#86868B", marginTop: Math.round((landscape || story ? 2 : 3) * u), lineHeight: 1.1 }}>{t.artist}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: playsSize, fontWeight: 700, color: "#1D1D1F", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{t.plays}</div>
                <div style={{ fontSize: ptsSize, color: "#86868B", marginTop: Math.round(1 * u), lineHeight: 1.1 }}>pts</div>
              </div>
              <div style={{ width: moveW, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                <MoveIcon move={t.move} u={moveU} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", fontSize: Math.round((landscape || story ? 20 : 24) * u), fontWeight: 700, color: "#86868B", marginTop: Math.round((landscape ? 6 : story ? 8 : 18) * u) }}>
          chartfm.com.br/global
        </div>
      </div>
    </ChartBg>
  );
}

// ── Template 6: Posts ─────────────────────────────────────────────────────────

function TplPosts({ fmt, d }: { fmt: SocialFmt; d: TemplateData }) {
  const u = fmt.w / 1080;
  const landscape = fmt.w > fmt.h;
  const story = fmt.h > fmt.w * 1.4;
  const posts = d.posts;
  const maxCards = story ? 4 : 3;
  const visible = posts.slice(0, maxCards);
  const titleText = d.postsTitle || "O que a\ncomunidade\nestá curtindo";
  const pad = Math.round((landscape ? 56 : 72) * u);

  return (
    <ChartBg fmt={fmt}>
      <div style={{ padding: `${pad}px`, height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <ChartHeader
          fmt={fmt}
          u={u}
          right={<span style={{ fontSize: Math.round(20 * u), fontWeight: 700, color: "#86868B", letterSpacing: "-0.01em" }}>CriticsFM</span>}
        />

        <div style={{ marginTop: Math.round((landscape ? 28 : 40) * u), marginBottom: Math.round((landscape ? 16 : 22) * u) }}>
          <SEyebrow u={u}>✍️ Últimas reviews</SEyebrow>
          <div style={{
            fontSize: Math.round((landscape ? 44 : 58) * u),
            fontWeight: 800, letterSpacing: "-0.04em",
            lineHeight: 1.02, color: "#1D1D1F",
            whiteSpace: "pre-line", marginTop: Math.round(14 * u),
          }}>
            {titleText}
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: landscape ? "row" : "column", gap: Math.round(11 * u), overflow: "hidden", minHeight: 0 }}>
          {visible.map((p, i) => {
            const sc = scoreBadgeColor(p.score ?? 0);
            return (
              <div key={i} style={{
                flex: 1,
                background: "#FFFFFF",
                borderRadius: Math.round(20 * u),
                border: "1px solid rgba(0,0,0,.07)",
                padding: `${Math.round(18 * u)}px ${Math.round(22 * u)}px`,
                display: "flex", alignItems: "center",
                gap: Math.round(16 * u),
                boxShadow: "0 2px 18px rgba(0,0,0,.06)",
                overflow: "hidden", minHeight: 0,
              }}>
                <SCover
                  title={p.album || "?"}
                  size={landscape ? Math.round(62 * u) : Math.round(68 * u)}
                  radius={Math.round(12 * u)}
                  fontScale={0.38}
                  imageUrl={p.coverUrl}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: Math.round(22 * u), fontWeight: 800, letterSpacing: "-0.02em", color: "#1D1D1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.album}
                  </div>
                  <div style={{ fontSize: Math.round(16 * u), color: "#86868B", marginTop: Math.round(2 * u) }}>
                    {p.artist}
                  </div>
                  {p.excerpt && !landscape && (
                    <div style={{
                      fontSize: Math.round(14 * u), color: "#6B6B70",
                      marginTop: Math.round(7 * u), lineHeight: 1.45,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}>
                      &ldquo;{p.excerpt}&rdquo;
                    </div>
                  )}
                </div>
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: Math.round(5 * u) }}>
                  <div style={{
                    width: Math.round(56 * u), height: Math.round(56 * u),
                    borderRadius: Math.round(13 * u), background: sc,
                    display: "grid", placeItems: "center",
                    fontSize: Math.round(24 * u), fontWeight: 800,
                    color: "#fff", fontVariantNumeric: "tabular-nums",
                    boxShadow: `0 4px 14px ${sc}55`,
                  }}>
                    {p.score || "—"}
                  </div>
                  <div style={{ fontSize: Math.round(12 * u), color: "#86868B", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {p.reviewer}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: Math.round(20 * u), fontSize: Math.round(20 * u), fontWeight: 700, color: "#86868B", textAlign: "center" }}>
          chartfm.com.br/criticsfm
        </div>
      </div>
    </ChartBg>
  );
}

// ── Template 7: Copa · Inscrições ─────────────────────────────────────────────

function TplCopaInscricao({ fmt, d }: { fmt: SocialFmt; d: TemplateData }) {
  const u = fmt.w / 1080;
  const landscape = fmt.w > fmt.h;
  const pad = Math.round((landscape ? 56 : 72) * u);
  const artists = Number(d.copaArtistsPerUser) || 8;
  const maxP = Number(d.copaMaxParticipants) || 8;
  const countP = Number(d.copaParticipantCount) || 0;

  return (
    <ChartBg fmt={fmt}>
      <div style={{ padding: `${pad}px`, height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <ChartHeader
          fmt={fmt}
          u={u}
          right={
            <span style={{ fontSize: Math.round(20 * u), fontWeight: 700, color: "#86868B", letterSpacing: "-0.01em" }}>
              Copa ChartFM
            </span>
          }
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: Math.round(22 * u) }}>
          <SEyebrow u={u} color="#C47500" bg="rgba(255,212,38,0.16)">⚽ Inscrições abertas</SEyebrow>

          <div style={{ fontSize: Math.round((landscape ? 72 : 88) * u), fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.98, color: "#1D1D1F" }}>
            {d.copaName}{d.copaYear ? ` ${d.copaYear}` : ""}
          </div>

          <div style={{ fontSize: Math.round(32 * u), fontWeight: 500, color: "#3A3A3C", lineHeight: 1.4, maxWidth: Math.round(820 * u), marginTop: Math.round(4 * u) }}>
            Inscreva-se e escolha <b style={{ color: "#1D1D1F" }}>{artists} artista{artists !== 1 ? "s" : ""}</b> para representar seu time no torneio. A comunidade vota nos confrontos até a final!
          </div>

          {maxP > 0 && (
            <div style={{
              display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: Math.round(10 * u),
              background: "rgba(46,181,80,0.12)", color: "#1A7A34", borderRadius: 9999,
              padding: `${Math.round(10 * u)}px ${Math.round(18 * u)}px`,
              fontSize: Math.round(22 * u), fontWeight: 700,
            }}>
              {countP}/{maxP} participante{maxP !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1.5px solid rgba(0,0,0,0.08)", paddingTop: Math.round(32 * u) }}>
          <div style={{ display: "flex", alignItems: "center", gap: Math.round(10 * u), fontSize: Math.round(28 * u), fontWeight: 700, color: "#1D1D1F" }}>
            {d.deadline && d.deadline !== "—" ? (
              <><SClock u={u} /> Inscrições até {d.deadline}</>
            ) : (
              <><span style={{ fontSize: Math.round(28 * u) }}>🏆</span> Vagas limitadas</>
            )}
          </div>
          <div style={{ fontSize: Math.round(26 * u), fontWeight: 800, background: "#2EB550", color: "#fff", borderRadius: 9999, padding: `${Math.round(14 * u)}px ${Math.round(30 * u)}px` }}>
            chartfm.com.br/copa
          </div>
        </div>
      </div>
    </ChartBg>
  );
}

// ── Template 8: Copa · Início de etapa ───────────────────────────────────────

function CopaTrophyIcon({ u }: { u: number }) {
  const s = Math.round(120 * u);
  return (
    <svg width={s} height={s} viewBox="0 0 120 120" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="60" cy="60" r="56" fill="rgba(46,181,80,0.12)" />
      <path
        d="M38 28h44v8c0 14-6 26-16 32v14h-12V68c-10-6-16-18-16-32v-8Z"
        fill="url(#copaTrophy)"
        stroke="#2EB550"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M32 32H28c0 10 4 18 12 22M88 32h4c0 10-4 18-12 22" stroke="#2EB550" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="42" y="86" width="36" height="8" rx="4" fill="#2EB550" opacity="0.85" />
      <defs>
        <linearGradient id="copaTrophy" x1="38" y1="28" x2="82" y2="68">
          <stop offset="0%" stopColor="#FFD426" />
          <stop offset="100%" stopColor="#E8A800" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function TplCopaEtapa({ fmt, d }: { fmt: SocialFmt; d: TemplateData }) {
  const u = fmt.w / 1080;
  const landscape = fmt.w > fmt.h;
  const pad = Math.round((landscape ? 56 : 72) * u);

  return (
    <ChartBg fmt={fmt}>
      <div style={{ padding: `${pad}px`, height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <ChartHeader
          fmt={fmt}
          u={u}
          right={
            <span style={{ fontSize: Math.round(20 * u), fontWeight: 700, color: "#86868B", letterSpacing: "-0.01em" }}>
              {d.copaName}{d.copaYear ? ` ${d.copaYear}` : ""}
            </span>
          }
        />

        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: landscape ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          gap: landscape ? Math.round(48 * u) : Math.round(28 * u),
        }}>
          {!landscape && <CopaTrophyIcon u={u} />}

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: Math.round(22 * u), textAlign: landscape ? "left" : "center", alignItems: landscape ? "flex-start" : "center" }}>
            <SEyebrow u={u} color="#1A7A34" bg="rgba(46,181,80,0.14)">🏆 Etapa aberta · Vote agora</SEyebrow>

            <div style={{ fontSize: Math.round((landscape ? 58 : 68) * u), fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.98, color: "#1D1D1F" }}>
              Começou!
            </div>

            <div style={{
              fontSize: Math.round((landscape ? 44 : 52) * u),
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              color: "#FA243C",
              maxWidth: landscape ? Math.round(620 * u) : undefined,
            }}>
              {d.copaStage}
            </div>

            <div style={{
              fontSize: Math.round((landscape ? 28 : 32) * u),
              fontWeight: 500,
              color: "#3A3A3C",
              lineHeight: 1.4,
              maxWidth: Math.round(820 * u),
            }}>
              Os jogos estão <b style={{ color: "#1D1D1F" }}>ao vivo</b>. Entre na Copa, vote nos confrontos e ajude seu time a avançar no torneio!
            </div>
          </div>

          {landscape && <CopaTrophyIcon u={u * 0.9} />}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1.5px solid rgba(0,0,0,0.08)", paddingTop: Math.round(32 * u) }}>
          <div style={{ display: "flex", alignItems: "center", gap: Math.round(10 * u), fontSize: Math.round(26 * u), fontWeight: 700, color: "#1D1D1F" }}>
            <span style={{ fontSize: Math.round(28 * u) }}>⚽</span> Jogos ao vivo agora
          </div>
          <div style={{ fontSize: Math.round(26 * u), fontWeight: 800, background: "#2EB550", color: "#fff", borderRadius: 9999, padding: `${Math.round(14 * u)}px ${Math.round(30 * u)}px` }}>
            chartfm.com.br/copa
          </div>
        </div>
      </div>
    </ChartBg>
  );
}

// ── Template 8: Twitter / X ──────────────────────────────────────────────────

function XLogo({ size, color = "currentColor" }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.745l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function TplTwitter({ fmt, d }: { fmt: SocialFmt; d: TemplateData }) {
  const u = fmt.w / 1080;
  const landscape = fmt.w > fmt.h;
  const pad = Math.round((landscape ? 56 : 72) * u);
  const winners = d.winners.slice(0, 2);
  const cardW = Math.round(fmt.w * (landscape ? 0.78 : 0.95));
  const coverSize = Math.round((landscape ? 88 : 110) * u);

  return (
    <ChartBg fmt={fmt}>
      <div style={{ padding: `${pad}px`, height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        {/* Top bar */}
        <ChartHeader
          fmt={fmt}
          u={u}
          right={
            <div style={{ display: "flex", alignItems: "center", gap: Math.round(8 * u), color: "#536471" }}>
              <XLogo size={Math.round(20 * u)} color="#536471" />
              <span style={{ fontSize: Math.round(17 * u), fontWeight: 600, letterSpacing: "-0.01em" }}>twitter.com/chartfm</span>
            </div>
          }
        />

        {/* Tweet card */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            width: cardW,
            background: "#FFFFFF",
            borderRadius: Math.round(28 * u),
            border: "1.5px solid rgba(0,0,0,0.09)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.13), 0 4px 18px rgba(0,0,0,0.07)",
            padding: `${Math.round(30 * u)}px ${Math.round(34 * u)}px ${Math.round(22 * u)}px`,
            display: "flex",
            flexDirection: "column",
            gap: Math.round(16 * u),
          }}>
            {/* Profile row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: Math.round(12 * u) }}>
                <div style={{
                  width: Math.round(50 * u), height: Math.round(50 * u), borderRadius: "50%",
                  background: "#FA243C", display: "grid", placeItems: "center", flexShrink: 0,
                }}>
                  <svg width={Math.round(26 * u)} height={Math.round(26 * u)} viewBox="0 0 24 24" fill="#fff">
                    <rect x="3" y="13" width="4" height="8" rx="1.5" />
                    <rect x="10" y="8" width="4" height="13" rx="1.5" />
                    <rect x="17" y="4" width="4" height="17" rx="1.5" />
                  </svg>
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: Math.round(5 * u) }}>
                    <span style={{ fontSize: Math.round(20 * u), fontWeight: 800, color: "#0F1419", letterSpacing: "-0.01em" }}>ChartFM</span>
                    <svg width={Math.round(18 * u)} height={Math.round(18 * u)} viewBox="0 0 24 24" fill="#1D9BF0">
                      <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91-1.01-1.01-2.52-1.27-3.91-.81-.66-1.3-2-2.19-3.34-2.19-1.43 0-2.67.88-3.34 2.19-1.39-.46-2.9-.2-3.91.81-1.01 1.01-1.27 2.52-.81 3.91-1.3.66-2.19 2-2.19 3.34 0 1.43.88 2.67 2.19 3.34-.46 1.39-.2 2.9.81 3.91 1.01 1.01 2.52 1.27 3.91.81.66 1.3 2 2.19 3.34 2.19 1.43 0 2.67-.88 3.34-2.19 1.39.46 2.9.2 3.91-.81 1.01-1.01 1.27-2.52.81-3.91 1.3-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z" />
                    </svg>
                  </div>
                  <div style={{ fontSize: Math.round(15 * u), color: "#536471", marginTop: Math.round(1 * u) }}>@chartfm</div>
                </div>
              </div>
              <XLogo size={Math.round(22 * u)} color="#0F1419" />
            </div>

            {/* Tweet text */}
            <div style={{ fontSize: Math.round((landscape ? 22 : 26) * u), color: "#0F1419", lineHeight: 1.55, fontWeight: 400 }}>
              ⭐ <b style={{ fontWeight: 800 }}>Escolhidos da semana!</b> Os álbuns mais votados no{" "}
              <span style={{ color: "#FA243C", fontWeight: 700 }}>Clube do Álbum</span> — tema:{" "}
              <b style={{ fontWeight: 700 }}>{d.theme}</b>
              {d.round ? ` (Rodada ${d.round})` : ""}
            </div>

            {/* Albums */}
            {winners.length > 0 && (
              <div style={{ display: "flex", gap: Math.round(12 * u) }}>
                {winners.map((w, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: Math.round(12 * u),
                    flex: 1, background: i === 0 ? "rgba(250,36,60,0.06)" : "rgba(0,0,0,0.04)",
                    borderRadius: Math.round(16 * u),
                    padding: `${Math.round(12 * u)}px`,
                    border: i === 0 ? "1px solid rgba(250,36,60,0.15)" : "1px solid rgba(0,0,0,0.07)",
                  }}>
                    <SCover title={w.title} size={coverSize} radius={Math.round(10 * u)} imageUrl={w.coverUrl} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: Math.round(6 * u), marginBottom: Math.round(3 * u) }}>
                        <span style={{
                          fontSize: Math.round(13 * u), fontWeight: 800,
                          background: i === 0 ? "#FA243C" : "#E0E0E5",
                          color: i === 0 ? "#fff" : "#1D1D1F",
                          borderRadius: 9999, padding: `${Math.round(3 * u)}px ${Math.round(9 * u)}px`,
                          flexShrink: 0,
                        }}>{i + 1}°</span>
                      </div>
                      <div style={{ fontSize: Math.round(18 * u), fontWeight: 800, color: "#0F1419", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>{w.title}</div>
                      <div style={{ fontSize: Math.round(14 * u), color: "#536471", marginTop: Math.round(2 * u) }}>{w.artist} · {w.year}</div>
                      <div style={{ fontSize: Math.round(14 * u), color: "#FA243C", fontWeight: 700, marginTop: Math.round(5 * u) }}>{w.votes} votos</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Engagement bar */}
            <div style={{
              display: "flex", alignItems: "center", gap: Math.round(28 * u),
              paddingTop: Math.round(10 * u), borderTop: "1px solid rgba(0,0,0,0.07)",
              color: "#536471",
            }}>
              {[
                { icon: <svg width={Math.round(18 * u)} height={Math.round(18 * u)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, label: "24" },
                { icon: <svg width={Math.round(18 * u)} height={Math.round(18 * u)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>, label: "87" },
                { icon: <svg width={Math.round(18 * u)} height={Math.round(18 * u)} viewBox="0 0 24 24" fill="#F91880"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>, label: "312", color: "#F91880" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: Math.round(5 * u), color: item.color ?? "#536471", fontSize: Math.round(16 * u), fontWeight: 600 }}>
                  {item.icon}
                  {item.label}
                </div>
              ))}
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: Math.round(14 * u), color: "#536471", fontWeight: 500 }}>chartfm.com.br/criticsfm</span>
            </div>
          </div>
        </div>
      </div>
    </ChartBg>
  );
}

// ── Template map ──────────────────────────────────────────────────────────────

const TEMPLATE_MAP: Record<string, (props: { fmt: SocialFmt; d: TemplateData }) => React.ReactElement> = {
  inscricao:  TplInscricao,
  votacao:    TplVotacao,
  escolhidos: TplEscolhidos,
  nota:       TplNota,
  top5:       TplTop5,
  posts:      TplPosts,
  twitter:    TplTwitter,
  "copa-inscricao": TplCopaInscricao,
  "copa-etapa": TplCopaEtapa,
};

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 7 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function NotaThemeField({
  clubThemes,
  pick,
  custom,
  onPickChange,
  onCustomChange,
  inputStyle,
  selectStyle,
}: {
  clubThemes: GeradorData["clubThemes"];
  pick: string;
  custom: string;
  onPickChange: (v: string) => void;
  onCustomChange: (v: string) => void;
  inputStyle: React.CSSProperties;
  selectStyle: React.CSSProperties;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <select value={pick} onChange={(e) => onPickChange(e.target.value)} style={selectStyle}>
        <option value="">Sem tema</option>
        {clubThemes.map((t) => (
          <option key={t.number} value={t.theme} style={{ background: "#222" }}>
            Rodada {t.number} — {t.theme}
          </option>
        ))}
        <option value="__custom__" style={{ background: "#222" }}>Personalizado…</option>
      </select>
      {pick === "__custom__" && (
        <input
          style={inputStyle}
          value={custom}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder="Texto do tema (opcional)"
        />
      )}
      <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.45 }}>
        Deixe em <b style={{ color: "var(--text)" }}>Sem tema</b> para exportar qualquer álbum sem vínculo com o Clube do Álbum.
      </div>
    </div>
  );
}

function AlbumNotaPicker({
  suggestions,
  selected,
  onSelect,
  inputStyle,
}: {
  suggestions: GeradorAlbum[];
  selected: GeradorAlbum | null;
  onSelect: (album: GeradorAlbum | null) => void;
  inputStyle: React.CSSProperties;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeradorAlbum[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/gerador/albums/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = (await res.json()) as { items: GeradorAlbum[] };
        setResults(data.items ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (album: GeradorAlbum) => {
    onSelect(album);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={wrapRef}>
      {selected ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 11,
            border: "1px solid var(--divider-strong)",
            background: "var(--fill-2)",
            marginBottom: 10,
          }}
        >
          {selected.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selected.coverUrl} alt="" width={44} height={44} style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: 8, background: "var(--fill)", flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selected.title}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              {selected.artist} · {selected.score > 0 ? `${selected.score} · ` : ""}{selected.reviewCount} review{selected.reviewCount === 1 ? "" : "s"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelect(null)}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Trocar
          </button>
        </div>
      ) : null}

      <input
        style={inputStyle}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar álbum ou artista…"
      />

      {open && query.trim().length > 0 && (
        <div
          style={{
            marginTop: 6,
            maxHeight: 220,
            overflowY: "auto",
            borderRadius: 11,
            border: "1px solid var(--divider)",
            background: "var(--panel-2)",
          }}
        >
          {searching ? (
            <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-muted)" }}>Buscando…</div>
          ) : results.length === 0 ? (
            <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-muted)" }}>Nenhum álbum encontrado.</div>
          ) : (
            results.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => pick(a)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "10px 12px",
                  border: "none",
                  borderBottom: "1px solid var(--divider)",
                  background: selected?.id === a.id ? "var(--fill-2)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {a.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.coverUrl} alt="" width={36} height={36} style={{ borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: 6, background: "var(--fill)", flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.title}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {a.artist}
                    {a.reviewCount > 0 ? ` · ${a.score} (${a.reviewCount} reviews)` : " · sem reviews"}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {!selected && suggestions.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>
            Destaques (2+ reviews)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {suggestions.slice(0, 8).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => pick(a)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--divider)",
                  background: "var(--fill)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.title}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{a.score}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function GeradorClient({ data }: { data: GeradorData }) {
  const [type, setType]       = useState("inscricao");
  const [fmtId, setFmtId]     = useState("square");
  const [busy, setBusy]       = useState(false);
  const stageRef  = useRef<HTMLDivElement>(null);
  const previewCol = useRef<HTMLDivElement>(null);
  const [wrapW, setWrapW]     = useState(560);

  // Editable fields
  const [theme, setTheme]           = useState(data.theme);
  const [notaThemePick, setNotaThemePick] = useState("");
  const [notaThemeCustom, setNotaThemeCustom] = useState("");
  const [round, setRound]           = useState(String(data.round));
  const [dInscr, setDInscr]         = useState(data.nominationsDeadline);
  const [dPoll, setDPoll]           = useState(data.pollDeadline);
  const [selectedAlbum, setSelectedAlbum] = useState<GeradorAlbum | null>(data.ratable[0] ?? null);
  const [week, setWeek]             = useState(() => {
    const now = new Date();
    const m = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
    return `Semana 1–7 ${m[now.getMonth()]} ${now.getFullYear()}`;
  });
  const [postsTitle, setPostsTitle] = useState("O que a\ncomunidade\nestá curtindo");
  const [copaName, setCopaName] = useState(data.copaName);
  const [copaYear, setCopaYear] = useState(String(data.copaYear));
  const [copaStage, setCopaStage] = useState(data.copaStages[0] ?? "Grupos · Rodada 1 (A–H)");
  const [dCopaInscr, setDCopaInscr] = useState(data.copaStartsAt ?? "—");
  const [copaArtistsPerUser, setCopaArtistsPerUser] = useState(String(data.copaArtistsPerUser));
  const [copaMaxParticipants, setCopaMaxParticipants] = useState(String(data.copaMaxParticipants));
  const [copaParticipantCount, setCopaParticipantCount] = useState(String(data.copaParticipantCount));
  const [mobileTab, setMobileTab] = useState<"controls" | "preview">("controls");
  const isMobile = useIsMobile();

  const fmt = SOCIAL_FORMATS.find((f) => f.id === fmtId)!;
  const cur = TYPES.find((t) => t.id === type)!;

  useEffect(() => {
    function fit() {
      if (previewCol.current) setWrapW(previewCol.current.clientWidth - (isMobile ? 32 : 80));
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [isMobile, mobileTab]);

  const scale = Math.min(wrapW / fmt.w, 620 / fmt.h);

  const notaTheme =
    notaThemePick === "__custom__" ? notaThemeCustom.trim() : notaThemePick.trim();

  const d: TemplateData = {
    theme: type === "nota" ? notaTheme : theme,
    round,
    deadline: type === "votacao" ? dPoll : type === "copa-inscricao" ? dCopaInscr : dInscr,
    nominations: data.nominations,
    winners: data.winners,
    album: selectedAlbum,
    tracks: data.top5,
    week,
    posts: data.posts,
    postsTitle,
    copaName,
    copaYear,
    copaStage,
    copaArtistsPerUser,
    copaMaxParticipants,
    copaParticipantCount,
  };

  const Tpl = TEMPLATE_MAP[type];

  async function exportPNG() {
    if (!stageRef.current || busy) return;
    setBusy(true);
    const node = stageRef.current;
    const prev = node.style.transform;
    node.style.transform = "none";
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: null,
        logging: false,
        useCORS: true,
        width: fmt.w,
        height: fmt.h,
        windowWidth: fmt.w,
        windowHeight: fmt.h,
      });
      node.style.transform = prev;
      const link = document.createElement("a");
      link.download = `chartfm-${type}-${fmtId}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      node.style.transform = prev;
      alert("Erro ao gerar: " + (e as Error).message);
    }
    setBusy(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--fill)",
    border: "1px solid var(--divider)",
    borderRadius: 10,
    padding: "10px 13px",
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: "auto",
  };

  const vars = {
    "--bg":             "#0C0C0E",
    "--panel":          "#1A1A1C",
    "--panel-2":        "#222225",
    "--surface":        "#1C1C1E",
    "--fill":           "rgba(255,255,255,0.05)",
    "--fill-2":         "rgba(255,255,255,0.08)",
    "--text":           "#F5F5F7",
    "--text-muted":     "#8E8E93",
    "--text-dim":       "#5A5A5F",
    "--divider":        "rgba(255,255,255,0.09)",
    "--divider-strong": "rgba(255,255,255,0.15)",
    "--accent":         "#FA243C",
  } as React.CSSProperties;

  const controlsContent = (
        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px" : "20px 24px" }}>
          {/* Type picker */}
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 7 }}>
            Tipo de imagem
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
            {TYPES.map((t) => (
              <button key={t.id} onClick={() => setType(t.id)} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "11px 13px", borderRadius: 11,
                border: `1px solid ${type === t.id ? "var(--divider-strong)" : "var(--divider)"}`,
                background: type === t.id ? "var(--fill-2)" : "transparent",
                cursor: "pointer", textAlign: "left",
              }}>
                <span style={{ fontSize: 19, width: 24, textAlign: "center", flexShrink: 0 }}>{t.emoji}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{t.label}</span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{t.desc}</span>
                </span>
                {type === t.id && <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.accent, flexShrink: 0 }} />}
              </button>
            ))}
          </div>

          {/* Dynamic fields */}
          <div style={{ paddingTop: 20, borderTop: "1px solid var(--divider)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 16, display: "flex", alignItems: "center", gap: 7 }}>
              <span>{cur.emoji}</span> Conteúdo
            </div>

            {(type === "inscricao" || type === "votacao" || type === "escolhidos" || type === "twitter") && (
              <Field label="Tema da semana">
                <input style={inputStyle} value={theme} onChange={(e) => setTheme(e.target.value)} />
              </Field>
            )}

            {type === "nota" && (
              <Field label="Tema (opcional)">
                <NotaThemeField
                  clubThemes={data.clubThemes}
                  pick={notaThemePick}
                  custom={notaThemeCustom}
                  onPickChange={setNotaThemePick}
                  onCustomChange={setNotaThemeCustom}
                  inputStyle={inputStyle}
                  selectStyle={selectStyle}
                />
              </Field>
            )}

            {(type === "inscricao" || type === "votacao" || type === "escolhidos" || type === "twitter") && (
              <Field label="Número da rodada">
                <input style={inputStyle} value={round} onChange={(e) => setRound(e.target.value)} />
              </Field>
            )}

            {type === "inscricao" && (
              <Field label="Prazo das inscrições">
                <input style={inputStyle} value={dInscr} onChange={(e) => setDInscr(e.target.value)} />
              </Field>
            )}

            {type === "votacao" && (
              <Field label="Prazo da enquete">
                <input style={inputStyle} value={dPoll} onChange={(e) => setDPoll(e.target.value)} />
              </Field>
            )}

            {type === "escolhidos" && (
              <div style={{ background: "var(--fill)", borderRadius: 11, padding: "12px 14px", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Vencedores: <b style={{ color: "var(--text)" }}>{data.winners.map((w) => w.title).join(" · ") || "Nenhum ainda"}</b>. Editáveis no painel principal do Clube.
              </div>
            )}

            {type === "nota" && (
              <Field label="Álbum">
                <AlbumNotaPicker
                  suggestions={data.ratable}
                  selected={selectedAlbum}
                  onSelect={setSelectedAlbum}
                  inputStyle={inputStyle}
                />
              </Field>
            )}

            {type === "top5" && (
              <>
                <Field label="Semana">
                  <input style={inputStyle} value={week} onChange={(e) => setWeek(e.target.value)} />
                </Field>
                <div style={{ background: "var(--fill)", borderRadius: 11, padding: "12px 14px", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  Mostra o <b style={{ color: "var(--text)" }}>Top 5</b> da Parada Global (ou <b style={{ color: "var(--text)" }}>Top 10</b> no formato Story). As músicas vêm do ranking ao vivo.
                </div>
              </>
            )}

            {type === "posts" && (
              <>
                <Field label="Título da seção">
                  <textarea
                    rows={3}
                    value={postsTitle}
                    onChange={(e) => setPostsTitle(e.target.value)}
                    style={{ ...inputStyle, resize: "vertical", minHeight: 60, lineHeight: 1.4 }}
                  />
                </Field>
                <div style={{ background: "var(--fill)", borderRadius: 11, padding: "12px 14px", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  Exibe os <b style={{ color: "var(--text)" }}>3 álbuns</b> melhor avaliados (mín. 2 reviews) como cards de review. Use <code style={{ background: "rgba(255,255,255,.08)", borderRadius: 4, padding: "1px 5px", fontFamily: "monospace" }}>\n</code> no título para quebrar linha.
                </div>
              </>
            )}

            {type === "twitter" && (
              <div style={{ background: "var(--fill)", borderRadius: 11, padding: "12px 14px", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
                Exibe os <b style={{ color: "var(--text)" }}>2 vencedores</b> da rodada num card estilo tweet. Use o formato <b style={{ color: "var(--text)" }}>Paisagem 16:9</b> para melhor resultado.
              </div>
            )}

            {(type === "copa-inscricao" || type === "copa-etapa") && (
              <>
                <Field label="Nome da copa">
                  <input style={inputStyle} value={copaName} onChange={(e) => setCopaName(e.target.value)} placeholder="Copa ChartFM" />
                </Field>
                <Field label="Ano">
                  <input style={inputStyle} value={copaYear} onChange={(e) => setCopaYear(e.target.value)} placeholder="2026" />
                </Field>
              </>
            )}

            {type === "copa-inscricao" && (
              <>
                <Field label="Prazo das inscrições">
                  <input style={inputStyle} value={dCopaInscr} onChange={(e) => setDCopaInscr(e.target.value)} placeholder="15 jul, 20h00" />
                </Field>
                <Field label="Artistas por participante">
                  <input style={inputStyle} type="number" min={1} value={copaArtistsPerUser} onChange={(e) => setCopaArtistsPerUser(e.target.value)} />
                </Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Participantes">
                    <input style={inputStyle} type="number" min={0} value={copaParticipantCount} onChange={(e) => setCopaParticipantCount(e.target.value)} />
                  </Field>
                  <Field label="Vagas">
                    <input style={inputStyle} type="number" min={1} value={copaMaxParticipants} onChange={(e) => setCopaMaxParticipants(e.target.value)} />
                  </Field>
                </div>
                <div style={{ background: "var(--fill)", borderRadius: 11, padding: "12px 14px", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  Anuncia que as <b style={{ color: "var(--text)" }}>inscrições estão abertas</b> e convida a montar o time. Ideal para Story ou Quadrado.
                </div>
              </>
            )}

            {type === "copa-etapa" && (
              <>
                <Field label="Etapa">
                  <select value={copaStage} onChange={(e) => setCopaStage(e.target.value)} style={selectStyle}>
                    {data.copaStages.map((s) => (
                      <option key={s} value={s} style={{ background: "#222" }}>{s}</option>
                    ))}
                  </select>
                </Field>
                <div style={{ background: "var(--fill)", borderRadius: 11, padding: "12px 14px", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  Anuncia o <b style={{ color: "var(--text)" }}>início de uma etapa</b> da Copa e convida a votar nos jogos ao vivo. Ideal para Story ou Quadrado.
                </div>
              </>
            )}
          </div>
        </div>
  );

  const previewContent = (
      <div ref={previewCol} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: isMobile ? 420 : 560 }}>
        {/* Toolbar */}
        <div style={{
          padding: isMobile ? "12px 14px" : "16px 28px",
          borderBottom: "1px solid var(--divider)",
          display: "flex",
          alignItems: isMobile ? "stretch" : "center",
          flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? 10 : 16,
          background: "rgba(12,12,14,0.8)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}>
          <div style={{ display: "flex", gap: 5, background: "var(--fill)", padding: 4, borderRadius: 11, flexWrap: "wrap" }}>
            {SOCIAL_FORMATS.map((f) => (
              <button key={f.id} onClick={() => setFmtId(f.id)} title={f.sub} style={{
                padding: isMobile ? "7px 10px" : "8px 14px", borderRadius: 8, border: "none",
                background: fmtId === f.id ? "var(--panel-2)" : "transparent",
                color: fmtId === f.id ? "var(--text)" : "var(--text-muted)",
                cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                boxShadow: fmtId === f.id ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
                flex: isMobile ? "1 1 calc(50% - 4px)" : undefined,
                minWidth: isMobile ? 0 : undefined,
              }}>
                <span style={{ fontSize: isMobile ? 11.5 : 12.5, fontWeight: 700 }}>{f.label}</span>
                <span style={{ fontSize: 10, opacity: 0.7 }}>{f.ratio}</span>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, width: isMobile ? "100%" : undefined }}>
            {!isMobile && <div style={{ flex: 1 }} />}
            <div style={{ fontSize: 12, color: "var(--text-dim)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
              {fmt.w} × {fmt.h}px
            </div>
            <button
              type="button"
              onClick={exportPNG}
              disabled={busy}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "10px 20px", borderRadius: 10, border: "none",
                background: busy ? "var(--fill-2)" : "var(--accent)",
                color: "#fff", fontSize: 13.5, fontWeight: 700,
                cursor: busy ? "default" : "pointer",
                boxShadow: busy ? "none" : "0 2px 12px rgba(250,36,60,0.35)",
                flex: isMobile ? 1 : undefined,
                whiteSpace: "nowrap",
              }}
            >
              {busy ? "Gerando…" : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Baixar PNG @2x
                </>
              )}
            </button>
          </div>
        </div>

        {/* Stage */}
        <div style={{ flex: 1, overflow: "auto", display: "grid", placeItems: "center", padding: isMobile ? 16 : 40, backgroundImage: "radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
          <div style={{ width: fmt.w * scale, height: fmt.h * scale, borderRadius: Math.max(6, 24 * scale), overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)" }}>
            <div ref={stageRef} style={{ width: fmt.w, height: fmt.h, transform: `scale(${scale})`, transformOrigin: "top left" }}>
              <Tpl fmt={fmt} d={d} />
            </div>
          </div>
        </div>
      </div>
  );

  const mobileTabs = (
    <div style={{ display: "flex", gap: 6, padding: "12px 12px 0", background: "var(--panel)" }}>
      {(["controls", "preview"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => setMobileTab(tab)}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            border: "none",
            background: mobileTab === tab ? "var(--fill-2)" : "var(--fill)",
            color: mobileTab === tab ? "var(--text)" : "var(--text-muted)",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {tab === "controls" ? "Controles" : "Preview"}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{
      ...vars,
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      minHeight: isMobile ? undefined : 640,
      background: "#0C0C0E",
      borderRadius: 16,
      border: "1px solid var(--divider)",
      overflow: "hidden",
    }}>
      {isMobile ? (
        <>
          {mobileTabs}
          {mobileTab === "controls" ? (
            <div style={{ background: "var(--panel)", display: "flex", flexDirection: "column" }}>
              {controlsContent}
            </div>
          ) : (
            previewContent
          )}
        </>
      ) : (
        <>
          <div style={{
            width: 340,
            flexShrink: 0,
            background: "var(--panel)",
            borderRight: "1px solid var(--divider)",
            display: "flex",
            flexDirection: "column",
            alignSelf: "stretch",
          }}>
            {controlsContent}
          </div>
          {previewContent}
        </>
      )}
    </div>
  );
}

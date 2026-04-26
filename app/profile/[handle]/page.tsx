"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeft, Flame, Trophy, BadgeCheck } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Avatar } from "@/components/ui/Avatar";
import { ChartCard } from "@/components/chart/ChartCard";
import { USERS_DATA, COVER_PALETTES } from "@/lib/data";
import type { Chart, UserWithCharts } from "@/lib/types";

type Tab = "charts" | "artists" | "evolution";

type ApiProfile = {
  user: UserWithCharts;
  imageUrl: string | null;
  paradaNome: string | null;
  genres: string[];
};

function countDistinctNumberOnes(charts: Chart[]) {
  const keys = new Set<string>();
  for (const c of charts) {
    for (const e of c.entries) {
      if (e.position === 1) keys.add(`${e.song.title}\0${e.song.artist}`);
    }
  }
  return keys.size;
}

function buildTopArtists(user: UserWithCharts) {
  const latest = user.charts[0];
  if (!latest) return [];
  const artistMap = new Map<string, { name: string; points: number; color: [string, string] }>();
  latest.entries.forEach((e, i) => {
    const a = e.song.artist;
    if (!artistMap.has(a)) artistMap.set(a, { name: a, points: 0, color: COVER_PALETTES[i % COVER_PALETTES.length] });
    artistMap.get(a)!.points += 101 - e.position;
  });
  return [...artistMap.values()].sort((a, b) => b.points - a.points).slice(0, 12);
}

function buildAchievements(user: UserWithCharts, numberOnes: number) {
  const totalRanked = user.charts.reduce((acc, c) => acc + c.entries.length, 0);
  const list: { emoji: string; name: string; desc: string }[] = [
    { emoji: "🔥", name: "Streak", desc: `${user.streak} semanas de streak` },
    { emoji: "🎵", name: "Curador", desc: totalRanked >= 100 ? `${totalRanked}+ entradas no chart` : `${totalRanked} músicas rankeadas` },
    { emoji: "🏆", name: "Chart topper", desc: numberOnes > 0 ? `${numberOnes} faixa(s) em #1` : "Busque o primeiro #1" },
    { emoji: "🌟", name: "Rede", desc: `${user.followers.toLocaleString("pt-BR")} seguidores` },
    { emoji: "📊", name: "Paradas", desc: `${user.charts.length} publicação(ões)` },
    { emoji: "💎", name: "Membro", desc: "Chartify" },
  ];
  return list;
}

export default function ProfilePage() {
  const params = useParams();
  const raw = params?.handle;
  const handle = decodeURIComponent(typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "");

  const { data: session, status } = useSession();
  const [tab, setTab] = useState<Tab>("charts");
  const [phase, setPhase] = useState<"loading" | "ready" | "missing">("loading");
  const [source, setSource] = useState<"db" | "mock" | null>(null);
  const [payload, setPayload] = useState<ApiProfile | null>(null);
  const [mockUser, setMockUser] = useState<UserWithCharts | null>(null);

  useEffect(() => {
    if (!handle) {
      setPhase("missing");
      return;
    }
    let cancelled = false;
    setPhase("loading");
    (async () => {
      try {
        const res = await fetch(`/api/profile/${encodeURIComponent(handle)}`);
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as ApiProfile;
          setPayload(data);
          setMockUser(null);
          setSource("db");
          setPhase("ready");
          return;
        }
        if (res.status === 404) {
          const mock = USERS_DATA.find((u) => u.handle === handle) ?? null;
          setPayload(null);
          setMockUser(mock);
          setSource(mock ? "mock" : null);
          setPhase(mock ? "ready" : "missing");
          return;
        }
        setPhase("missing");
      } catch {
        if (!cancelled) setPhase("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  const user = payload?.user ?? mockUser;
  const imageUrl = payload?.imageUrl ?? null;
  const paradaNome = payload?.paradaNome ?? null;
  const genres = payload?.genres ?? [];
  const isOwn = status === "authenticated" && session?.user?.handle === handle;

  const topArtists = useMemo(() => (user ? buildTopArtists(user) : []), [user]);
  const numberOnes = useMemo(() => (user ? countDistinctNumberOnes(user.charts) : 0), [user]);
  const achievements = useMemo(() => (user ? buildAchievements(user, numberOnes) : []), [user, numberOnes]);

  if (phase === "loading") {
    return (
      <Shell title="" noPadding>
        <div style={{ padding: "48px 40px", color: "#86868B", fontSize: 15 }}>Carregando perfil…</div>
      </Shell>
    );
  }

  if (phase === "missing" || !user) {
    return (
      <Shell title="Perfil" subtitle="Usuário não encontrado">
        <div style={{ maxWidth: 480, textAlign: "center", margin: "48px auto", color: "#86868B" }}>
          <p style={{ fontSize: 16, marginBottom: 20 }}>Não encontramos ninguém com o handle @{handle}.</p>
          <Link href="/" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
            ← Voltar ao início
          </Link>
        </div>
      </Shell>
    );
  }

  const hasCharts = user.charts.length > 0;
  const totalRankedSlots = user.charts.reduce((acc, c) => acc + c.entries.length, 0);

  return (
    <Shell title="" noPadding>
      <div
        style={{
          background: `linear-gradient(180deg, ${user.avatar}22 0%, transparent 100%)`,
          padding: "48px 40px 32px 40px",
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#86868B",
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
            marginBottom: 20,
          }}
        >
          <ChevronLeft size={16} />
          Início
        </Link>
        <div style={{ display: "flex", gap: 28, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Avatar user={user} imageUrl={imageUrl ?? undefined} size={140} />

          <div style={{ flex: 1, minWidth: 240, paddingBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#86868B", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Perfil</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h1 style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1 }}>{user.name}</h1>
              {(user.verified || user.followers > 2000) && <BadgeCheck size={28} color="#0A84FF" fill="#0A84FF" />}
            </div>
            <div style={{ fontSize: 15, color: "#86868B", marginBottom: 10 }}>@{user.handle}</div>
            {paradaNome && source === "db" && (
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1D1D1F", marginBottom: 8 }}>Parada: {paradaNome}</div>
            )}
            {genres.length > 0 && source === "db" && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {genres.map((g) => (
                  <span
                    key={g}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 100,
                      background: "rgba(0,0,0,0.06)",
                      color: "#1D1D1F",
                    }}
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
            {user.bio ? (
              <p style={{ fontSize: 15, color: "#1D1D1F", marginBottom: 16, maxWidth: 560, lineHeight: 1.5 }}>{user.bio}</p>
            ) : isOwn && source === "db" ? (
              <p style={{ fontSize: 15, color: "#86868B", marginBottom: 16, maxWidth: 560, lineHeight: 1.5 }}>
                Ainda sem bio. As informações vêm da sua conta Google; em breve poderá editar aqui.
              </p>
            ) : null}
            <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 13, color: "#86868B", flexWrap: "wrap" }}>
              <span>
                <strong style={{ fontWeight: 700, color: "#1D1D1F" }}>{user.followers.toLocaleString("pt-BR")}</strong> seguidores
              </span>
              <span>
                <strong style={{ fontWeight: 700, color: "#1D1D1F" }}>{user.following.toLocaleString("pt-BR")}</strong> seguindo
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#FA243C", fontWeight: 600 }}>
                <Flame size={15} fill="#FA243C" />
                <strong>{user.streak}</strong> streak
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, paddingBottom: 8, flexWrap: "wrap" }}>
            {isOwn ? (
              <>
                <Link
                  href="/create"
                  style={{
                    background: "#FA243C",
                    color: "white",
                    border: "none",
                    padding: "11px 26px",
                    borderRadius: 100,
                    fontSize: 14,
                    fontWeight: 700,
                    boxShadow: "0 2px 8px rgba(250,36,60,0.25)",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  Nova parada
                </Link>
                <Link
                  href="/parada/setup"
                  style={{
                    background: "rgba(0,0,0,0.06)",
                    border: "none",
                    padding: "10px 22px",
                    borderRadius: 100,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#1D1D1F",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  Nome da parada
                </Link>
              </>
            ) : (
              <>
                <button
                  type="button"
                  style={{
                    background: "#FA243C",
                    color: "white",
                    border: "none",
                    padding: "11px 26px",
                    borderRadius: 100,
                    fontSize: 14,
                    fontWeight: 700,
                    boxShadow: "0 2px 8px rgba(250,36,60,0.25)",
                    cursor: "pointer",
                  }}
                >
                  Seguir
                </button>
                <button
                  type="button"
                  style={{
                    background: "rgba(0,0,0,0.06)",
                    border: "none",
                    padding: "10px 22px",
                    borderRadius: 100,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#1D1D1F",
                    cursor: "pointer",
                  }}
                >
                  Comparar
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: "0 40px 80px 40px" }}>
        <div
          style={{
            background: "white",
            borderRadius: 18,
            border: "1px solid rgba(0,0,0,0.06)",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            marginTop: 28,
            marginBottom: 28,
          }}
        >
          {[
            { label: "Paradas publicadas", value: user.charts.length, icon: null },
            { label: "#1 pessoais", value: numberOnes, icon: <Trophy size={16} color="#FFD700" fill="#FFD700" /> },
            { label: "Músicas rankeadas", value: totalRankedSlots, icon: null },
            { label: "Artistas (última parada)", value: topArtists.length, icon: null },
          ].map(({ label, value, icon }, i) => (
            <div key={label} style={{ padding: "20px 24px", borderRight: i < 3 ? "1px solid rgba(0,0,0,0.06)" : "none" }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B", marginBottom: 6 }}>{label}</div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 32,
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {icon}
                {value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em" }}>Conquistas</h2>
            <div style={{ flex: 1 }} />
            <button type="button" style={{ background: "none", border: "none", fontSize: 13, fontWeight: 600, color: "#FA243C", cursor: "pointer" }}>
              Ver todas
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
            {achievements.map((a) => (
              <div key={a.name} style={{ background: "white", borderRadius: 14, border: "1px solid rgba(0,0,0,0.06)", padding: "16px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 6 }}>{a.emoji}</div>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 4 }}>{a.name}</div>
                <div style={{ fontSize: 11, color: "#86868B", lineHeight: 1.4 }}>{a.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid rgba(0,0,0,0.06)", marginBottom: 24, flexWrap: "wrap", gap: 8 }}>
          {(
            [
              ["charts", "Paradas"],
              ["artists", "Artistas favoritos"],
              ["evolution", "Evolução"],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              disabled={!hasCharts && t !== "charts"}
              onClick={() => setTab(t)}
              style={{
                padding: "12px 4px",
                marginRight: 24,
                background: "none",
                border: "none",
                fontSize: 14,
                fontWeight: tab === t ? 600 : 500,
                color: tab === t ? "#1D1D1F" : "#86868B",
                borderBottom: `2px solid ${tab === t ? "#FA243C" : "transparent"}`,
                marginBottom: -1,
                cursor: !hasCharts && t !== "charts" ? "not-allowed" : "pointer",
                opacity: !hasCharts && t !== "charts" ? 0.45 : 1,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "charts" && (
          <>
            {!hasCharts ? (
              <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 40, textAlign: "center" }}>
                <p style={{ fontSize: 15, color: "#86868B", marginBottom: 20 }}>Nenhuma parada publicada ainda.</p>
                {isOwn ? (
                  <Link href="/create" style={{ color: "#FA243C", fontWeight: 700, textDecoration: "none", fontSize: 15 }}>
                    Publicar a primeira parada →
                  </Link>
                ) : null}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
                {user.charts.map((chart, i) => (
                  <ChartCard
                    key={chart.id}
                    user={user}
                    chart={chart}
                    postedAgo={i === 0 ? "Mais recente" : chart.weekLabel}
                    showFollowActions={!isOwn}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "artists" && hasCharts && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
            {topArtists.map((a) => (
              <Link
                key={a.name}
                href={`/artist/${encodeURIComponent(a.name)}`}
                style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}
              >
                <div
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${a.color[0]}, ${a.color[1]})`,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                  }}
                />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: "#86868B" }}>{a.points} pts</div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {tab === "evolution" && hasCharts && <EvolutionChart user={user} />}
      </div>
    </Shell>
  );
}

function EvolutionChart({ user }: { user: UserWithCharts }) {
  const width = 600;
  const height = 260;
  const pad = { top: 20, right: 20, bottom: 40, left: 40 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const weeks = user.charts.slice(0, 6).reverse();
  const weekCount = weeks.length;
  const maxPos = 20;
  const colors = ["#FA243C", "#4ECDC4", "#8338EC", "#FB5607", "#06D6A0"];

  const latest = user.charts[0];
  if (!latest || weekCount < 2) {
    return (
      <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 28, color: "#86868B", fontSize: 15 }}>
        Publique pelo menos duas paradas em semanas diferentes para ver a evolução das músicas no gráfico.
      </div>
    );
  }

  const top5 = latest.entries.slice(0, 5).map((e) => e.song);

  const denom = Math.max(1, weekCount - 1);
  const xFor = (i: number) => pad.left + (i / denom) * chartW;
  const yFor = (pos: number) => pad.top + ((pos - 1) / (maxPos - 1)) * chartH;

  const gridLines = [1, 5, 10, 15, 20];

  return (
    <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>Trajetória das top 5 da parada mais recente</div>
      <div style={{ fontSize: 13, color: "#86868B", marginBottom: 20 }}>Quanto mais alto, melhor a posição. Linhas tracejadas = música fora da parada.</div>
      <div style={{ overflowX: "auto" }}>
        <svg width={width} height={height} style={{ display: "block" }}>
          {gridLines.map((pos) => (
            <g key={pos}>
              <line x1={pad.left} x2={width - pad.right} y1={yFor(pos)} y2={yFor(pos)} stroke="rgba(0,0,0,0.06)" strokeWidth={1} />
              <text x={pad.left - 8} y={yFor(pos) + 4} fontSize={10} textAnchor="end" fill="#86868B">
                #{pos}
              </text>
            </g>
          ))}
          {weeks.map((w, i) => (
            <text key={w.id} x={xFor(i)} y={height - 8} fontSize={10} textAnchor="middle" fill="#86868B">
              {i === weeks.length - 1 ? "Agora" : `${weeks.length - 1 - i}sem`}
            </text>
          ))}
          {top5.map((song, si) => {
            const points = weeks.map((w) => {
              const entry = w.entries.find((e) => e.song.title === song.title && e.song.artist === song.artist);
              return entry ? { pos: entry.position, present: true } : { pos: maxPos + 2, present: false };
            });
            let d = "";
            points.forEach((p, i) => {
              const x = xFor(i);
              const y = yFor(Math.min(p.pos, maxPos));
              d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
            });
            return (
              <path
                key={si}
                d={d}
                fill="none"
                stroke={colors[si]}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={points.some((p) => !p.present) ? "4 4" : "none"}
              />
            );
          })}
          {top5.map((song, si) =>
            weeks.map((w, wi) => {
              const entry = w.entries.find((e) => e.song.title === song.title && e.song.artist === song.artist);
              if (!entry) return null;
              return <circle key={`${si}-${wi}`} cx={xFor(wi)} cy={yFor(entry.position)} r={4} fill="white" stroke={colors[si]} strokeWidth={2.5} />;
            })
          )}
        </svg>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
        {top5.map((song, si) => (
          <div key={si} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: colors[si] }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>{song.title}</span>
            <span style={{ fontSize: 12, color: "#86868B" }}>· {song.artist}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

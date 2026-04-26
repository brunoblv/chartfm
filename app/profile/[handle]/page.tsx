"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeft, Flame, Trophy, BadgeCheck } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Avatar } from "@/components/ui/Avatar";
import { ChartCard } from "@/components/chart/ChartCard";
import { FollowButton } from "@/components/ui/FollowButton";
import { MovementBadge } from "@/components/ui/MovementBadge";
import { Cover } from "@/components/ui/Cover";
import { USERS_DATA, COVER_PALETTES } from "@/lib/data";
import type { Chart, UserWithCharts } from "@/lib/types";

type Tab = "charts" | "artists_overall" | "artists_year" | "songs_overall" | "songs_year";

type ApiProfile = {
  user: UserWithCharts;
  imageUrl: string | null;
  paradaNome: string | null;
  genres: string[];
  isFollowing: boolean;
  artistImages?: Record<string, string | null>;
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

type ArtistTableRow = {
  position: number;
  name: string;
  songCount: number;
  totalPoints: number;
  weeks: number;
  peak: number;
  prevPos: number | null;
  delta: number | null;
  status: "new" | "up" | "down" | "same";
  growthPct: number | null;
};

type SongTableRow = {
  position: number;
  title: string;
  artist: string;
  totalPoints: number;
  weeks: number;
  peak: number;
  prevPos: number | null;
  delta: number | null;
  status: "new" | "up" | "down" | "same";
  growthPct: number | null;
  cover: Chart["entries"][number]["cover"];
};

function pointsForPosition(position: number) {
  return 101 - position;
}

function colorForArtist(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return COVER_PALETTES[Math.abs(hash) % COVER_PALETTES.length];
}

function aggregateArtists(charts: Chart[], previousCharts: Chart[]): ArtistTableRow[] {
  const map = new Map<string, { points: number; songs: Set<string>; weeks: Set<number>; peak: number }>();
  charts.forEach((c) => {
    c.entries.forEach((e) => {
      const key = e.song.artist;
      const cur = map.get(key) ?? { points: 0, songs: new Set<string>(), weeks: new Set<number>(), peak: e.position };
      cur.points += pointsForPosition(e.position);
      cur.songs.add(e.song.title);
      cur.weeks.add(c.week);
      cur.peak = Math.min(cur.peak, e.position);
      map.set(key, cur);
    });
  });
  const prevMap = new Map<string, number>();
  previousCharts.forEach((c) =>
    c.entries.forEach((e) => prevMap.set(e.song.artist, (prevMap.get(e.song.artist) ?? 0) + pointsForPosition(e.position)))
  );
  const sorted = [...map.entries()].sort((a, b) => b[1].points - a[1].points);
  const prevRank = [...prevMap.entries()].sort((a, b) => b[1] - a[1]).reduce((acc, [k], i) => acc.set(k, i + 1), new Map<string, number>());
  return sorted.map(([name, v], i) => {
    const position = i + 1;
    const prevPos = prevRank.get(name) ?? null;
    const delta = prevPos === null ? null : prevPos - position;
    const status: ArtistTableRow["status"] = prevPos === null ? "new" : delta === 0 ? "same" : (delta ?? 0) > 0 ? "up" : "down";
    const prevPoints = prevMap.get(name) ?? 0;
    const growthPct = prevPoints > 0 ? ((v.points - prevPoints) / prevPoints) * 100 : null;
    return {
      position,
      name,
      songCount: v.songs.size,
      totalPoints: v.points,
      weeks: v.weeks.size,
      peak: v.peak,
      prevPos,
      delta,
      status,
      growthPct,
    };
  });
}

function aggregateSongs(charts: Chart[], previousCharts: Chart[]): SongTableRow[] {
  const map = new Map<string, { title: string; artist: string; points: number; weeks: Set<number>; peak: number; cover: Chart["entries"][number]["cover"] }>();
  charts.forEach((c) => {
    c.entries.forEach((e) => {
      const key = `${e.song.title}\0${e.song.artist}`;
      const cur = map.get(key) ?? { title: e.song.title, artist: e.song.artist, points: 0, weeks: new Set<number>(), peak: e.position, cover: e.cover };
      cur.points += pointsForPosition(e.position);
      cur.weeks.add(c.week);
      cur.peak = Math.min(cur.peak, e.position);
      if (e.position < cur.peak) cur.cover = e.cover;
      map.set(key, cur);
    });
  });
  const prevMap = new Map<string, number>();
  previousCharts.forEach((c) =>
    c.entries.forEach((e) => {
      const key = `${e.song.title}\0${e.song.artist}`;
      prevMap.set(key, (prevMap.get(key) ?? 0) + pointsForPosition(e.position));
    })
  );
  const sorted = [...map.entries()].sort((a, b) => b[1].points - a[1].points);
  const prevRank = [...prevMap.entries()].sort((a, b) => b[1] - a[1]).reduce((acc, [k], i) => acc.set(k, i + 1), new Map<string, number>());
  return sorted.map(([key, v], i) => {
    const position = i + 1;
    const prevPos = prevRank.get(key) ?? null;
    const delta = prevPos === null ? null : prevPos - position;
    const status: SongTableRow["status"] = prevPos === null ? "new" : delta === 0 ? "same" : (delta ?? 0) > 0 ? "up" : "down";
    const prevPoints = prevMap.get(key) ?? 0;
    const growthPct = prevPoints > 0 ? ((v.points - prevPoints) / prevPoints) * 100 : null;
    return {
      position,
      title: v.title,
      artist: v.artist,
      totalPoints: v.points,
      weeks: v.weeks.size,
      peak: v.peak,
      prevPos,
      delta,
      status,
      growthPct,
      cover: v.cover,
    };
  });
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
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

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
  const artistImages = payload?.artistImages ?? {};
  const isFollowing = payload?.isFollowing ?? false;
  const isOwn = status === "authenticated" && session?.user?.handle === handle;

  const topArtists = useMemo(() => (user ? buildTopArtists(user) : []), [user]);
  const numberOnes = useMemo(() => (user ? countDistinctNumberOnes(user.charts) : 0), [user]);
  const achievements = useMemo(() => (user ? buildAchievements(user, numberOnes) : []), [user, numberOnes]);
  const years = useMemo(() => user ? [...new Set(user.charts.map((c) => Math.floor(c.week / 100)))].sort((a, b) => b - a) : [], [user]);
  const activeYear = selectedYear ?? years[0] ?? null;
  const chartsSortedAsc = useMemo(() => user ? [...user.charts].sort((a, b) => a.week - b.week) : [], [user]);
  const latestWeek = chartsSortedAsc[chartsSortedAsc.length - 1]?.week ?? null;
  const overallArtistsRows = useMemo(() => {
    if (!latestWeek) return [];
    const previous = chartsSortedAsc.filter((c) => c.week < latestWeek);
    return aggregateArtists(chartsSortedAsc, previous);
  }, [chartsSortedAsc, latestWeek]);
  const overallSongsRows = useMemo(() => {
    if (!latestWeek) return [];
    const previous = chartsSortedAsc.filter((c) => c.week < latestWeek);
    return aggregateSongs(chartsSortedAsc, previous);
  }, [chartsSortedAsc, latestWeek]);
  const yearlyArtistsRows = useMemo(() => {
    if (!activeYear) return [];
    const yearCharts = chartsSortedAsc.filter((c) => Math.floor(c.week / 100) === activeYear);
    const latestYearWeek = yearCharts[yearCharts.length - 1]?.week ?? null;
    const previous = latestYearWeek ? yearCharts.filter((c) => c.week < latestYearWeek) : [];
    return aggregateArtists(yearCharts, previous);
  }, [chartsSortedAsc, activeYear]);
  const yearlySongsRows = useMemo(() => {
    if (!activeYear) return [];
    const yearCharts = chartsSortedAsc.filter((c) => Math.floor(c.week / 100) === activeYear);
    const latestYearWeek = yearCharts[yearCharts.length - 1]?.week ?? null;
    const previous = latestYearWeek ? yearCharts.filter((c) => c.week < latestYearWeek) : [];
    return aggregateSongs(yearCharts, previous);
  }, [chartsSortedAsc, activeYear]);

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
                <FollowButton
                  targetId={user.id}
                  initialFollowing={isFollowing}
                  variant="primary"
                  size="md"
                />
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
              ["artists_overall", "Artistas overall"],
              ["artists_year", "Artistas anual"],
              ["songs_overall", "Músicas overall"],
              ["songs_year", "Músicas anual"],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              disabled={!hasCharts && t !== "charts"}
              onClick={() => setTab(t)}
              style={{
                padding: "12px 4px",
                marginRight: 18,
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

        {(tab === "artists_overall" || tab === "artists_year") && hasCharts && (
          <>
            {tab === "artists_year" && years.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <select value={activeYear ?? ""} onChange={(e) => setSelectedYear(Number(e.target.value))} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.12)" }}>
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}
            <ArtistStatsTable rows={tab === "artists_overall" ? overallArtistsRows : yearlyArtistsRows} artistImages={artistImages} />
          </>
        )}
        {(tab === "songs_overall" || tab === "songs_year") && hasCharts && (
          <>
            {tab === "songs_year" && years.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <select value={activeYear ?? ""} onChange={(e) => setSelectedYear(Number(e.target.value))} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.12)" }}>
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}
            <SongStatsTable rows={tab === "songs_overall" ? overallSongsRows : yearlySongsRows} />
          </>
        )}
      </div>
    </Shell>
  );
}

function ArtistStatsTable({ rows, artistImages }: { rows: ArtistTableRow[]; artistImages: Record<string, string | null> }) {
  return (
    <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "60px 64px minmax(0,1fr) 80px 80px 70px 110px", padding: "10px 20px", background: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        {["Pos", "", "Artista", "Sem.", "Pico", "Músicas", "Pontos"].map((h, i) => (
          <div key={i} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B", padding: "6px 8px" }}>{h}</div>
        ))}
      </div>
      {rows.map((r) => (
        <div key={r.name} style={{ display: "grid", gridTemplateColumns: "60px 64px minmax(0,1fr) 80px 80px 70px 110px", alignItems: "center", padding: "8px 20px", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 20, fontWeight: 700, textAlign: "right", paddingRight: 12, fontVariantNumeric: "tabular-nums" }}>{r.position}</div>
          <div style={{ padding: "4px 8px" }}>
            {artistImages[r.name] ? (
              <img
                src={artistImages[r.name] as string}
                alt={r.name}
                width={44}
                height={44}
                style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", display: "block", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }}
              />
            ) : (
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${colorForArtist(r.name)[0]}, ${colorForArtist(r.name)[1]})`,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                }}
              />
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
          <div style={{ fontSize: 13, color: "#86868B", fontVariantNumeric: "tabular-nums" }}>{r.weeks}</div>
          <div style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{r.peak}</div>
          <div style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{r.songCount}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#FA243C", fontVariantNumeric: "tabular-nums" }}>{r.totalPoints}</div>
        </div>
      ))}
    </div>
  );
}

function SongStatsTable({ rows }: { rows: SongTableRow[] }) {
  return (
    <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "60px 64px minmax(0,1fr) 80px 70px 110px", padding: "10px 20px", background: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        {["Pos", "", "Música", "Sem.", "Pico", "Pontos"].map((h, i) => (
          <div key={i} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B", padding: "6px 8px" }}>{h}</div>
        ))}
      </div>
      {rows.map((r) => (
        <div key={`${r.title}-${r.artist}`} style={{ display: "grid", gridTemplateColumns: "60px 64px minmax(0,1fr) 80px 70px 110px", alignItems: "center", padding: "8px 20px", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 20, fontWeight: 700, textAlign: "right", paddingRight: 12, fontVariantNumeric: "tabular-nums" }}>{r.position}</div>
          <div style={{ padding: "4px 8px" }}><Cover cover={r.cover} song={{ title: r.title, artist: r.artist }} size={48} rounded={8} /></div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
            <div style={{ fontSize: 12, color: "#86868B" }}>{r.artist}</div>
          </div>
          <div style={{ fontSize: 13, color: "#86868B", fontVariantNumeric: "tabular-nums" }}>{r.weeks}</div>
          <div style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{r.peak}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#FA243C", fontVariantNumeric: "tabular-nums" }}>{r.totalPoints}</div>
        </div>
      ))}
    </div>
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

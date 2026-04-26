import Link from "next/link";
import { redirect } from "next/navigation";
import { Flame } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { HomeGrid } from "@/components/layout/HomeGrid";
import { ChartCard } from "@/components/chart/ChartCard";
import { Avatar } from "@/components/ui/Avatar";
import { Cover } from "@/components/ui/Cover";
import { PositionNumber } from "@/components/ui/PositionNumber";
import { TIMELINE, USERS_DATA, COVER_PALETTES } from "@/lib/data";
import { buildWeekIndexFromDate, buildWeekLabelFromDate, getRankingWeekReference } from "@/lib/chart-week";
import { LandingPage } from "@/components/landing/LandingPage";
import { aggregateGlobalSongs, aggregateTopArtists, type WeeklyChartEntryRow } from "@/lib/weekly-chart-aggregate";

function daysUntilSundayBRT(): number {
  const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const day = nowBRT.getUTCDay();
  return day === 0 ? 0 : 7 - day;
}

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session) return <LandingPage />;

  let userStreak = 0;
  let userParadaNome: string | null = null;
  let thisWeekChartId: string | null = null;

  const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const currentWeekIdx = buildWeekIndexFromDate(nowBRT);
  const rankingWeek = getRankingWeekReference(nowBRT);

  if (session?.user?.id) {
    const [user, thisWeekChart] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { streak: true, paradaNome: true, genres: true },
      }),
      prisma.chart.findUnique({
        where: { userId_weekIndex: { userId: session.user.id, weekIndex: currentWeekIdx } },
        select: { id: true },
      }),
    ]);

    if (user && !user.genres?.length) redirect("/onboarding");

    userStreak = user?.streak ?? 0;
    userParadaNome = user?.paradaNome ?? null;
    thisWeekChartId = thisWeekChart?.id ?? null;
  }

  const [daysLeft, trendingArtists, globalTopSongs] = await Promise.all([
    Promise.resolve(daysUntilSundayBRT()),
    getTrendingArtists(rankingWeek.weekIndex),
    getGlobalTopSongs(rankingWeek.weekIndex, 3),
  ]);

  const feed = (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <YourWeekCard streak={userStreak} daysLeft={daysLeft} paradaNome={userParadaNome} thisWeekChartId={thisWeekChartId} />
      <FriendsRow />

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 2px 0 2px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#86868B", letterSpacing: "0.04em", textTransform: "uppercase" }}>Timeline</div>
        <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.06)" }} />
        <button style={{ background: "none", border: "none", fontSize: 13, fontWeight: 600, color: "#FA243C", cursor: "pointer" }}>Filtrar</button>
      </div>

      {TIMELINE.slice(1).map((t) => (
        <ChartCard key={t.user.id} user={t.user} chart={t.chart} postedAgo={t.postedAgo} />
      ))}
    </div>
  );

  const sidebar = (
    <>
      <GlobalTeaser topSongs={globalTopSongs} weekLabel={rankingWeek.weekLabel} />
      <SuggestedUsers />
      <TrendingArtists artists={trendingArtists} />
    </>
  );

  return (
    <Shell title="Início" subtitle="As paradas de quem você segue">
      <HomeGrid feed={feed} sidebar={sidebar} />
    </Shell>
  );
}

function YourWeekCard({
  streak,
  daysLeft,
  paradaNome,
  thisWeekChartId,
}: {
  streak: number;
  daysLeft: number;
  paradaNome: string | null;
  thisWeekChartId: string | null;
}) {
  const weekNow = buildWeekLabelFromDate(new Date());
  const hasSubmitted = thisWeekChartId !== null;
  const label = paradaNome ? paradaNome.toUpperCase() : "SUA PARADA";
  return (
    <div style={{
      background: "linear-gradient(135deg, #FA243C 0%, #FF5858 100%)",
      borderRadius: 18,
      padding: 24,
      color: "white",
      display: "flex",
      alignItems: "center",
      gap: 20,
      boxShadow: "0 4px 16px rgba(250,36,60,0.25)",
      flexWrap: "wrap",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: "rgba(255,255,255,0.15)",
        display: "grid", placeItems: "center",
        backdropFilter: "blur(10px)",
        flexShrink: 0,
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
          <path d="M3 12V9M7 12V6M11 12V3M15 12V7M19 12V5" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.85 }}>
          {label} · {weekNow}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", marginTop: 2, lineHeight: 1.2 }}>
          {hasSubmitted ? "Você já publicou esta semana!" : "Quais foram suas músicas dessa semana?"}
        </div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          {hasSubmitted ? (
            "Veja sua parada publicada abaixo"
          ) : (
            <>
              {daysLeft === 0 ? "Último dia" : `${daysLeft} dia${daysLeft !== 1 ? "s" : ""} restante${daysLeft !== 1 ? "s" : ""}`}
              {streak > 0 && <> · streak de {streak} semana{streak !== 1 ? "s" : ""} <Flame size={12} fill="white" /></>}
            </>
          )}
        </div>
      </div>
      <Link href={hasSubmitted ? `/chart/${thisWeekChartId}` : "/create"} style={{
        background: "white", color: "#FA243C", textDecoration: "none",
        padding: "12px 22px", borderRadius: 100, fontSize: 14, fontWeight: 700,
        letterSpacing: "-0.01em", boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        whiteSpace: "nowrap", flexShrink: 0,
      }}>
        {hasSubmitted ? "Ver minha parada" : "Criar parada"}
      </Link>
    </div>
  );
}

function FriendsRow() {
  return (
    <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>Publicaram hoje</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, color: "#86868B" }}>{TIMELINE.slice(0, 5).length} pessoas</div>
      </div>
      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 4 }}>
        {TIMELINE.slice(0, 7).map((t) => (
          <Link key={t.user.id} href={`/profile/${t.user.handle}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textDecoration: "none", color: "inherit", flexShrink: 0 }}>
            <div style={{ position: "relative" }}>
              <Avatar user={t.user} size={56} ring />
              <div style={{
                position: "absolute", bottom: -2, right: -2,
                background: "#FA243C", color: "white", fontSize: 10, fontWeight: 700,
                padding: "2px 6px", borderRadius: 8, border: "2px solid white",
              }}>
                {t.chart.entries.length}
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 500, maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {t.user.name.split(" ")[0]}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function GlobalTeaser({
  topSongs,
  weekLabel,
}: {
  topSongs: Awaited<ReturnType<typeof getGlobalTopSongs>>;
  weekLabel: string;
}) {
  const top3 = topSongs.slice(0, 3);
  return (
    <Link href="/global" style={{ textDecoration: "none", color: "inherit" }}>
      <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: "#000", color: "white", display: "grid", placeItems: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.015em" }}>Parada Global</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11, color: "#86868B" }}>{weekLabel}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {top3.map((e) => (
            <div key={e.position} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <PositionNumber n={e.position} size={14} />
              <Cover cover={e.cover} song={e.song} size={36} rounded={6} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.song.title}</div>
                <div style={{ fontSize: 11, color: "#86868B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.song.artist}</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#86868B", fontVariantNumeric: "tabular-nums" }}>{e.points}pts</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, fontSize: 12, color: "#FA243C", fontWeight: 600 }}>Ver parada completa →</div>
      </div>
    </Link>
  );
}

function SuggestedUsers() {
  const suggested = USERS_DATA.slice(2, 5);
  return (
    <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.015em", marginBottom: 14 }}>Quem seguir</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {suggested.map((u) => (
          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href={`/profile/${u.handle}`}>
              <Avatar user={u} size={40} />
            </Link>
            <div style={{ minWidth: 0, flex: 1 }}>
              <Link href={`/profile/${u.handle}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</div>
                <div style={{ fontSize: 11, color: "#86868B" }}>@{u.handle} · {u.followers.toLocaleString("pt-BR")} seguidores</div>
              </Link>
            </div>
            <button style={{
              background: "#1D1D1F", color: "white", border: "none",
              padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
            }}>
              Seguir
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

async function getTrendingArtists(weekIdx: number, limit = 4) {
  const entries: WeeklyChartEntryRow[] = await prisma.chartEntry.findMany({
    where: { chart: { weekIndex: weekIdx } },
    select: {
      position: true,
      points: true,
      chartId: true,
      coverPaletteA: true,
      coverPaletteB: true,
      coverSeed: true,
      song: {
        select: {
          title: true,
          artist: true,
          album: true,
          spotifyId: true,
          artistSpotifyId: true,
          artistRef: { select: { spotifyId: true, name: true } },
        },
      },
    },
  });

  return aggregateTopArtists(entries, limit).map(({ name, totalPoints }) => ({ name, totalPoints }));
}

async function getGlobalTopSongs(weekIdx: number, limit = 3) {
  const entries: WeeklyChartEntryRow[] = await prisma.chartEntry.findMany({
    where: { chart: { weekIndex: weekIdx } },
    select: {
      position: true,
      points: true,
      chartId: true,
      coverPaletteA: true,
      coverPaletteB: true,
      coverSeed: true,
      song: {
        select: {
          title: true,
          artist: true,
          album: true,
          spotifyId: true,
          artistSpotifyId: true,
          artistRef: { select: { spotifyId: true, name: true } },
        },
      },
    },
  });
  return aggregateGlobalSongs(entries, limit);
}

function TrendingArtists({ artists }: { artists: { name: string; totalPoints: number }[] }) {
  if (artists.length === 0) return null;
  return (
    <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.015em", marginBottom: 14 }}>Artistas em alta</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {artists.map((a, i) => (
          <Link key={a.name} href={`/artist/${encodeURIComponent(a.name)}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#000000", width: 20, fontVariantNumeric: "tabular-nums" }}>{i + 1}</div>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: `linear-gradient(135deg, ${COVER_PALETTES[i * 3][0]}, ${COVER_PALETTES[i * 3][1]})`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              flexShrink: 0,
            }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
              <div style={{ fontSize: 11, color: "#86868B" }}>{a.totalPoints}pts esta semana</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

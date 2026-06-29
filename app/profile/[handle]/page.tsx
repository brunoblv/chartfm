"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeft, Flame, Trophy, BadgeCheck } from "lucide-react";
import { AdSlot } from "@/components/ui/AdSlot";
import { ADSENSE_SLOTS } from "@/lib/adsense-slots";
import { Shell } from "@/components/layout/Shell";
import { Avatar } from "@/components/ui/Avatar";
import { ChartCard } from "@/components/chart/ChartCard";
import { FollowButton } from "@/components/ui/FollowButton";
import { MovementBadge } from "@/components/ui/MovementBadge";
import { Cover } from "@/components/ui/Cover";
import { USERS_DATA, COVER_PALETTES } from "@/lib/data";
import type { Chart, Song, UserWithCharts } from "@/lib/types";
import { buildArtistPath, buildSongPath } from "@/lib/music-routes";
import { safeHeaderBg } from "@/lib/chart-week";
import { formatSongArtist } from "@/lib/song-artist";
import { useIsMobile } from "@/hooks/useIsMobile";
import { chartStatsLabels } from "@/lib/chart-cadence";
import {
  pointsForChartPosition,
  type ParadaScoringTier,
} from "@/lib/parada-points";
import { ProfileReviewsTab } from "@/components/profile/ProfileReviewsTab";

type ProfileSection = "parada" | "reviews";
type ParadaTab = "charts" | "artists" | "songs" | "numberOnes";
type StatsScope = "overall" | "year";
const STATS_TABS = new Set<ParadaTab>(["artists", "songs", "numberOnes"]);

type ParadaInfo = {
  id: string;
  name: string;
  logo: string | null;
  genres: string[];
  isPrimary: boolean;
  sortOrder: number;
  cadence?: "weekly" | "daily";
};

type ApiProfile = {
  user: UserWithCharts;
  imageUrl: string | null;
  paradaNome: string | null;
  genres: string[];
  paradas?: ParadaInfo[];
  activeParadaId?: string | null;
  scoringTier?: ParadaScoringTier;
  isFollowing: boolean;
  lastfmUser?: string | null;
  twitterUser?: string | null;
  instagramUser?: string | null;
  mode?: "summary" | "full";
  page?: number;
  perPage?: number;
  totalCharts?: number;
  chartYears?: number[];
  filterYear?: number | null;
  artistImages?: Record<string, string | null>;
  globalNumberOnes?: Record<string, number>;
  statsSummary?: {
    totalRankedSlots: number;
    numberOnes: number;
  };
};

function IconX({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IconInstagram({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function IconLastfm({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M10.87 17.45l-.77-2.1s-1.26 1.41-3.15 1.41c-1.66 0-2.85-1.45-2.85-3.76 0-2.97 1.49-4.03 2.97-4.03 2.15 0 2.85 1.4 3.44 3.16l.77 2.41c.77 2.32 2.21 4.19 6.36 4.19 2.97 0 4.98-9.06 4.98-9.06l-.79-.79h-2.85l-1.01 4.88c-.1.53-.47.88-.95.88-1.06 0-1.19-.65-1.59-2.1l-.83-2.82C13.69 6.64 12.18 5.14 8.12 5.14c-4.02 0-6.55 2.51-6.55 7.26 0 4.52 2.67 7.02 6.39 7.02 3.52 0 2.91-1.97 2.91-1.97z" />
    </svg>
  );
}

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
  const artistMap = new Map<
    string,
    { name: string; points: number; color: [string, string] }
  >();
  latest.entries.forEach((e, i) => {
    const artists = [e.song.artist, ...(e.song.featArtists ?? [])]
      .map((a) => a.trim())
      .filter(Boolean);
    const unique = [...new Set(artists)];
    unique.forEach((a) => {
      if (!artistMap.has(a))
        artistMap.set(a, {
          name: a,
          points: 0,
          color: COVER_PALETTES[i % COVER_PALETTES.length],
        });
      artistMap.get(a)!.points += pointsForChartPosition(
        e.position,
        "primary",
        latest.entries.length,
      );
    });
  });
  return [...artistMap.values()]
    .sort((a, b) => b.points - a.points)
    .slice(0, 12);
}

type ArtistTableRow = {
  position: number;
  name: string;
  songCount: number;
  totalPoints: number;
  weeks: number;
  peak: number;
  numberOnes: number;
  prevPos: number | null;
  delta: number | null;
  status: "new" | "return" | "up" | "down" | "same";
  growthPct: number | null;
  artistSpotifyId?: string | null;
  artistRefId?: number | null;
};

type SongTableRow = {
  position: number;
  title: string;
  artist: string;
  songId?: string | null;
  slugArtist?: string | null;
  spotifyId?: string | null;
  artistSpotifyId?: string | null;
  artistRefId?: number | null;
  totalPoints: number;
  weeks: number;
  peak: number;
  numberOnes: number;
  prevPos: number | null;
  delta: number | null;
  status: "new" | "return" | "up" | "down" | "same";
  growthPct: number | null;
  cover: Chart["entries"][number]["cover"];
};

type NumberOneRow = {
  title: string;
  artist: string;
  count: number;
  firstWeek: number;
  lastWeek: number;
  firstDateRange: string;
  lastDateRange: string;
  lastWeekLabel: string;
  cover: Chart["entries"][number]["cover"];
  songId?: string | null;
  slugArtist?: string | null;
  spotifyId?: string | null;
  artistSpotifyId?: string | null;
  artistRefId?: number | null;
};

function pointsForPosition(
  position: number,
  tier: ParadaScoringTier,
  chartSize: number,
  cadence?: "weekly" | "daily",
) {
  return pointsForChartPosition(position, tier, chartSize, cadence);
}

function colorForArtist(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return COVER_PALETTES[Math.abs(hash) % COVER_PALETTES.length];
}

function mergeArtistRouteMeta(
  cur: { artistSpotifyId?: string | null; artistRefId?: number | null },
  song: Song,
  key: string,
) {
  const primary = song.artist.trim() === key;
  if (!primary) return;
  if (song.artistRefId != null && cur.artistRefId == null)
    cur.artistRefId = song.artistRefId;
  const sid = song.artistSpotifyId?.trim();
  if (sid && !cur.artistSpotifyId) cur.artistSpotifyId = sid;
}

function aggregateArtists(
  charts: Chart[],
  previousCharts: Chart[],
  tier: ParadaScoringTier = "primary",
  cadence?: "weekly" | "daily",
): ArtistTableRow[] {
  const map = new Map<
    string,
    {
      points: number;
      songs: Set<string>;
      weeks: Set<number>;
      peak: number;
      numberOnes: number;
      artistSpotifyId?: string | null;
      artistRefId?: number | null;
    }
  >();
  charts.forEach((c) => {
    const chartSize = c.entries.length;
    c.entries.forEach((e) => {
      const artists = [e.song.artist, ...(e.song.featArtists ?? [])]
        .map((a) => a.trim())
        .filter(Boolean);
      const unique = [...new Set(artists)];
      unique.forEach((key) => {
        const cur = map.get(key) ?? {
          points: 0,
          songs: new Set<string>(),
          weeks: new Set<number>(),
          peak: e.position,
          numberOnes: 0,
        };
        cur.points += pointsForPosition(e.position, tier, chartSize, cadence);
        cur.songs.add(e.song.title);
        cur.weeks.add(c.week);
        cur.peak = Math.min(cur.peak, e.position);
        if (e.position === 1) cur.numberOnes += 1;
        mergeArtistRouteMeta(cur, e.song, key);
        map.set(key, cur);
      });
    });
  });
  const prevMap = new Map<string, number>();
  previousCharts.forEach((c) => {
    const chartSize = c.entries.length;
    c.entries.forEach((e) => {
      const artists = [e.song.artist, ...(e.song.featArtists ?? [])]
        .map((a) => a.trim())
        .filter(Boolean);
      const unique = [...new Set(artists)];
      unique.forEach((artist) => {
        prevMap.set(
          artist,
          (prevMap.get(artist) ?? 0) +
            pointsForPosition(e.position, tier, chartSize, cadence),
        );
      });
    });
  });
  const sorted = [...map.entries()].sort((a, b) => b[1].points - a[1].points);
  const prevRank = [...prevMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .reduce((acc, [k], i) => acc.set(k, i + 1), new Map<string, number>());
  return sorted.map(([name, v], i) => {
    const position = i + 1;
    const prevPos = prevRank.get(name) ?? null;
    const delta = prevPos === null ? null : prevPos - position;
    const status: ArtistTableRow["status"] =
      prevPos === null
        ? "new"
        : delta === 0
          ? "same"
          : (delta ?? 0) > 0
            ? "up"
            : "down";
    const prevPoints = prevMap.get(name) ?? 0;
    const growthPct =
      prevPoints > 0 ? ((v.points - prevPoints) / prevPoints) * 100 : null;
    return {
      position,
      name,
      songCount: v.songs.size,
      totalPoints: v.points,
      weeks: v.weeks.size,
      peak: v.peak,
      numberOnes: v.numberOnes,
      prevPos,
      delta,
      status,
      growthPct,
      artistSpotifyId: v.artistSpotifyId,
      artistRefId: v.artistRefId,
    };
  });
}

function mergeSongRouteMeta(
  cur: {
    songId?: string | null;
    slugArtist?: string | null;
    spotifyId?: string | null;
    artistSpotifyId?: string | null;
    artistRefId?: number | null;
  },
  song: Song,
) {
  if (song.artistRefId != null && cur.artistRefId == null)
    cur.artistRefId = song.artistRefId;
  const asid = song.artistSpotifyId?.trim();
  if (asid && !cur.artistSpotifyId) cur.artistSpotifyId = asid;
  const sid = song.spotifyId?.trim();
  if (sid && !cur.spotifyId) cur.spotifyId = sid;
  const id = song.id?.trim();
  if (id && !cur.songId) cur.songId = id;
  const slugA = song.slugArtist?.trim();
  if (slugA && !cur.slugArtist) cur.slugArtist = slugA;
}

function aggregateSongs(
  charts: Chart[],
  previousCharts: Chart[],
  tier: ParadaScoringTier = "primary",
  cadence?: "weekly" | "daily",
): SongTableRow[] {
  const map = new Map<
    string,
    {
      title: string;
      artist: string;
      points: number;
      weeks: Set<number>;
      peak: number;
      numberOnes: number;
      cover: Chart["entries"][number]["cover"];
      songId?: string | null;
      slugArtist?: string | null;
      spotifyId?: string | null;
      artistSpotifyId?: string | null;
      artistRefId?: number | null;
    }
  >();
  charts.forEach((c) => {
    const chartSize = c.entries.length;
    c.entries.forEach((e) => {
      const key = `${e.song.title}\0${e.song.artist}`;
      const cur = map.get(key) ?? {
        title: e.song.title,
        artist: e.song.artist,
        points: 0,
        weeks: new Set<number>(),
        peak: e.position,
        numberOnes: 0,
        cover: e.cover,
      };
      cur.points += pointsForPosition(e.position, tier, chartSize, cadence);
      cur.weeks.add(c.week);
      const prevPeak = cur.peak;
      cur.peak = Math.min(cur.peak, e.position);
      if (e.position === 1) cur.numberOnes += 1;
      if (e.position < prevPeak) cur.cover = e.cover;
      mergeSongRouteMeta(cur, e.song);
      map.set(key, cur);
    });
  });
  const prevMap = new Map<string, number>();
  previousCharts.forEach((c) => {
    const chartSize = c.entries.length;
    c.entries.forEach((e) => {
      const key = `${e.song.title}\0${e.song.artist}`;
      prevMap.set(
        key,
        (prevMap.get(key) ?? 0) +
          pointsForPosition(e.position, tier, chartSize, cadence),
      );
    });
  });
  const sorted = [...map.entries()].sort((a, b) => b[1].points - a[1].points);
  const prevRank = [...prevMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .reduce((acc, [k], i) => acc.set(k, i + 1), new Map<string, number>());
  return sorted.map(([key, v], i) => {
    const position = i + 1;
    const prevPos = prevRank.get(key) ?? null;
    const delta = prevPos === null ? null : prevPos - position;
    const status: SongTableRow["status"] =
      prevPos === null
        ? "new"
        : delta === 0
          ? "same"
          : (delta ?? 0) > 0
            ? "up"
            : "down";
    const prevPoints = prevMap.get(key) ?? 0;
    const growthPct =
      prevPoints > 0 ? ((v.points - prevPoints) / prevPoints) * 100 : null;
    return {
      position,
      title: v.title,
      artist: v.artist,
      songId: v.songId,
      slugArtist: v.slugArtist,
      spotifyId: v.spotifyId,
      artistSpotifyId: v.artistSpotifyId,
      artistRefId: v.artistRefId,
      totalPoints: v.points,
      weeks: v.weeks.size,
      peak: v.peak,
      numberOnes: v.numberOnes,
      prevPos,
      delta,
      status,
      growthPct,
      cover: v.cover,
    };
  });
}

function buildNumberOnesList(charts: Chart[]): NumberOneRow[] {
  const map = new Map<
    string,
    {
      title: string;
      artist: string;
      count: number;
      firstWeek: number;
      lastWeek: number;
      firstDateRange: string;
      lastDateRange: string;
      lastWeekLabel: string;
      cover: Chart["entries"][number]["cover"];
      songId?: string | null;
      slugArtist?: string | null;
      spotifyId?: string | null;
      artistSpotifyId?: string | null;
      artistRefId?: number | null;
    }
  >();

  const sorted = [...charts].sort((a, b) => a.week - b.week);
  for (const chart of sorted) {
    const entry = chart.entries.find((e) => e.position === 1);
    if (!entry) continue;
    const key = `${entry.song.title}\0${entry.song.artist}`;
    const cur = map.get(key);
    if (!cur) {
      map.set(key, {
        title: entry.song.title,
        artist: entry.song.artist,
        count: 1,
        firstWeek: chart.week,
        lastWeek: chart.week,
        firstDateRange: chart.dateRange,
        lastDateRange: chart.dateRange,
        lastWeekLabel: chart.weekLabel,
        cover: entry.cover,
        songId: entry.song.id,
        slugArtist: entry.song.slugArtist,
        spotifyId: entry.song.spotifyId,
        artistSpotifyId: entry.song.artistSpotifyId,
        artistRefId: entry.song.artistRefId,
      });
      continue;
    }
    cur.count += 1;
    cur.lastWeek = chart.week;
    cur.lastDateRange = chart.dateRange;
    cur.lastWeekLabel = chart.weekLabel;
    cur.cover = entry.cover;
    mergeSongRouteMeta(cur, entry.song);
  }

  return [...map.values()].sort(
    (a, b) => b.lastWeek - a.lastWeek || b.count - a.count,
  );
}

function buildAchievements(
  user: UserWithCharts,
  numberOnes: number,
  totalCharts: number,
  totalRanked: number,
  isDaily: boolean,
) {
  const streakUnit = isDaily ? "dias" : "semanas";
  const list: { emoji: string; name: string; desc: string }[] = [
    {
      emoji: "🔥",
      name: "Streak",
      desc: `${user.streak} ${streakUnit} de streak`,
    },
    {
      emoji: "🎵",
      name: "Fã de música",
      desc:
        totalRanked >= 100
          ? `${totalRanked}+ entradas no chart`
          : `${totalRanked} músicas rankeadas`,
    },
    {
      emoji: "🏆",
      name: "Chart topper",
      desc:
        numberOnes > 0
          ? `${numberOnes} faixa(s) em #1`
          : "Busque o primeiro #1",
    },
    {
      emoji: "🌟",
      name: "Rede",
      desc: `${user.followers.toLocaleString("pt-BR")} seguidores`,
    },
    { emoji: "📊", name: "Paradas", desc: `${totalCharts} publicação(ões)` },
    { emoji: "💎", name: "Membro", desc: "ChartFM" },
  ];
  return list;
}

export default function ProfilePage() {
  const params = useParams();
  const raw = params?.handle;
  const handle = decodeURIComponent(
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "",
  );

  const { data: session, status } = useSession();
  const [profileSection, setProfileSection] =
    useState<ProfileSection>("parada");
  const [activeParadaId, setActiveParadaId] = useState<string | null>(null);
  const [paradaTab, setParadaTab] = useState<ParadaTab>("charts");
  const [statsScope, setStatsScope] = useState<StatsScope>("overall");
  const [phase, setPhase] = useState<"loading" | "ready" | "missing" | "error">(
    "loading",
  );
  const [source, setSource] = useState<"db" | "mock" | null>(null);
  const [payload, setPayload] = useState<ApiProfile | null>(null);
  const [fullPayload, setFullPayload] = useState<ApiProfile | null>(null);
  const [loadingFullStats, setLoadingFullStats] = useState(false);
  const [mockUser, setMockUser] = useState<UserWithCharts | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [chartsYearFilter, setChartsYearFilter] = useState<number | null>(null);
  const [chartPage, setChartPage] = useState(1);
  const [loadingChartPage, setLoadingChartPage] = useState(false);
  const [statsPage, setStatsPage] = useState(1);
  const CHARTS_PER_PAGE = 8;
  const STATS_PER_PAGE = 100;
  const isMobile = useIsMobile();

  const profileQuery = (mode: "summary" | "full", page = 1) => {
    const q = new URLSearchParams({
      mode,
      page: String(page),
      perPage: String(CHARTS_PER_PAGE),
    });
    if (activeParadaId) q.set("paradaId", activeParadaId);
    if (chartsYearFilter != null) q.set("year", String(chartsYearFilter));
    return `/api/profile/${encodeURIComponent(handle)}?${q}`;
  };

  useEffect(() => {
    if (!handle) {
      setPhase("missing");
      return;
    }
    let cancelled = false;
    setPhase("loading");
    setProfileSection("parada");
    setActiveParadaId(null);
    setChartPage(1);
    setChartsYearFilter(null);
    setFullPayload(null);
    (async () => {
      try {
        const q = new URLSearchParams({
          mode: "summary",
          page: "1",
          perPage: String(CHARTS_PER_PAGE),
        });
        const res = await fetch(
          `/api/profile/${encodeURIComponent(handle)}?${q}`,
        );
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as ApiProfile;
          setPayload(data);
          setActiveParadaId(
            data.activeParadaId ?? data.paradas?.[0]?.id ?? null,
          );
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
        setPhase("error");
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle, CHARTS_PER_PAGE]);

  useEffect(() => {
    if (!handle || source !== "db") return;
    if (
      payload?.page === chartPage &&
      payload.activeParadaId === activeParadaId &&
      (payload.filterYear ?? null) === chartsYearFilter
    ) {
      return;
    }
    let cancelled = false;
    setLoadingChartPage(true);
    (async () => {
      try {
        const res = await fetch(profileQuery("summary", chartPage));
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as ApiProfile;
        if (cancelled) return;
        setPayload(data);
      } catch {
        // mantém a página atual em caso de erro de rede
      } finally {
        if (!cancelled) setLoadingChartPage(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chartPage,
    handle,
    source,
    CHARTS_PER_PAGE,
    payload?.page,
    activeParadaId,
    chartsYearFilter,
  ]);

  useEffect(() => {
    if (!handle || source !== "db" || !STATS_TABS.has(paradaTab)) return;
    if (fullPayload && fullPayload.activeParadaId === activeParadaId) return;
    let cancelled = false;
    setLoadingFullStats(true);
    (async () => {
      try {
        const res = await fetch(profileQuery("full"));
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as ApiProfile;
        if (cancelled) return;
        setFullPayload(data);
      } finally {
        if (!cancelled) setLoadingFullStats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, source, fullPayload, activeParadaId, paradaTab]);

  const user = payload?.user ?? mockUser;
  const statsUser =
    source === "db" && STATS_TABS.has(paradaTab)
      ? (fullPayload?.user ?? null)
      : user;
  const totalChartsCount = payload?.totalCharts ?? user?.charts.length ?? 0;
  const sidebarTopArtists = useMemo(
    () => (user ? buildTopArtists(user) : []),
    [user],
  );
  const sidebarNumberOnes =
    payload?.statsSummary?.numberOnes ??
    (source === "mock" && user
      ? countDistinctNumberOnes(user.charts)
      : fullPayload
        ? countDistinctNumberOnes(fullPayload.user.charts)
        : 0);
  const sidebarRankedSlots =
    payload?.statsSummary?.totalRankedSlots ??
    (source === "mock" && user
      ? user.charts.reduce((acc, c) => acc + c.entries.length, 0)
      : fullPayload
        ? fullPayload.user.charts.reduce((acc, c) => acc + c.entries.length, 0)
        : 0);
  const imageUrl = payload?.imageUrl ?? null;
  const paradas = payload?.paradas ?? [];
  const activeParada =
    paradas.find((p) => p.id === activeParadaId) ?? paradas[0] ?? null;
  const paradaNome = activeParada?.name ?? payload?.paradaNome ?? null;
  const genres = activeParada?.genres ?? payload?.genres ?? [];
  const scoringTier: ParadaScoringTier =
    fullPayload?.scoringTier ??
    payload?.scoringTier ??
    (activeParada?.isPrimary === false ? "secondary" : "primary");
  const scoringCadence = activeParada?.cadence;
  const isDailyParada = scoringCadence === "daily";
  const statsLabels = chartStatsLabels(isDailyParada);
  const artistImages = fullPayload?.artistImages ?? payload?.artistImages ?? {};
  const isFollowing = payload?.isFollowing ?? false;
  const isOwn = status === "authenticated" && session?.user?.handle === handle;
  const twitterUser = payload?.twitterUser ?? null;
  const instagramUser = payload?.instagramUser ?? null;
  const lastfmUser = payload?.lastfmUser ?? null;

  const topArtists = useMemo(
    () => (statsUser ? buildTopArtists(statsUser) : sidebarTopArtists),
    [statsUser, sidebarTopArtists],
  );
  const numberOnes = statsUser
    ? countDistinctNumberOnes(statsUser.charts)
    : sidebarNumberOnes;
  const achievements = useMemo(
    () =>
      user
        ? buildAchievements(
            user,
            sidebarNumberOnes,
            totalChartsCount,
            sidebarRankedSlots,
            isDailyParada,
          )
        : [],
    [
      user,
      sidebarNumberOnes,
      totalChartsCount,
      sidebarRankedSlots,
      isDailyParada,
    ],
  );
  const years = useMemo(() => {
    if (statsUser)
      return [
        ...new Set(
          statsUser.charts.map((c) =>
            c.week >= 1_000_000
              ? Math.floor(c.week / 10000)
              : Math.floor(c.week / 100),
          ),
        ),
      ].sort((a, b) => b - a);
    if (payload?.chartYears?.length) return payload.chartYears;
    return [];
  }, [statsUser, payload?.chartYears]);
  const publicationYears = useMemo(() => {
    if (payload?.chartYears?.length) return payload.chartYears;
    if (mockUser)
      return [
        ...new Set(
          mockUser.charts.map((c) =>
            c.week >= 1_000_000
              ? Math.floor(c.week / 10000)
              : Math.floor(c.week / 100),
          ),
        ),
      ].sort((a, b) => b - a);
    return [];
  }, [payload?.chartYears, mockUser]);
  const activeYear = selectedYear ?? years[0] ?? null;
  const chartsSortedAsc = useMemo(
    () =>
      statsUser ? [...statsUser.charts].sort((a, b) => a.week - b.week) : [],
    [statsUser],
  );
  const latestWeek = chartsSortedAsc[chartsSortedAsc.length - 1]?.week ?? null;
  const overallArtistsRows = useMemo(() => {
    if (!latestWeek) return [];
    const previous = chartsSortedAsc.filter((c) => c.week < latestWeek);
    return aggregateArtists(
      chartsSortedAsc,
      previous,
      scoringTier,
      scoringCadence,
    );
  }, [chartsSortedAsc, latestWeek, scoringTier, scoringCadence]);
  const overallSongsRows = useMemo(() => {
    if (!latestWeek) return [];
    const previous = chartsSortedAsc.filter((c) => c.week < latestWeek);
    return aggregateSongs(
      chartsSortedAsc,
      previous,
      scoringTier,
      scoringCadence,
    );
  }, [chartsSortedAsc, latestWeek, scoringTier, scoringCadence]);
  const yearlyArtistsRows = useMemo(() => {
    if (!activeYear) return [];
    const yearCharts = chartsSortedAsc.filter(
      (c) =>
        (c.week >= 1_000_000
          ? Math.floor(c.week / 10000)
          : Math.floor(c.week / 100)) === activeYear,
    );
    const latestYearWeek = yearCharts[yearCharts.length - 1]?.week ?? null;
    const previous = latestYearWeek
      ? yearCharts.filter((c) => c.week < latestYearWeek)
      : [];
    return aggregateArtists(yearCharts, previous, scoringTier, scoringCadence);
  }, [chartsSortedAsc, activeYear, scoringTier, scoringCadence]);
  const yearlySongsRows = useMemo(() => {
    if (!activeYear) return [];
    const yearCharts = chartsSortedAsc.filter(
      (c) =>
        (c.week >= 1_000_000
          ? Math.floor(c.week / 10000)
          : Math.floor(c.week / 100)) === activeYear,
    );
    const latestYearWeek = yearCharts[yearCharts.length - 1]?.week ?? null;
    const previous = latestYearWeek
      ? yearCharts.filter((c) => c.week < latestYearWeek)
      : [];
    return aggregateSongs(yearCharts, previous, scoringTier, scoringCadence);
  }, [chartsSortedAsc, activeYear, scoringTier, scoringCadence]);

  const artistRowsForTab =
    statsScope === "overall" ? overallArtistsRows : yearlyArtistsRows;
  const songRowsForTab =
    statsScope === "overall" ? overallSongsRows : yearlySongsRows;
  const numberOnesRows = useMemo(
    () => (statsUser ? buildNumberOnesList(statsUser.charts) : []),
    [statsUser],
  );
  const totalNumberOneWeeks = useMemo(
    () => numberOnesRows.reduce((acc, r) => acc + r.count, 0),
    [numberOnesRows],
  );

  if (phase === "loading") {
    return (
      <Shell title="" noPadding>
        <div
          style={{
            padding: "48px 40px",
            color: "var(--text-muted)",
            fontSize: 15,
          }}
        >
          Carregando perfil…
        </div>
      </Shell>
    );
  }

  if (phase === "error") {
    return (
      <Shell title="Perfil" subtitle="Erro ao carregar">
        <div
          style={{
            maxWidth: 480,
            textAlign: "center",
            margin: "48px auto",
            color: "var(--text-muted)",
          }}
        >
          <p style={{ fontSize: 16, marginBottom: 20 }}>
            Não foi possível carregar o perfil de @{handle} agora. Tente
            recarregar a página em instantes.
          </p>
          <Link
            href="/"
            style={{
              color: "#FA243C",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            ← Voltar ao início
          </Link>
        </div>
      </Shell>
    );
  }

  if (phase === "missing" || !user) {
    return (
      <Shell title="Perfil" subtitle="Usuário não encontrado">
        <div
          style={{
            maxWidth: 480,
            textAlign: "center",
            margin: "48px auto",
            color: "var(--text-muted)",
          }}
        >
          <p style={{ fontSize: 16, marginBottom: 20 }}>
            Não encontramos ninguém com o handle @{handle}.
          </p>
          <Link
            href="/"
            style={{
              color: "#FA243C",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            ← Voltar ao início
          </Link>
        </div>
      </Shell>
    );
  }

  const hasCharts = (payload?.totalCharts ?? user.charts.length) > 0;
  const totalCharts = payload?.totalCharts ?? user.charts.length;
  const totalRankedSlots = statsUser
    ? statsUser.charts.reduce((acc, c) => acc + c.entries.length, 0)
    : sidebarRankedSlots;

  return (
    <Shell title="" noPadding>
      <div
        style={{
          background: safeHeaderBg(user.avatar),
          padding: isMobile ? "20px 16px 20px 16px" : "48px 40px 32px 40px",
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--text-muted)",
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
            marginBottom: isMobile ? 14 : 20,
          }}
        >
          <ChevronLeft size={16} />
          Início
        </Link>
        <div
          style={{
            display: "flex",
            gap: isMobile ? 14 : 28,
            alignItems: isMobile ? "center" : "flex-end",
            flexWrap: "wrap",
          }}
        >
          <Avatar
            user={user}
            imageUrl={imageUrl ?? undefined}
            size={isMobile ? 72 : 140}
          />

          <div
            style={{ flex: 1, minWidth: 0, paddingBottom: isMobile ? 0 : 8 }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              Perfil
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 2,
                flexWrap: "wrap",
              }}
            >
              <h1
                style={{
                  fontSize: isMobile ? 26 : 48,
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  lineHeight: 1.1,
                  margin: 0,
                }}
              >
                {user.name}
              </h1>
              {user.verified && (
                <BadgeCheck
                  size={isMobile ? 20 : 28}
                  color="#0A84FF"
                  fill="#0A84FF"
                />
              )}
              {user.isStaff && source === "db" && (
                <span
                  style={{
                    fontSize: isMobile ? 10 : 12,
                    fontWeight: 700,
                    padding: isMobile ? "2px 7px" : "3px 10px",
                    borderRadius: 100,
                    background: "rgba(124, 58, 237, 0.12)",
                    color: "#7C3AED",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  Staff
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: isMobile ? 13 : 15,
                color: "var(--text-muted)",
                marginBottom: isMobile ? 6 : 10,
              }}
            >
              @{user.handle}
            </div>
            {paradaNome && source === "db" && (
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text)",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span>{paradaNome}</span>
                {activeParada?.isPrimary && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 100,
                      background: "var(--accent-tint)",
                      color: "#FA243C",
                    }}
                  >
                    Principal
                  </span>
                )}
                {activeParada && !activeParada.isPrimary && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 100,
                      background: "var(--fill-subtle)",
                      color: "var(--text-muted)",
                    }}
                  >
                    Secundária ·{" "}
                    {activeParada.cadence === "daily" ? "Diária" : "Semanal"}
                  </span>
                )}
              </div>
            )}
            {genres.length > 0 && source === "db" && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 12,
                }}
              >
                {genres.map((g) => (
                  <span
                    key={g}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 100,
                      background: "var(--fill-subtle)",
                      color: "var(--text)",
                    }}
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
            {user.bio ? (
              <p
                style={{
                  fontSize: 15,
                  color: "var(--text)",
                  marginBottom: 12,
                  maxWidth: 560,
                  lineHeight: 1.5,
                }}
              >
                {user.bio}
              </p>
            ) : isOwn && source === "db" ? (
              <p
                style={{
                  fontSize: 15,
                  color: "var(--text-muted)",
                  marginBottom: 12,
                  maxWidth: 560,
                  lineHeight: 1.5,
                }}
              >
                Ainda sem bio. As informações vêm da sua conta Google; em breve
                poderá editar aqui.
              </p>
            ) : null}
            {(twitterUser || instagramUser || lastfmUser) &&
              source === "db" && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 14,
                    flexWrap: "wrap",
                  }}
                >
                  {twitterUser && (
                    <a
                      href={`https://x.com/${twitterUser}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`X: @${twitterUser}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        background: "#000",
                        color: "white",
                        borderRadius: 100,
                        fontSize: 13,
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      <IconX size={14} />@{twitterUser}
                    </a>
                  )}
                  {instagramUser && (
                    <a
                      href={`https://instagram.com/${instagramUser}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Instagram: @${instagramUser}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        background:
                          "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
                        color: "white",
                        borderRadius: 100,
                        fontSize: 13,
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      <IconInstagram size={14} />@{instagramUser}
                    </a>
                  )}
                  {lastfmUser && (
                    <a
                      href={`https://www.last.fm/user/${lastfmUser}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Last.fm: ${lastfmUser}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        background: "#D51007",
                        color: "white",
                        borderRadius: 100,
                        fontSize: 13,
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      <IconLastfm size={14} />
                      {lastfmUser}
                    </a>
                  )}
                </div>
              )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: isMobile ? 12 : 20,
                fontSize: 13,
                color: "var(--text-muted)",
                flexWrap: "wrap",
              }}
            >
              <Link
                href={`/profile/${handle}/followers?type=followers`}
                style={{ color: "var(--text-muted)", textDecoration: "none" }}
              >
                <b style={{ color: "var(--text)" }}>
                  {user.followers.toLocaleString("pt-BR")}
                </b>{" "}
                seguidores
              </Link>
              <Link
                href={`/profile/${handle}/followers?type=following`}
                style={{ color: "var(--text-muted)", textDecoration: "none" }}
              >
                <b style={{ color: "var(--text)" }}>{user.following}</b>{" "}
                seguindo
              </Link>
              {user.streak > 0 && (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    color: "#FA243C",
                    fontWeight: 600,
                  }}
                >
                  <Flame size={14} fill="#FA243C" />
                  <b>{user.streak}</b> {isDailyParada ? "dias" : "semanas"} de
                  streak
                </span>
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              paddingBottom: isMobile ? 0 : 8,
              flexWrap: "wrap",
              marginTop: isMobile ? 4 : 0,
              width: isMobile ? "100%" : "auto",
            }}
          >
            {isOwn ? (
              <>
                <Link
                  href={
                    activeParadaId
                      ? `/create?paradaId=${activeParadaId}`
                      : "/create"
                  }
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
                  href="/settings"
                  style={{
                    background: "var(--fill-subtle)",
                    border: "none",
                    padding: "10px 22px",
                    borderRadius: 100,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text)",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  Editar perfil
                </Link>
                <Link
                  href="/chart/setup"
                  style={{
                    background: "var(--fill-subtle)",
                    border: "none",
                    padding: "10px 22px",
                    borderRadius: 100,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text)",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  Paradas
                </Link>
                {paradas.length < 2 && (
                  <Link
                    href="/chart/setup?slot=2"
                    style={{
                      background: "var(--fill-subtle)",
                      border: "none",
                      padding: "10px 22px",
                      borderRadius: 100,
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--text)",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    2ª parada
                  </Link>
                )}
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
                    background: "var(--fill-subtle)",
                    border: "none",
                    padding: "10px 22px",
                    borderRadius: 100,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text)",
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

      <div
        style={{ padding: isMobile ? "0 16px 80px 16px" : "0 40px 80px 40px" }}
      >
        <div
          style={{
            background: "var(--surface)",
            borderRadius: 18,
            border: "1px solid var(--divider)",
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
            marginTop: 20,
            marginBottom: 20,
            overflow: "hidden",
          }}
        >
          {[
            {
              label: paradaNome
                ? `${activeParada?.cadence === "daily" ? "Dias" : "Semanas"} · ${paradaNome}`
                : activeParada?.cadence === "daily"
                  ? "Dias"
                  : "Semanas",
              value: totalCharts,
              icon: null,
            },
            {
              label: "#1 pessoais",
              value: numberOnes,
              icon: <Trophy size={14} color="#FFD700" fill="#FFD700" />,
            },
            { label: "Músicas", value: totalRankedSlots, icon: null },
            { label: "Artistas", value: topArtists.length, icon: null },
          ].map(({ label, value, icon }, i) => {
            const isLastCol = isMobile ? i % 2 === 1 : i === 3;
            const isLastRow = isMobile ? i >= 2 : true;
            return (
              <div
                key={label}
                style={{
                  padding: isMobile ? "16px 16px" : "20px 24px",
                  borderRight: isLastCol ? "none" : "1px solid var(--divider)",
                  borderBottom:
                    isMobile && !isLastRow
                      ? "1px solid var(--divider)"
                      : "none",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: 4,
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: isMobile ? 26 : 32,
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {icon}
                  {value}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginBottom: 28 }}>
          <div
            style={{ display: "flex", alignItems: "center", marginBottom: 14 }}
          >
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: "-0.025em",
              }}
            >
              Conquistas
            </h2>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              style={{
                background: "none",
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                color: "#FA243C",
                cursor: "pointer",
              }}
            >
              Ver todas
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
              gap: 10,
            }}
          >
            {achievements.map((a) => (
              <div
                key={a.name}
                style={{
                  background: "var(--surface)",
                  borderRadius: 14,
                  border: "1px solid var(--divider)",
                  padding: "16px 12px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 6 }}>{a.emoji}</div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    marginBottom: 4,
                  }}
                >
                  {a.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    lineHeight: 1.4,
                  }}
                >
                  {a.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        <AdSlot
          slotId={ADSENSE_SLOTS.profile}
          format="rectangle"
          style={{ margin: "0 0 28px 0" }}
        />

        {source === "db" && (
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--divider)",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 4,
            }}
          >
            {(paradas.length > 0
              ? paradas
              : [
                  {
                    id: "fallback",
                    name: paradaNome ?? "Parada",
                    isPrimary: true,
                    sortOrder: 0,
                    logo: null,
                    genres: [] as string[],
                  },
                ]
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProfileSection("parada");
                  setActiveParadaId(
                    p.id === "fallback" ? activeParadaId : p.id,
                  );
                  setParadaTab("charts");
                  setChartPage(1);
                  setStatsPage(1);
                  setChartsYearFilter(null);
                  setFullPayload(null);
                }}
                style={{
                  padding: isMobile ? "10px 12px" : "12px 16px",
                  background: "none",
                  border: "none",
                  fontSize: isMobile ? 14 : 15,
                  fontWeight:
                    profileSection === "parada" &&
                    (activeParadaId === p.id ||
                      (!activeParadaId && p.sortOrder === 0))
                      ? 700
                      : 500,
                  color:
                    profileSection === "parada" &&
                    (activeParadaId === p.id ||
                      (!activeParadaId && p.sortOrder === 0))
                      ? "var(--text)"
                      : "var(--text-muted)",
                  borderBottom: `2px solid ${profileSection === "parada" && (activeParadaId === p.id || (!activeParadaId && p.sortOrder === 0)) ? "#FA243C" : "transparent"}`,
                  marginBottom: -1,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {p.name}
                {"isPrimary" in p && p.isPrimary ? " ★" : ""}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setProfileSection("reviews")}
              style={{
                padding: isMobile ? "10px 12px" : "12px 16px",
                background: "none",
                border: "none",
                fontSize: isMobile ? 14 : 15,
                fontWeight: profileSection === "reviews" ? 700 : 500,
                color:
                  profileSection === "reviews"
                    ? "var(--text)"
                    : "var(--text-muted)",
                borderBottom: `2px solid ${profileSection === "reviews" ? "#FA243C" : "transparent"}`,
                marginBottom: -1,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Reviews
            </button>
          </div>
        )}

        {source === "mock" && (paradaNome || paradas.length > 0) && (
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--divider)",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 4,
            }}
          >
            <button
              type="button"
              style={{
                padding: isMobile ? "10px 12px" : "12px 16px",
                background: "none",
                border: "none",
                fontSize: isMobile ? 14 : 15,
                fontWeight: 700,
                color: "var(--text)",
                borderBottom: "2px solid #FA243C",
                marginBottom: -1,
                cursor: "default",
                whiteSpace: "nowrap",
              }}
            >
              {paradaNome ?? "Parada"} ★
            </button>
          </div>
        )}

        {profileSection === "reviews" && source === "db" ? (
          <ProfileReviewsTab
            handle={handle}
            isOwn={isOwn}
            userName={user.name}
            isMobile={isMobile}
          />
        ) : (
          <>
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid var(--divider)",
                marginBottom: 24,
                flexWrap: isMobile ? "wrap" : "nowrap",
                overflowX: isMobile ? "auto" : "visible",
              }}
            >
              {(
                [
                  ["charts", "Publicações", "Publ."],
                  ["numberOnes", "#1s", "#1s"],
                  ["artists", "Artistas", "Artistas"],
                  ["songs", "Músicas", "Músicas"],
                ] as [ParadaTab, string, string][]
              ).map(([t, label, mobileLabel]) => (
                <button
                  key={t}
                  type="button"
                  disabled={!hasCharts && t !== "charts"}
                  onClick={() => {
                    setParadaTab(t);
                    setChartPage(1);
                    setStatsPage(1);
                  }}
                  style={{
                    padding: isMobile ? "10px 8px" : "12px 4px",
                    marginRight: isMobile ? 6 : 18,
                    background: "none",
                    border: "none",
                    fontSize: isMobile ? 13 : 14,
                    fontWeight: paradaTab === t ? 600 : 500,
                    color:
                      paradaTab === t ? "var(--text)" : "var(--text-muted)",
                    borderBottom: `2px solid ${paradaTab === t ? "#FA243C" : "transparent"}`,
                    marginBottom: -1,
                    cursor:
                      !hasCharts && t !== "charts" ? "not-allowed" : "pointer",
                    opacity: !hasCharts && t !== "charts" ? 0.45 : 1,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {isMobile ? mobileLabel : label}
                </button>
              ))}
            </div>

            {(paradaTab === "artists" || paradaTab === "songs") &&
              hasCharts && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      background: "var(--fill-subtle)",
                      borderRadius: 100,
                      padding: 3,
                    }}
                  >
                    {(["overall", "year"] as StatsScope[]).map((scope) => (
                      <button
                        key={scope}
                        type="button"
                        onClick={() => {
                          setStatsScope(scope);
                          setStatsPage(1);
                          setSelectedYear(null);
                        }}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 100,
                          border: "none",
                          fontSize: 13,
                          fontWeight: statsScope === scope ? 700 : 500,
                          background:
                            statsScope === scope
                              ? "var(--surface)"
                              : "transparent",
                          color:
                            statsScope === scope
                              ? "var(--text)"
                              : "var(--text-muted)",
                          cursor: "pointer",
                          boxShadow:
                            statsScope === scope
                              ? "0 1px 3px rgba(0,0,0,0.08)"
                              : "none",
                        }}
                      >
                        {scope === "overall" ? "Overall" : "Anual"}
                      </button>
                    ))}
                  </div>
                  {statsScope === "year" && years.length > 0 && (
                    <YearChips
                      years={years}
                      value={activeYear}
                      onChange={(y) => {
                        setSelectedYear(y);
                        setStatsPage(1);
                      }}
                      showAll={false}
                    />
                  )}
                </div>
              )}

            {paradaTab === "charts" && (
              <>
                {!hasCharts ? (
                  <div
                    style={{
                      background: "var(--surface)",
                      borderRadius: 18,
                      border: "1px solid var(--divider)",
                      padding: 40,
                      textAlign: "center",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 15,
                        color: "var(--text-muted)",
                        marginBottom: 20,
                      }}
                    >
                      Nenhuma parada publicada ainda.
                    </p>
                    {isOwn ? (
                      <Link
                        href="/create"
                        style={{
                          color: "#FA243C",
                          fontWeight: 700,
                          textDecoration: "none",
                          fontSize: 15,
                        }}
                      >
                        Publicar a primeira parada →
                      </Link>
                    ) : null}
                  </div>
                ) : (
                  (() => {
                    const totalPages = Math.max(
                      1,
                      Math.ceil(totalCharts / CHARTS_PER_PAGE),
                    );
                    const pageCharts =
                      source === "mock" && chartsYearFilter != null
                        ? user.charts.filter(
                            (c) =>
                              (c.week >= 1_000_000
                                ? Math.floor(c.week / 10000)
                                : Math.floor(c.week / 100)) ===
                              chartsYearFilter,
                          )
                        : user.charts;
                    const mockTotal =
                      source === "mock" ? pageCharts.length : totalCharts;
                    const mockTotalPages = Math.max(
                      1,
                      Math.ceil(mockTotal / CHARTS_PER_PAGE),
                    );
                    const effectiveTotalPages =
                      source === "mock" ? mockTotalPages : totalPages;
                    const effectiveTotal =
                      source === "mock" ? mockTotal : totalCharts;
                    const mockPageCharts =
                      source === "mock"
                        ? pageCharts.slice(
                            (chartPage - 1) * CHARTS_PER_PAGE,
                            chartPage * CHARTS_PER_PAGE,
                          )
                        : pageCharts;
                    const displayCharts =
                      source === "mock" ? mockPageCharts : pageCharts;
                    const currentChartPage = payload?.page ?? chartPage;
                    return (
                      <>
                        {publicationYears.length > 1 && (
                          <div style={{ marginBottom: 16 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--text-muted)",
                                marginBottom: 8,
                                letterSpacing: "0.04em",
                                textTransform: "uppercase",
                              }}
                            >
                              Filtrar por ano
                            </div>
                            <YearChips
                              years={publicationYears}
                              value={chartsYearFilter}
                              onChange={(y) => {
                                setChartsYearFilter(y);
                                setChartPage(1);
                              }}
                            />
                          </div>
                        )}
                        {loadingChartPage && (
                          <div
                            style={{
                              marginBottom: 12,
                              color: "var(--text-muted)",
                              fontSize: 13,
                            }}
                          >
                            Carregando página {chartPage}…
                          </div>
                        )}
                        {chartsYearFilter != null && (
                          <div
                            style={{
                              marginBottom: 12,
                              fontSize: 13,
                              color: "var(--text-muted)",
                            }}
                          >
                            {effectiveTotal} publicação
                            {effectiveTotal === 1 ? "" : "ões"} em{" "}
                            {chartsYearFilter}
                          </div>
                        )}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fill, minmax(320px, 1fr))",
                            gap: 20,
                          }}
                        >
                          {displayCharts.map((chart) => (
                            <div
                              key={chart.id}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                              }}
                            >
                              <ChartCard
                                user={user}
                                chart={chart}
                                showFollowActions={!isOwn}
                                showUserHeader={false}
                              />
                            </div>
                          ))}
                        </div>
                        <PaginationBar
                          page={currentChartPage}
                          totalPages={effectiveTotalPages}
                          onChange={setChartPage}
                          loading={loadingChartPage}
                        />
                      </>
                    );
                  })()
                )}
              </>
            )}

            {paradaTab === "numberOnes" && hasCharts && (
              <>
                {source === "db" && !fullPayload && loadingFullStats && (
                  <div
                    style={{
                      marginBottom: 14,
                      color: "var(--text-muted)",
                      fontSize: 14,
                    }}
                  >
                    Carregando histórico de #1…
                  </div>
                )}
                <NumberOnesTab
                  rows={numberOnesRows.slice(
                    (statsPage - 1) * STATS_PER_PAGE,
                    statsPage * STATS_PER_PAGE,
                  )}
                  totalSongs={numberOnesRows.length}
                  totalPeriods={totalNumberOneWeeks}
                  periodSuffix={statsLabels.tenureSuffix}
                  isMobile={isMobile}
                />
                <StatsPagination
                  page={statsPage}
                  total={numberOnesRows.length}
                  perPage={STATS_PER_PAGE}
                  onChange={setStatsPage}
                />
              </>
            )}

            {paradaTab === "artists" && hasCharts && (
              <>
                {source === "db" && !fullPayload && loadingFullStats && (
                  <div
                    style={{
                      marginBottom: 14,
                      color: "var(--text-muted)",
                      fontSize: 14,
                    }}
                  >
                    Carregando estatísticas completas…
                  </div>
                )}
                <ArtistStatsTable
                  rows={artistRowsForTab.slice(
                    (statsPage - 1) * STATS_PER_PAGE,
                    statsPage * STATS_PER_PAGE,
                  )}
                  artistImages={artistImages}
                  tenureLabel={statsLabels.tenureShort}
                  isMobile={isMobile}
                />
                <StatsPagination
                  page={statsPage}
                  total={artistRowsForTab.length}
                  perPage={STATS_PER_PAGE}
                  onChange={setStatsPage}
                />
              </>
            )}
            {paradaTab === "songs" && hasCharts && (
              <>
                {source === "db" && !fullPayload && loadingFullStats && (
                  <div
                    style={{
                      marginBottom: 14,
                      color: "var(--text-muted)",
                      fontSize: 14,
                    }}
                  >
                    Carregando estatísticas completas…
                  </div>
                )}
                <SongStatsTable
                  rows={songRowsForTab.slice(
                    (statsPage - 1) * STATS_PER_PAGE,
                    statsPage * STATS_PER_PAGE,
                  )}
                  tenureLabel={statsLabels.tenureShort}
                  isMobile={isMobile}
                />
                <StatsPagination
                  page={statsPage}
                  total={songRowsForTab.length}
                  perPage={STATS_PER_PAGE}
                  onChange={setStatsPage}
                />
              </>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}

function YearChips({
  years,
  value,
  onChange,
  showAll = true,
  allLabel = "Todos",
}: {
  years: number[];
  value: number | null;
  onChange: (year: number | null) => void;
  showAll?: boolean;
  allLabel?: string;
}) {
  if (years.length === 0) return null;

  const chip = (label: string, year: number | null, active: boolean) => (
    <button
      key={label}
      type="button"
      onClick={() => onChange(year)}
      style={{
        padding: "7px 14px",
        borderRadius: 100,
        border: "none",
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        background: active ? "var(--surface)" : "transparent",
        color: active ? "var(--text)" : "var(--text-muted)",
        cursor: "pointer",
        boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        flexWrap: "nowrap",
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        background: "var(--fill-subtle)",
        borderRadius: 100,
        padding: 3,
        maxWidth: "100%",
      }}
    >
      {showAll && chip(allLabel, null, value === null)}
      {years.map((y) => chip(String(y), y, value === y))}
    </div>
  );
}

function StatsPagination({
  page,
  total,
  perPage,
  onChange,
}: {
  page: number;
  total: number;
  perPage: number;
  onChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;
  return (
    <PaginationBar page={page} totalPages={totalPages} onChange={onChange} />
  );
}

function buildPageItems(
  currentPage: number,
  totalPages: number,
): Array<number | "..."> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [
      1,
      "...",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }
  return [
    1,
    "...",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "...",
    totalPages,
  ];
}

function PaginationBar({
  page,
  totalPages,
  onChange,
  loading = false,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
  loading?: boolean;
}) {
  if (totalPages <= 1) return null;
  const items = buildPageItems(page, totalPages);
  const buttonStyle = {
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid var(--divider-strong)",
    background: "var(--surface)",
    fontSize: 13,
    fontWeight: 600,
  } as const;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        marginTop: 20,
        flexWrap: "wrap",
      }}
    >
      <button
        type="button"
        disabled={page === 1 || loading}
        onClick={() => onChange(1)}
        style={{
          ...buttonStyle,
          cursor: page === 1 || loading ? "not-allowed" : "pointer",
          opacity: page === 1 || loading ? 0.4 : 1,
        }}
      >
        « Primeiro
      </button>
      <button
        type="button"
        disabled={page === 1 || loading}
        onClick={() => onChange(page - 1)}
        style={{
          ...buttonStyle,
          cursor: page === 1 || loading ? "not-allowed" : "pointer",
          opacity: page === 1 || loading ? 0.4 : 1,
        }}
      >
        ←
      </button>
      {items.map((item, idx) =>
        item === "..." ? (
          <span
            key={`ellipsis-${idx}`}
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              padding: "0 2px",
            }}
          >
            ...
          </span>
        ) : (
          <button
            key={item}
            type="button"
            disabled={loading}
            onClick={() => onChange(item)}
            style={{
              ...buttonStyle,
              minWidth: 36,
              padding: "8px 10px",
              borderColor: item === page ? "#FA243C" : "var(--divider-strong)",
              color: item === page ? "#FA243C" : "var(--text)",
              background:
                item === page ? "var(--accent-tint)" : "var(--surface)",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {item}
          </button>
        ),
      )}
      <span
        style={{ fontSize: 13, color: "var(--text-muted)", padding: "0 8px" }}
      >
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page === totalPages || loading}
        onClick={() => onChange(page + 1)}
        style={{
          ...buttonStyle,
          cursor: page === totalPages || loading ? "not-allowed" : "pointer",
          opacity: page === totalPages || loading ? 0.4 : 1,
        }}
      >
        →
      </button>
      <button
        type="button"
        disabled={page === totalPages || loading}
        onClick={() => onChange(totalPages)}
        style={{
          ...buttonStyle,
          cursor: page === totalPages || loading ? "not-allowed" : "pointer",
          opacity: page === totalPages || loading ? 0.4 : 1,
        }}
      >
        Última »
      </button>
    </div>
  );
}

function NumberOnesCell({
  value,
  fontSize = 13,
}: {
  value: number;
  fontSize?: number;
}) {
  return (
    <div
      style={{
        fontSize,
        fontWeight: value > 0 ? 700 : 400,
        fontVariantNumeric: "tabular-nums",
        color: value > 0 ? "var(--text)" : "var(--text-disabled)",
      }}
    >
      {value > 0 ? `${value}x` : "—"}
    </div>
  );
}

function ArtistStatsTable({
  rows,
  artistImages,
  tenureLabel = "Sem.",
  isMobile,
}: {
  rows: ArtistTableRow[];
  artistImages: Record<string, string | null>;
  tenureLabel?: string;
  isMobile?: boolean;
}) {
  const cols = isMobile
    ? "36px 48px minmax(0,1fr) 72px"
    : "60px 64px minmax(0,1fr) 80px 70px 60px 80px 110px";
  const headers = isMobile
    ? ["Pos", "", "Artista", "Pts"]
    : ["Pos", "", "Artista", tenureLabel, "Pico", "#1s", "Músicas", "Pontos"];
  const imgSize = isMobile ? 36 : 44;
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: 18,
        border: "1px solid var(--divider)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: cols,
          columnGap: 12,
          padding: isMobile ? "8px 16px" : "10px 20px",
          background: "var(--fill-inset)",
          borderBottom: "1px solid var(--divider)",
        }}
      >
        {headers.map((h, i) => (
          <div
            key={i}
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              padding: "6px 0",
            }}
          >
            {h}
          </div>
        ))}
      </div>
      {rows.map((r) => {
        const artistHref = buildArtistPath(
          r.name,
          r.artistSpotifyId,
          r.artistRefId,
        );
        return (
          <div
            key={r.name}
            style={{
              display: "grid",
              gridTemplateColumns: cols,
              alignItems: "center",
              columnGap: 12,
              padding: isMobile ? "10px 16px" : "12px 20px",
              borderBottom: "1px solid var(--divider-soft)",
            }}
          >
            <div
              style={{
                fontSize: isMobile ? 16 : 20,
                fontWeight: 700,
                textAlign: "right",
                paddingRight: isMobile ? 4 : 6,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {r.position}
            </div>
            <Link
              href={artistHref}
              prefetch={false}
              style={{ paddingTop: 4, paddingBottom: 4, lineHeight: 0 }}
            >
              {artistImages[r.name] ? (
                <img
                  src={artistImages[r.name] as string}
                  alt={r.name}
                  width={imgSize}
                  height={imgSize}
                  style={{
                    width: imgSize,
                    height: imgSize,
                    borderRadius: "50%",
                    objectFit: "cover",
                    display: "block",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: imgSize,
                    height: imgSize,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${colorForArtist(r.name)[0]}, ${colorForArtist(r.name)[1]})`,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                  }}
                />
              )}
            </Link>
            <Link
              href={artistHref}
              prefetch={false}
              style={{
                fontSize: isMobile ? 13 : 14,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "var(--text)",
                textDecoration: "none",
              }}
            >
              {r.name}
            </Link>
            {!isMobile && (
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {r.weeks}
              </div>
            )}
            {!isMobile && (
              <div style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                {r.peak}
              </div>
            )}
            {!isMobile && <NumberOnesCell value={r.numberOnes} />}
            {!isMobile && (
              <div style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                {r.songCount}
              </div>
            )}
            <div
              style={{
                fontSize: isMobile ? 13 : 15,
                fontWeight: 700,
                color: "#FA243C",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {r.totalPoints}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NumberOnesTab({
  rows,
  totalSongs,
  totalPeriods,
  periodSuffix,
  isMobile,
}: {
  rows: NumberOneRow[];
  totalSongs: number;
  totalPeriods: number;
  periodSuffix: string;
  isMobile?: boolean;
}) {
  if (totalSongs === 0) {
    return (
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 18,
          border: "1px solid var(--divider)",
          padding: 40,
          textAlign: "center",
        }}
      >
        <Trophy
          size={36}
          color="#FFD700"
          fill="#FFD700"
          style={{ marginBottom: 12 }}
        />
        <p style={{ fontSize: 15, color: "var(--text-muted)", margin: 0 }}>
          Nenhuma música chegou ao #1 nesta parada ainda.
        </p>
      </div>
    );
  }

  const cols = isMobile
    ? "44px minmax(0,1fr) 56px"
    : "64px minmax(0,1fr) 88px 140px 120px";
  const headers = isMobile
    ? ["", "Música", "#1s"]
    : ["", "Música", "#1s", "Último #1", "Primeiro #1"];
  const coverSize = isMobile ? 44 : 56;

  return (
    <div>
      <div
        style={{ marginBottom: 16, fontSize: 14, color: "var(--text-muted)" }}
      >
        <span style={{ fontWeight: 700, color: "var(--text)" }}>
          {totalSongs}
        </span>{" "}
        faixa{totalSongs === 1 ? "" : "s"} ·{" "}
        <span style={{ fontWeight: 700, color: "var(--text)" }}>
          {totalPeriods}
        </span>{" "}
        {periodSuffix} em #1
      </div>
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 18,
          border: "1px solid var(--divider)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: cols,
            columnGap: 12,
            padding: isMobile ? "8px 16px" : "10px 20px",
            background: "var(--fill-inset)",
            borderBottom: "1px solid var(--divider)",
          }}
        >
          {headers.map((h, i) => (
            <div
              key={i}
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                padding: "6px 8px",
              }}
            >
              {h}
            </div>
          ))}
        </div>
        {rows.map((r) => {
          const songHref = buildSongPath({
            title: r.title,
            artist: r.artist,
            id: r.songId,
            artistId: r.artistRefId,
            slugArtist: r.slugArtist,
            spotifyId: r.spotifyId,
          });
          const artistHref = buildArtistPath(
            r.artist,
            r.artistSpotifyId,
            r.artistRefId,
          );
          return (
            <div
              key={`${r.title}-${r.artist}`}
              style={{
                display: "grid",
                gridTemplateColumns: cols,
                alignItems: "center",
                columnGap: 12,
                padding: isMobile ? "10px 16px" : "12px 20px",
                borderBottom: "1px solid var(--divider-soft)",
              }}
            >
              <Link
                href={songHref}
                prefetch={false}
                style={{
                  paddingTop: isMobile ? 2 : 4,
                  paddingBottom: isMobile ? 2 : 4,
                  lineHeight: 0,
                }}
              >
                <Cover
                  cover={r.cover}
                  song={{ title: r.title, artist: r.artist, album: "" }}
                  size={coverSize}
                  rounded={isMobile ? 8 : 10}
                />
              </Link>
              <div style={{ minWidth: 0 }}>
                <Link
                  href={songHref}
                  prefetch={false}
                  style={{
                    display: "block",
                    fontSize: isMobile ? 14 : 15,
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: "var(--text)",
                    textDecoration: "none",
                  }}
                >
                  {r.title}
                </Link>
                <Link
                  href={artistHref}
                  prefetch={false}
                  style={{
                    display: "block",
                    fontSize: 12,
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textDecoration: "none",
                  }}
                >
                  {formatSongArtist({ artist: r.artist })}
                </Link>
                {isMobile && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      marginTop: 2,
                    }}
                  >
                    {r.lastDateRange || r.lastWeekLabel}
                  </div>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: isMobile ? "flex-end" : "flex-start",
                  gap: 4,
                }}
              >
                <Trophy
                  size={isMobile ? 14 : 16}
                  color="#FFD700"
                  fill="#FFD700"
                />
                <span
                  style={{
                    fontSize: isMobile ? 15 : 17,
                    fontWeight: 800,
                    fontVariantNumeric: "tabular-nums",
                    color: "var(--text)",
                  }}
                >
                  {r.count}x
                </span>
              </div>
              {!isMobile && (
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    lineHeight: 1.35,
                  }}
                >
                  <div>{r.lastDateRange || r.lastWeekLabel}</div>
                </div>
              )}
              {!isMobile && (
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    lineHeight: 1.35,
                  }}
                >
                  {r.firstDateRange}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SongStatsTable({
  rows,
  tenureLabel = "Sem.",
  isMobile,
}: {
  rows: SongTableRow[];
  tenureLabel?: string;
  isMobile?: boolean;
}) {
  const cols = isMobile
    ? "36px 44px minmax(0,1fr) 72px"
    : "60px 64px minmax(0,1fr) 80px 70px 60px 110px";
  const headers = isMobile
    ? ["Pos", "", "Música", "Pts"]
    : ["Pos", "", "Música", tenureLabel, "Pico", "#1s", "Pontos"];
  const coverSize = isMobile ? 36 : 48;
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: 18,
        border: "1px solid var(--divider)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: cols,
          columnGap: 12,
          padding: isMobile ? "8px 16px" : "10px 20px",
          background: "var(--fill-inset)",
          borderBottom: "1px solid var(--divider)",
        }}
      >
        {headers.map((h, i) => (
          <div
            key={i}
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              padding: "6px 0",
            }}
          >
            {h}
          </div>
        ))}
      </div>
      {rows.map((r) => {
        const songHref = buildSongPath({
          title: r.title,
          artist: r.artist,
          id: r.songId,
          artistId: r.artistRefId,
          slugArtist: r.slugArtist,
          spotifyId: r.spotifyId,
        });
        const artistHref = buildArtistPath(
          r.artist,
          r.artistSpotifyId,
          r.artistRefId,
        );
        return (
          <div
            key={`${r.title}-${r.artist}`}
            style={{
              display: "grid",
              gridTemplateColumns: cols,
              alignItems: "center",
              columnGap: 12,
              padding: isMobile ? "10px 16px" : "12px 20px",
              borderBottom: "1px solid var(--divider-soft)",
            }}
          >
            <div
              style={{
                fontSize: isMobile ? 16 : 20,
                fontWeight: 700,
                textAlign: "right",
                paddingRight: isMobile ? 4 : 6,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {r.position}
            </div>
            <Link
              href={songHref}
              prefetch={false}
              style={{ paddingTop: 4, paddingBottom: 4, lineHeight: 0 }}
            >
              <Cover
                cover={r.cover}
                song={{ title: r.title, artist: r.artist, album: "" }}
                size={coverSize}
                rounded={isMobile ? 6 : 8}
              />
            </Link>
            <div style={{ minWidth: 0 }}>
              <Link
                href={songHref}
                prefetch={false}
                style={{
                  display: "block",
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "var(--text)",
                  textDecoration: "none",
                }}
              >
                {r.title}
              </Link>
              <Link
                href={artistHref}
                prefetch={false}
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "var(--text-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textDecoration: "none",
                }}
              >
                {formatSongArtist({ artist: r.artist })}
              </Link>
            </div>
            {!isMobile && (
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {r.weeks}
              </div>
            )}
            {!isMobile && (
              <div style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                {r.peak}
              </div>
            )}
            {!isMobile && <NumberOnesCell value={r.numberOnes} />}
            <div
              style={{
                fontSize: isMobile ? 13 : 15,
                fontWeight: 700,
                color: "#FA243C",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {r.totalPoints}
            </div>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Repeat2,
  Copy,
  Play,
  Star,
  MessageCircle,
  Trash2,
} from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { useTranslations } from "@/hooks/useTranslations";
import { AdSlot } from "@/components/ui/AdSlot";
import { ADSENSE_SLOTS } from "@/lib/adsense-slots";
import { Avatar } from "@/components/ui/Avatar";
import { Cover } from "@/components/ui/Cover";
import { VideoClipCover } from "@/components/ui/VideoClipCover";
import { MovementBadge } from "@/components/ui/MovementBadge";
import {
  chartStatsLabelsI18n,
  isDailyChartIndex,
  type ChartStatsLabels,
} from "@/lib/chart-cadence";
import { formatChartPeriod, safeHeaderBg } from "@/lib/chart-week";
import { buildChartCopyText } from "@/lib/chart-copy-text";
import { formatSongArtist } from "@/lib/song-artist";
import { timeAgo } from "@/lib/time-ago";
import {
  buildAlbumPath,
  buildArtistPath,
  buildSongPath,
} from "@/lib/music-routes";
import { lookupNumberOnes } from "@/lib/song-stats-key";
import {
  DESKTOP_COVER_SIZE,
  MOBILE_ARTIST_SIZE,
  MOBILE_COVER_SIZE,
  MOBILE_POS_WIDTH,
  MOBILE_ROW_GAP,
  MOBILE_STATS_INDENT,
  MOBILE_TITLE_SIZE,
  desktopCoverGridColumn,
  desktopListGrid,
  desktopPosCol,
} from "@/lib/chart-list-layout";
import { DesktopPosCell } from "@/components/chart/DesktopPosCell";
import type { ChartDetailPayload } from "@/lib/map-db-profile";
import { ChartSpotlightCard } from "@/components/chart/ChartSpotlightCard";
import { ParadaCommentsToggle } from "@/components/parada/ParadaComments";
import { canUseSpotifyFeatures } from "@/lib/mytrl-access";
import { TIMELINE } from "@/lib/data";
import type {
  ChartEntry,
  PersonalDropoutEntry,
  TimelineItem,
  User,
} from "@/lib/types";

type Variant = "list" | "grid" | "podium" | "video_clip";
type VideoClipLayout = "table" | "stacked";
type Tab = "chart" | "overlap" | "saidas";

const VIDEO_CLIP_LAYOUT_KEY = "chartify-video-clip-layout";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

type ParadaNomeResponse = { paradaNome?: string | null };

type ChartDetailExtended = ChartDetailPayload & {
  liked?: boolean;
  reposted?: boolean;
};

export type CommentRow = {
  id: string;
  text: string;
  likes: number;
  liked?: boolean;
  reactions: string[];
  replyCount: number;
  createdAt: string;
  user: {
    id: string;
    handle: string;
    name: string;
    avatarColor: string;
    image: string | null;
  };
};

type CommentReplyRow = {
  id: string;
  text: string;
  likes: number;
  createdAt: string;
  user: {
    id: string;
    handle: string;
    name: string;
    avatarColor: string;
    image: string | null;
  };
};

type OverlapRow = {
  userId: string;
  chartId: string;
  overlapPercent: number;
  commonSongs: number;
  totalSongs: number;
  user: {
    id: string;
    handle: string;
    name: string;
    avatarColor: string;
    image: string | null;
  };
};

export default function ChartDetailPage() {
  const { t, locale } = useTranslations();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = params?.id;
  const id = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";

  const { data: session } = useSession();
  const [phase, setPhase] = useState<"loading" | "ready" | "missing" | "error">(
    "loading",
  );
  const [dbPayload, setDbPayload] = useState<ChartDetailExtended | null>(null);
  const [mockItem, setMockItem] = useState<TimelineItem | null>(null);
  const [ownerParadaNome, setOwnerParadaNome] = useState<string | null>(null);

  const [variant, setVariant] = useState<Variant>("list");
  const [videoClipLayout, setVideoClipLayout] =
    useState<VideoClipLayout>("table");
  const rawInitialTab = searchParams?.get("tab") ?? null;
  const initialTab: Tab = rawInitialTab === "overlap" || rawInitialTab === "saidas" ? rawInitialTab : "chart";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [commentsOpen, setCommentsOpen] = useState(rawInitialTab === "comments");
  const [videoClips, setVideoClips] = useState<Record<string, string>>({});
  const [loadingClips, setLoadingClips] = useState(false);

  const [liked, setLiked] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [repostCount, setRepostCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [deletingChart, setDeletingChart] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [exportingSpotify, setExportingSpotify] = useState(false);
  const [spotifyExportMsg, setSpotifyExportMsg] = useState<string | null>(null);
  const [spotifyExportTone, setSpotifyExportTone] = useState<
    "success" | "error" | null
  >(null);
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [spotifyPlaylistPublic, setSpotifyPlaylistPublic] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    try {
      setSpotifyPlaylistPublic(
        localStorage.getItem("chartfm.spotifyPlaylistPublic") === "1",
      );
    } catch {
      /* ignore */
    }
  }, []);

  function toggleSpotifyPlaylistPublic(checked: boolean) {
    setSpotifyPlaylistPublic(checked);
    try {
      localStorage.setItem("chartfm.spotifyPlaylistPublic", checked ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIDEO_CLIP_LAYOUT_KEY);
      if (saved === "table" || saved === "stacked") setVideoClipLayout(saved);
    } catch {
      /* ignore */
    }
  }, []);

  function selectVideoClipLayout(layout: VideoClipLayout) {
    setVideoClipLayout(layout);
    try {
      localStorage.setItem(VIDEO_CLIP_LAYOUT_KEY, layout);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!id) {
      setPhase("missing");
      return;
    }
    let cancelled = false;
    setPhase("loading");
    setDbPayload(null);
    setMockItem(null);
    (async () => {
      try {
        const res = await fetch(`/api/charts/${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as ChartDetailExtended;
          if (!data?.chart?.id || !data?.user?.id) {
            setDbPayload(null);
            setMockItem(null);
            setPhase("missing");
            return;
          }
          setDbPayload(data);
          setLiked(data.liked ?? false);
          setReposted(data.reposted ?? false);
          setLikeCount(data.chart.likes);
          setRepostCount(data.chart.reposts);
          setCommentCount(data.chart.comments);
          setMockItem(null);
          setPhase("ready");
          return;
        }
        if (res.status >= 500) {
          setDbPayload(null);
          setMockItem(null);
          setPhase("error");
          return;
        }
        const item = TIMELINE.find((t) => t.chart.id === id) ?? null;
        setDbPayload(null);
        setMockItem(item);
        if (item) {
          setLikeCount(item.chart.likes);
          setRepostCount(item.chart.reposts);
          setCommentCount(item.chart.comments);
        }
        setPhase(item ? "ready" : "missing");
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const user = dbPayload?.user ?? mockItem?.user;
  const chart = dbPayload?.chart ?? mockItem?.chart;
  const ownerImageUrl = dbPayload?.imageUrl ?? null;
  const ownerParadaLogo = dbPayload?.paradaLogo ?? null;
  const personalNumberOnes = dbPayload?.personalNumberOnes ?? {};
  const globalNumberOnes = dbPayload?.globalNumberOnes ?? {};
  const dropouts: PersonalDropoutEntry[] = dbPayload?.dropouts ?? [];
  const flashback = dbPayload?.flashback ?? null;
  const destaque = dbPayload?.destaque ?? null;
  const hasSpotlights = Boolean(flashback || destaque);
  const isDbChart = !!dbPayload;
  const previousChart = dbPayload?.previousChart ?? null;
  const nextChart = dbPayload?.nextChart ?? null;
  const hasParadaNav = !!(previousChart || nextChart);
  const isOwner =
    !!session?.user?.id && !!user?.id && session.user.id === user.id;
  const canUseSpotifyImport = canUseSpotifyFeatures(session?.user?.handle);

  useEffect(() => {
    if (!user?.handle) return;
    let cancelled = false;
    const profileHandle = user.handle;
    (async () => {
      try {
        const res = await fetch(
          `/api/profile/${encodeURIComponent(profileHandle)}`,
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as ParadaNomeResponse;
        const nome =
          typeof data.paradaNome === "string" && data.paradaNome.trim()
            ? data.paradaNome.trim()
            : null;
        if (!cancelled) setOwnerParadaNome(nome);
      } catch {
        if (!cancelled) setOwnerParadaNome(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.handle]);

  useEffect(() => {
    if (variant !== "video_clip" || !id || !isDbChart) return;
    let cancelled = false;
    setLoadingClips(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/charts/${encodeURIComponent(id)}/video-clips`,
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as Record<string, string>;
        if (!cancelled) setVideoClips(data);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingClips(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [variant, id, isDbChart]);

  useEffect(() => {
    if (!session?.user?.id || !canUseSpotifyImport) {
      setSpotifyConnected(false);
      return;
    }
    fetch("/api/user/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { spotifyConnected?: boolean } | null) => {
        setSpotifyConnected(data?.spotifyConnected ?? false);
      })
      .catch(() => setSpotifyConnected(false));
  }, [session?.user?.id, canUseSpotifyImport]);

  useEffect(() => {
    if (!canUseSpotifyImport) return;
    const status = searchParams?.get("spotify");
    if (status === "connected") {
      setSpotifyConnected(true);
      setSpotifyExportMsg(
        t("chart.spotifyConnected"),
      );
      setSpotifyExportTone("success");
      window.history.replaceState({}, "", `/chart/${id}`);
    }
  }, [searchParams, id, canUseSpotifyImport, t]);

  const goToPreviousChart = useCallback(() => {
    if (previousChart?.id) router.push(`/chart/${previousChart.id}`);
  }, [previousChart?.id, router]);

  const goToNextChart = useCallback(() => {
    if (nextChart?.id) router.push(`/chart/${nextChart.id}`);
  }, [nextChart?.id, router]);

  useEffect(() => {
    if (phase !== "ready" || !hasParadaNav) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.key === "ArrowLeft" && previousChart) {
        e.preventDefault();
        goToPreviousChart();
      } else if (e.key === "ArrowRight" && nextChart) {
        e.preventDefault();
        goToNextChart();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    phase,
    hasParadaNav,
    previousChart,
    nextChart,
    goToPreviousChart,
    goToNextChart,
  ]);

  async function exportChartToSpotify() {
    if (!id || !isDbChart || !isOwner || exportingSpotify) return;
    if (!session?.user?.id) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/chart/${id}`)}`);
      return;
    }
    if (!spotifyConnected) {
      window.location.href = `/api/spotify/connect?from=${encodeURIComponent(`/chart/${id}`)}`;
      return;
    }

    setExportingSpotify(true);
    setSpotifyExportMsg(null);
    setSpotifyExportTone(null);
    try {
      const res = await fetch("/api/spotify/playlist-from-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chartId: id, isPublic: spotifyPlaylistPublic }),
      });
      const data = (await res.json()) as {
        playlistUrl?: string;
        trackCount?: number;
        skippedCount?: number;
        error?: string;
        needsReconnect?: boolean;
      };
      if (!res.ok) {
        if (data.needsReconnect) setSpotifyConnected(false);
        setSpotifyExportMsg(
          data.error ?? t("chart.spotifyCreateError"),
        );
        setSpotifyExportTone("error");
        return;
      }
      const skipped =
        typeof data.skippedCount === "number" && data.skippedCount > 0
          ? t("chart.spotifySkippedSuffix", { count: data.skippedCount })
          : "";
      setSpotifyExportMsg(
        t("chart.spotifyPlaylistCreated", {
          count: data.trackCount ?? 0,
          skipped,
        }),
      );
      setSpotifyExportTone("success");
      if (data.playlistUrl)
        window.open(data.playlistUrl, "_blank", "noopener,noreferrer");
    } catch {
      setSpotifyExportMsg(t("chart.spotifyConnectionError"));
      setSpotifyExportTone("error");
    } finally {
      setExportingSpotify(false);
    }
  }

  const spotifyExportButton =
    isOwner && isDbChart && canUseSpotifyImport ? (
      <>
        <button
          type="button"
          onClick={exportChartToSpotify}
          disabled={exportingSpotify}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#1DB954",
            color: "white",
            border: "none",
            padding: isMobile ? "10px 16px" : "10px 20px",
            borderRadius: 100,
            fontSize: isMobile ? 13 : 14,
            fontWeight: 700,
            boxShadow: "0 2px 8px rgba(30,215,96,0.35)",
            cursor: exportingSpotify ? "not-allowed" : "pointer",
            opacity: exportingSpotify ? 0.7 : 1,
          }}
        >
          <Play size={isMobile ? 13 : 14} fill="white" />
          {exportingSpotify
            ? t("chart.spotifyCreating")
            : spotifyConnected
              ? t("chart.spotifySave")
              : t("chart.spotifyConnect")}
        </button>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: isMobile ? 12 : 13,
            color: "var(--text-muted)",
            cursor: exportingSpotify ? "not-allowed" : "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={spotifyPlaylistPublic}
            disabled={exportingSpotify}
            onChange={(e) => toggleSpotifyPlaylistPublic(e.target.checked)}
          />
          {t("chart.spotifyPublic")}
        </label>
      </>
    ) : null;

  const composeUser = useMemo((): Pick<User, "name" | "avatar"> => {
    if (session?.user?.name) {
      return { name: session.user.name, avatar: "#FA243C" };
    }
    if (user) return { name: user.name, avatar: user.avatar };
    return { name: t("chart.guest"), avatar: "#86868B" };
  }, [session?.user?.name, user, t]);

  const composeImageUrl = session?.user?.image ?? null;
  const tituloDetalheParada = t("chart.titleTop", {
    name: ownerParadaNome ?? t("chart.title"),
    count: chart?.entries.length ?? 0,
  });

  async function toggleLike() {
    if (!id || !isDbChart) return;
    const prev = liked;
    setLiked(!prev);
    setLikeCount((c) => c + (prev ? -1 : 1));
    const res = await fetch(`/api/charts/${id}/like`, { method: "POST" });
    if (!res.ok) {
      setLiked(prev);
      setLikeCount((c) => c + (prev ? 1 : -1));
    }
  }

  async function toggleRepost() {
    if (!id || !isDbChart) return;
    const prev = reposted;
    setReposted(!prev);
    setRepostCount((c) => c + (prev ? -1 : 1));
    const res = await fetch(`/api/charts/${id}/repost`, { method: "POST" });
    if (!res.ok) {
      setReposted(prev);
      setRepostCount((c) => c + (prev ? 1 : -1));
    }
  }

  async function deleteChart() {
    if (!isDbChart || !isOwner || deletingChart || !id) return;
    setDeleteError(null);
    setDeletingChart(true);
    try {
      const res = await fetch(`/api/charts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setDeleteError(t("chart.deleteError"));
        return;
      }
      router.push(`/profile/${encodeURIComponent(user?.handle ?? "")}`);
    } catch {
      setDeleteError(t("chart.deleteConnectionError"));
    } finally {
      setDeletingChart(false);
    }
  }

  if (phase === "loading") {
    return (
      <Shell title="" noPadding>
        <div style={{ padding: 48, color: "var(--text-muted)", fontSize: 15 }}>
          {t("chart.loading")}
        </div>
      </Shell>
    );
  }

  if (phase === "error") {
    return (
      <Shell title={t("chart.title")} subtitle={t("chart.loadError")}>
        <div
          style={{
            maxWidth: 480,
            margin: "48px auto",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          <p style={{ fontSize: 16, marginBottom: 20 }}>
            {t("chart.loadErrorMessage")}
          </p>
          <Link
            href="/"
            style={{
              color: "var(--accent)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {t("chart.backHome")}
          </Link>
        </div>
      </Shell>
    );
  }

  if (phase === "missing" || !chart || !user) {
    return (
      <Shell title={t("chart.title")} subtitle={t("chart.notFound")}>
        <div
          style={{
            maxWidth: 480,
            margin: "48px auto",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          <p style={{ fontSize: 16, marginBottom: 20 }}>
            {t("chart.notFoundMessage")}
          </p>
          <Link
            href="/"
            style={{
              color: "var(--accent)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {t("chart.backHome")}
          </Link>
        </div>
      </Shell>
    );
  }

  const isDailyParada = isDailyChartIndex(chart.week);
  const statsLabels = chartStatsLabelsI18n(t, isDailyParada);

  async function copyChart() {
    if (!chart) return;
    const text = buildChartCopyText({
      entries: chart.entries,
      dropouts,
      personalNumberOnes,
      isDaily: isDailyParada,
      locale,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("success");
      window.setTimeout(() => setCopyState("idle"), 2500);
    } catch {
      setCopyState("error");
    }
  }

  function chartVariantLabel(v: Variant, mobile: boolean): string {
    if (v === "list") return t("chart.variantList");
    if (v === "grid") return t("chart.variantGrid");
    if (v === "podium") return t("chart.variantPodium");
    return mobile ? t("chart.variantClip") : t("chart.variantVideoClip");
  }

  return (
    <Shell title="" noPadding>
      <div>
        {/* Hero */}
        <div
          style={{
            background: safeHeaderBg(user.avatar),
            padding: isMobile ? "24px 16px 16px 16px" : "48px 40px 24px 40px",
          }}
        >
          <Link
            href={`/profile/${encodeURIComponent(user.handle)}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "var(--text-muted)",
              fontSize: 14,
              fontWeight: 500,
              textDecoration: "none",
              marginBottom: isMobile ? 16 : 24,
            }}
          >
            <ChevronLeft size={16} />
            {t("chart.backToProfile")}
          </Link>

          {isMobile ? (
            /* ── MOBILE HERO ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {/* Mosaic + title side-by-side */}
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                {ownerParadaLogo ? (
                  <div
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: 14,
                      overflow: "hidden",
                      flexShrink: 0,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                    }}
                  >
                    <img
                      src={ownerParadaLogo}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 3,
                      width: 88,
                      height: 88,
                      borderRadius: 14,
                      overflow: "hidden",
                      flexShrink: 0,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                    }}
                  >
                    {chart.entries.slice(0, 4).map((e, i) => (
                      <Cover
                        key={i}
                        cover={e.cover}
                        song={e.song}
                        size={43}
                        rounded={0}
                      />
                    ))}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      letterSpacing: "-0.03em",
                      lineHeight: 1.2,
                      marginBottom: 4,
                    }}
                  >
                    {tituloDetalheParada}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {formatChartPeriod(chart)}
                  </div>
                </div>
              </div>

              {/* User info */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                <Avatar
                  user={user}
                  imageUrl={ownerImageUrl ?? undefined}
                  size={24}
                />
                <Link
                  href={`/profile/${user.handle}`}
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text)",
                    textDecoration: "none",
                  }}
                >
                  {user.name}
                </Link>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  @{user.handle}
                </span>
              </div>

              {/* Edit / delete */}
              {isOwner && (
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <Link
                    href={`/chart/${chart.id}/edit`}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text)",
                      textDecoration: "none",
                      border: "1px solid var(--divider-strong)",
                      borderRadius: 10,
                      padding: "9px 0",
                      display: "block",
                    }}
                  >
                    {t("chart.editChart")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setShowDeleteModal(true);
                    }}
                    disabled={deletingChart}
                    style={{
                      flex: 1,
                      border: "1px solid rgba(250,36,60,0.25)",
                      background: "rgba(250,36,60,0.08)",
                      color: "var(--accent)",
                      borderRadius: 10,
                      padding: "9px 0",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: deletingChart ? "not-allowed" : "pointer",
                      opacity: deletingChart ? 0.6 : 1,
                    }}
                  >
                    {t("chart.deleteShort")}
                  </button>
                </div>
              )}

              {/* Action buttons */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 10,
                  flexWrap: "wrap",
                }}
              >
                {spotifyExportButton}
                <button
                  onClick={toggleLike}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: liked
                      ? "var(--accent-tint)"
                      : "var(--fill-subtle)",
                    color: liked ? "var(--accent)" : "var(--text-subtle)",
                    border: "none",
                    padding: "10px 14px",
                    borderRadius: 100,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: isDbChart ? "pointer" : "default",
                  }}
                >
                  <Heart size={15} fill={liked ? "currentColor" : "none"} />
                  {liked ? t("chart.liked") : t("chart.like")}
                </button>
                <button
                  onClick={toggleRepost}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: reposted
                      ? "var(--fill-subtle)"
                      : "var(--fill-subtle)",
                    color: reposted ? "var(--text)" : "var(--text-subtle)",
                    border: "none",
                    padding: "10px 14px",
                    borderRadius: 100,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: isDbChart ? "pointer" : "default",
                  }}
                >
                  <Repeat2 size={15} />
                  {reposted ? t("chart.reposted") : t("chart.repost")}
                </button>
                <button
                  type="button"
                  onClick={copyChart}
                  style={{
                    background: "var(--fill-subtle)",
                    border: "none",
                    padding: "10px 14px",
                    borderRadius: 100,
                    color: "var(--text-subtle)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Copy size={15} />
                  {t("chart.copy")}
                </button>
              </div>
              {(spotifyExportMsg || copyState !== "idle") && (
                <div
                  style={{
                    fontSize: 12,
                    color:
                      copyState === "success" || spotifyExportTone === "success"
                        ? "#15803D"
                        : "#B91C1C",
                    marginBottom: 10,
                    lineHeight: 1.5,
                  }}
                >
                  {copyState === "success"
                    ? t("chart.copySuccess")
                    : copyState === "error"
                      ? t("chart.copyError")
                      : spotifyExportMsg}
                </div>
              )}

              {/* Variant toggle full-width */}
              <div
                style={{
                  display: "flex",
                  background: "var(--fill-subtle)",
                  borderRadius: 8,
                  padding: 3,
                  gap: 2,
                }}
              >
                {(["list", "grid", "podium", "video_clip"] as Variant[]).map(
                  (v) => (
                    <button
                      key={v}
                      onClick={() => setVariant(v)}
                      style={{
                        flex: 1,
                        padding: "8px 0",
                        borderRadius: 6,
                        border: "none",
                        fontSize: 12,
                        fontWeight: 600,
                        background:
                          variant === v ? "var(--surface)" : "transparent",
                        color:
                          variant === v ? "var(--text)" : "var(--text-muted)",
                        boxShadow:
                          variant === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                        transition: "background 120ms",
                      }}
                    >
                      {chartVariantLabel(v, true)}
                    </button>
                  ),
                )}
              </div>
            </div>
          ) : (
            /* ── DESKTOP HERO ── */
            <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
              {/* Mosaic cover / logo */}
              {ownerParadaLogo ? (
                <div
                  style={{
                    width: 200,
                    height: 200,
                    borderRadius: 18,
                    overflow: "hidden",
                    flexShrink: 0,
                    boxShadow: "0 16px 40px rgba(0,0,0,0.15)",
                  }}
                >
                  <img
                    src={ownerParadaLogo}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 4,
                    width: 200,
                    height: 200,
                    borderRadius: 18,
                    overflow: "hidden",
                    flexShrink: 0,
                    boxShadow: "0 16px 40px rgba(0,0,0,0.15)",
                  }}
                >
                  {chart.entries.slice(0, 4).map((e, i) => (
                    <Cover
                      key={i}
                      cover={e.cover}
                      song={e.song}
                      size={98}
                      rounded={0}
                    />
                  ))}
                </div>
              )}

              {/* Info block */}
              <div style={{ flex: 1, minWidth: 280 }}>
                <div
                  style={{
                    fontSize: 56,
                    fontWeight: 800,
                    letterSpacing: "-0.04em",
                    lineHeight: 1.1,
                    marginBottom: 8,
                  }}
                >
                  {tituloDetalheParada}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: "var(--text-muted)",
                    marginBottom: 12,
                  }}
                >
                  {formatChartPeriod(chart)}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 16,
                  }}
                >
                  <Avatar
                    user={user}
                    imageUrl={ownerImageUrl ?? undefined}
                    size={28}
                  />
                  <Link
                    href={`/profile/${user.handle}`}
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--text)",
                      textDecoration: "none",
                    }}
                  >
                    {user.name}
                  </Link>
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    @{user.handle}
                  </span>
                </div>
                {isOwner && (
                  <div
                    style={{
                      marginBottom: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <Link
                      href={`/chart/${chart.id}/edit`}
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text)",
                        textDecoration: "none",
                        border: "1px solid var(--divider-strong)",
                        borderRadius: 10,
                        padding: "7px 12px",
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                    >
                      {t("chart.editChart")}
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setShowDeleteModal(true);
                      }}
                      disabled={deletingChart}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        border: "1px solid rgba(250,36,60,0.25)",
                        background: "rgba(250,36,60,0.08)",
                        color: "var(--accent)",
                        borderRadius: 10,
                        padding: "7px 12px",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: deletingChart ? "not-allowed" : "pointer",
                        opacity: deletingChart ? 0.6 : 1,
                      }}
                    >
                      {t("chart.deleteChart")}
                    </button>
                  </div>
                )}
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {spotifyExportButton}
                    <button
                      onClick={toggleLike}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: liked
                          ? "var(--accent-tint)"
                          : "var(--fill-subtle)",
                        color: liked ? "var(--accent)" : "var(--text-subtle)",
                        border: "none",
                        padding: "10px 16px",
                        borderRadius: 100,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: isDbChart ? "pointer" : "default",
                      }}
                    >
                      <Heart size={16} fill={liked ? "currentColor" : "none"} />
                      {liked ? t("chart.liked") : t("chart.like")}
                    </button>
                    <button
                      onClick={toggleRepost}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: reposted
                          ? "var(--fill-subtle)"
                          : "var(--fill-subtle)",
                        color: reposted ? "var(--text)" : "var(--text-subtle)",
                        border: "none",
                        padding: "10px 16px",
                        borderRadius: 100,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: isDbChart ? "pointer" : "default",
                      }}
                    >
                      <Repeat2 size={16} />
                      {reposted ? t("chart.reposted") : t("chart.repost")}
                    </button>
                    <button
                      type="button"
                      onClick={copyChart}
                      style={{
                        background: "var(--fill-subtle)",
                        border: "none",
                        padding: "10px 16px",
                        borderRadius: 100,
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--text-subtle)",
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <Copy size={16} />
                      {t("chart.copy")}
                    </button>
                  </div>
                  {(spotifyExportMsg || copyState !== "idle") && (
                    <div
                      style={{
                        fontSize: 13,
                        color:
                          copyState === "success" ||
                          spotifyExportTone === "success"
                            ? "#15803D"
                            : "#B91C1C",
                        lineHeight: 1.5,
                      }}
                    >
                      {copyState === "success"
                        ? t("chart.copySuccess")
                        : copyState === "error"
                          ? t("chart.copyError")
                          : spotifyExportMsg}
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      background: "var(--fill-subtle)",
                      borderRadius: 8,
                      padding: 3,
                      gap: 2,
                      alignSelf: "flex-start",
                    }}
                  >
                    {(
                      ["list", "grid", "podium", "video_clip"] as Variant[]
                    ).map((v) => (
                      <button
                        key={v}
                        onClick={() => setVariant(v)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 6,
                          border: "none",
                          fontSize: 12,
                          fontWeight: 600,
                          background:
                            variant === v ? "var(--surface)" : "transparent",
                          color:
                            variant === v ? "var(--text)" : "var(--text-muted)",
                          boxShadow:
                            variant === v
                              ? "0 1px 3px rgba(0,0,0,0.1)"
                              : "none",
                          transition: "background 120ms",
                        }}
                      >
                        {chartVariantLabel(v, false)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <AdSlot
          slotId={ADSENSE_SLOTS.chart}
          format="leaderboard"
          style={{ margin: "0 0 4px 0" }}
        />

        <div
          style={{
            padding: isMobile ? "0 16px 80px 16px" : "0 40px 80px 40px",
          }}
        >
          {/* Tabs */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              borderBottom: "1px solid var(--divider)",
              marginBottom: 24,
            }}
          >
            <div style={{ display: "flex", gap: 0, overflowX: "auto" }}>
              {(
                [
                  ["chart", t("chart.tabChart")],
                  [
                    "saidas",
                    `${t("chart.tabDropouts")}${dropouts.length > 0 ? ` (${dropouts.length})` : ""}`,
                  ],
                  ["overlap", t("chart.tabCommon")],
                ] as [Tab, string][]
              ).map(([tabKey, label]) => (
                <button
                  key={tabKey}
                  onClick={() => setTab(tabKey)}
                  style={{
                    padding: isMobile ? "12px 14px" : "12px 20px",
                    background: "none",
                    border: "none",
                    fontSize: isMobile ? 14 : 15,
                    fontWeight: tab === tabKey ? 600 : 500,
                    color: tab === tabKey ? "var(--text)" : "var(--text-muted)",
                    borderBottom: `2px solid ${tab === tabKey ? "var(--accent)" : "transparent"}`,
                    marginBottom: -1,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={{ paddingBottom: 8, flexShrink: 0 }}>
              <ParadaCommentsToggle open={commentsOpen} onClick={() => setCommentsOpen((v) => !v)} />
            </div>
          </div>

          {/* Tab content */}
          {tab === "chart" && (
            <>
              {hasSpotlights && isMobile && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    marginBottom: 20,
                  }}
                >
                  {flashback && <ChartSpotlightCard kind="flashback" song={flashback} />}
                  {destaque && <ChartSpotlightCard kind="destaque" song={destaque} />}
                </div>
              )}
              <div
                style={{
                  display: (hasSpotlights || commentsOpen) && !isMobile ? "grid" : "block",
                  gridTemplateColumns: (hasSpotlights || commentsOpen) && !isMobile ? "1fr 320px" : undefined,
                  gap: (hasSpotlights || commentsOpen) && !isMobile ? 24 : undefined,
                  alignItems: "flex-start",
                }}
              >
                <div>
              {variant === "list" && (
                <ClassicList
                  entries={chart.entries}
                  personalNumberOnes={personalNumberOnes}
                  globalNumberOnes={globalNumberOnes}
                  statsLabels={statsLabels}
                />
              )}
              {variant === "grid" && (
                <GridVariant
                  entries={chart.entries}
                  statsLabels={statsLabels}
                />
              )}
              {variant === "podium" && (
                <PodiumVariant
                  entries={chart.entries}
                  statsLabels={statsLabels}
                />
              )}
              {variant === "video_clip" && (
                <>
                  <VideoClipLayoutToggle
                    layout={videoClipLayout}
                    onChange={selectVideoClipLayout}
                    isMobile={isMobile}
                  />
                  {loadingClips ? (
                    <div
                      style={{
                        padding: 40,
                        color: "var(--text-muted)",
                        fontSize: 15,
                      }}
                    >
                      {t("chart.loadingClips")}
                    </div>
                  ) : (
                    <VideoClipVariant
                      entries={chart.entries}
                      videoClips={videoClips}
                      personalNumberOnes={personalNumberOnes}
                      statsLabels={statsLabels}
                      layout={videoClipLayout}
                      isDaily={isDailyParada}
                    />
                  )}
                </>
              )}
                </div>
                {(hasSpotlights || commentsOpen) && !isMobile && (
                  <aside
                    style={{
                      position: "sticky",
                      top: 100,
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    {flashback && <ChartSpotlightCard kind="flashback" song={flashback} />}
                    {destaque && <ChartSpotlightCard kind="destaque" song={destaque} />}
                    {commentsOpen && (
                      <CommentsTab
                        chartId={chart.id}
                        isDbChart={isDbChart}
                        chartOwnerId={user.id}
                        composeUser={composeUser}
                        composeImageUrl={composeImageUrl}
                        onCommentAdded={() => setCommentCount((c) => c + 1)}
                        onCommentDeleted={() => setCommentCount((c) => Math.max(0, c - 1))}
                      />
                    )}
                  </aside>
                )}
              </div>
              {commentsOpen && isMobile && (
                <div style={{ marginTop: 20 }}>
                  <CommentsTab
                    chartId={chart.id}
                    isDbChart={isDbChart}
                    chartOwnerId={user.id}
                    composeUser={composeUser}
                    composeImageUrl={composeImageUrl}
                    onCommentAdded={() => setCommentCount((c) => c + 1)}
                    onCommentDeleted={() => setCommentCount((c) => Math.max(0, c - 1))}
                  />
                </div>
              )}
            </>
          )}
          {tab === "saidas" && (
            <PersonalDropoutsTab
              dropouts={dropouts}
              isDbChart={isDbChart}
              statsLabels={statsLabels}
            />
          )}
          {tab === "overlap" && (
            <OverlapTab
              chartId={chart.id}
              isDbChart={isDbChart}
              statsLabels={statsLabels}
            />
          )}
        </div>
      </div>
      {hasParadaNav && (
        <ChartParadaFloatingNav
          previousChart={previousChart}
          nextChart={nextChart}
          isMobile={isMobile}
          onPrev={goToPreviousChart}
          onNext={goToNextChart}
        />
      )}
      {showDeleteModal && (
        <div
          onClick={() => {
            if (!deletingChart) setShowDeleteModal(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface-elevated)",
              borderRadius: 20,
              padding: 28,
              maxWidth: 420,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
              {t("chart.deleteModalTitle")}
            </div>
            <div
              style={{ fontSize: 14, color: "var(--text-subtle)", lineHeight: 1.6 }}
            >
              {t("chart.deleteModalBody")}
            </div>
            {deleteError && (
              <div style={{ fontSize: 13, color: "#B91C1C" }}>{deleteError}</div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingChart}
                style={{
                  background: "transparent",
                  color: "var(--text)",
                  border: "1px solid var(--divider-strong)",
                  borderRadius: 100,
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: deletingChart ? "not-allowed" : "pointer",
                  opacity: deletingChart ? 0.5 : 1,
                }}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={deleteChart}
                disabled={deletingChart}
                style={{
                  background: "#B91C1C",
                  color: "white",
                  border: "none",
                  borderRadius: 100,
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: deletingChart ? "not-allowed" : "pointer",
                  opacity: deletingChart ? 0.7 : 1,
                }}
              >
                {deletingChart ? t("chart.deleting") : t("chart.confirmDeleteChart")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function chartParadaNavBtnStyle(enabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: "50%",
    border: "1px solid var(--divider)",
    background: enabled ? "var(--surface)" : "var(--fill-subtle)",
    color: enabled ? "var(--text)" : "var(--text-disabled)",
    cursor: enabled ? "pointer" : "not-allowed",
    flexShrink: 0,
    padding: 0,
    boxShadow: enabled ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
  };
}

function ChartParadaFloatingNav({
  previousChart,
  nextChart,
  isMobile,
  onPrev,
  onNext,
}: {
  previousChart: { id: string; weekLabel: string } | null;
  nextChart: { id: string; weekLabel: string } | null;
  isMobile: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { t } = useTranslations();

  return (
    <div
      role="toolbar"
      aria-label={t("chart.navAria")}
      style={{
        position: "fixed",
        bottom: isMobile ? "calc(68px + env(safe-area-inset-bottom, 0px))" : 28,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        gap: isMobile ? 6 : 10,
        padding: isMobile ? "6px 8px" : "8px 12px",
        borderRadius: 100,
        background: "color-mix(in srgb, var(--surface) 92%, transparent)",
        backdropFilter: "blur(16px) saturate(160%)",
        WebkitBackdropFilter: "blur(16px) saturate(160%)",
        border: "1px solid var(--divider)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
        maxWidth: isMobile ? "calc(100vw - 24px)" : 420,
      }}
    >
      <button
        type="button"
        onClick={onPrev}
        disabled={!previousChart}
        aria-label={
          previousChart
            ? t("chart.navPrev", { label: previousChart.weekLabel })
            : t("chart.navNoPrev")
        }
        style={chartParadaNavBtnStyle(!!previousChart)}
      >
        <ChevronLeft size={20} />
      </button>

      <div
        style={{ flex: 1, minWidth: 0, textAlign: "center", padding: "0 4px" }}
      >
        {previousChart && (
          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            ← {previousChart.weekLabel}
          </div>
        )}
        {!isMobile && (
          <div
            style={{
              fontSize: 10,
              color: "var(--text-disabled)",
              marginTop: previousChart || nextChart ? 2 : 0,
            }}
          >
            {t("chart.navKeyboard")}
          </div>
        )}
        {nextChart && (
          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginTop: 2,
            }}
          >
            {nextChart.weekLabel} →
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!nextChart}
        aria-label={
          nextChart
            ? t("chart.navNext", { label: nextChart.weekLabel })
            : t("chart.navNoNext")
        }
        style={chartParadaNavBtnStyle(!!nextChart)}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

function StatPill({
  label,
  value,
  accent,
  compact,
}: {
  label: string;
  value: number | string;
  accent?: string;
  compact?: boolean;
}) {
  return (
    <div style={{ textAlign: "right" }}>
      <div
        style={{
          fontSize: compact ? 8 : 9,
          fontWeight: 700,
          color: "var(--text-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: compact ? 12 : 14,
          fontWeight: 700,
          color: accent ?? "var(--text)",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
    </div>
  );
}


function ClassicList({
  entries,
  personalNumberOnes,
  globalNumberOnes,
  statsLabels,
}: {
  entries: ChartEntry[];
  personalNumberOnes?: Record<string, number>;
  globalNumberOnes?: Record<string, number>;
  statsLabels: ChartStatsLabels;
}) {
  const { t } = useTranslations();
  const isMobile = useIsMobile();
  const coverSize = DESKTOP_COVER_SIZE;
  const gridColumns = desktopListGrid(
    desktopCoverGridColumn(coverSize),
    "80px 80px 60px 90px",
  );
  if (isMobile) {
    return (
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 0,
          borderTop: "1px solid var(--divider)",
          borderBottom: "1px solid var(--divider)",
          overflow: "hidden",
        }}
      >
        {entries.map((e) => (
          <div
            key={e.position}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: "10px 12px",
              borderBottom: "1px solid var(--divider-soft)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: MOBILE_ROW_GAP,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  width: MOBILE_POS_WIDTH,
                  textAlign: "center",
                  flexShrink: 0,
                  alignSelf: "flex-start",
                }}
              >
                <div
                  style={{
                    fontSize: e.position <= 3 ? 20 : 16,
                    fontWeight: 800,
                    letterSpacing: "-0.04em",
                    color: "var(--text)",
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1,
                  }}
                >
                  {e.position}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <MovementBadge status={e.status} delta={e.delta} compact />
                </div>
              </div>
              <Link
                href={buildSongPath(e.song)}
                style={{ lineHeight: 0, flexShrink: 0 }}
              >
                <Cover
                  cover={e.cover}
                  song={e.song}
                  size={MOBILE_COVER_SIZE}
                  rounded={6}
                />
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link
                  href={buildSongPath(e.song)}
                  style={{
                    display: "block",
                    fontSize: MOBILE_TITLE_SIZE,
                    fontWeight: 700,
                    lineHeight: 1.25,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textDecoration: "none",
                    color: "var(--text)",
                  }}
                >
                  {e.song.title}
                </Link>
                <Link
                  href={buildArtistPath(
                    e.song.artist,
                    e.song.artistSpotifyId,
                    e.song.artistRefId,
                  )}
                  style={{
                    display: "block",
                    fontSize: MOBILE_ARTIST_SIZE,
                    lineHeight: 1.25,
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textDecoration: "none",
                    marginTop: 2,
                  }}
                >
                  {formatSongArtist(e.song)}
                </Link>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                paddingLeft: MOBILE_STATS_INDENT,
              }}
            >
              <StatPill compact label={t("chart.pillPrev")} value={e.prevPos ?? "—"} />
              <StatPill
                compact
                label={t("chart.pillPeak")}
                value={e.peak}
                accent={e.peak === 1 ? "var(--accent)" : undefined}
              />
              <StatPill
                compact
                label={statsLabels.tenurePill}
                value={e.weeks}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

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
          gridTemplateColumns: gridColumns,
          gap: 0,
          padding: "0 20px",
          background: "var(--fill-inset)",
          borderBottom: "1px solid var(--divider)",
        }}
      >
        {[
          t("chart.colPos"),
          "",
          t("chart.colSong"),
          statsLabels.prevPeriodShort,
          statsLabels.tenureShort,
          t("chart.colPeak"),
          t("chart.colOnes"),
        ].map((h, i) => (
          <div
            key={i}
            style={{
              padding: "10px 8px",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            {h}
          </div>
        ))}
      </div>
      {entries.map((e) => {
        const personal = lookupNumberOnes(personalNumberOnes, e.song);
        return (
          <div
            key={e.position}
            style={{
              display: "grid",
              gridTemplateColumns: gridColumns,
              alignItems: "center",
              padding: "8px 20px",
              borderBottom: "1px solid var(--divider-soft)",
              gap: 0,
            }}
          >
            <DesktopPosCell position={e.position}>
              <MovementBadge status={e.status} delta={e.delta} compact />
            </DesktopPosCell>
            <Link
              href={buildSongPath(e.song)}
              style={{ padding: "4px 8px 4px 0", lineHeight: 0 }}
            >
              <Cover
                cover={e.cover}
                song={e.song}
                size={coverSize}
                rounded={8}
              />
            </Link>
            <div style={{ minWidth: 0, padding: "0 12px" }}>
              <Link
                href={buildSongPath(e.song)}
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                {e.song.title}
              </Link>
              <Link
                href={buildArtistPath(
                  e.song.artist,
                  e.song.artistSpotifyId,
                  e.song.artistRefId,
                )}
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
                {formatSongArtist(e.song)}
              </Link>
              {e.song.album?.trim() ? (
                <Link
                  href={buildAlbumPath(e.song.album.trim(), e.song.artist, {
                    artistId: e.song.artistRefId,
                    albumId: e.song.albumRefId,
                  })}
                  style={{
                    display: "block",
                    fontSize: 11,
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textDecoration: "none",
                    marginTop: 2,
                  }}
                >
                  {e.song.album}
                </Link>
              ) : null}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                fontVariantNumeric: "tabular-nums",
                padding: "0 8px",
              }}
            >
              {e.prevPos ?? "—"}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                fontVariantNumeric: "tabular-nums",
                padding: "0 8px",
              }}
            >
              {e.weeks}
            </div>
            <div
              style={{
                fontSize: 13,
                fontVariantNumeric: "tabular-nums",
                padding: "0 8px",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              {e.peak === 1 && (
                <span
                  style={{
                    color: "var(--accent)",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  <Star size={12} color="currentColor" fill="currentColor" />
                </span>
              )}
              {e.peak}
            </div>
            <div style={{ padding: "0 8px" }}>
              {personal > 0 ? (
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--text)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {personal}x
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "var(--text-disabled)" }}>
                  —
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GridVariant({
  entries,
  statsLabels,
}: {
  entries: ChartEntry[];
  statsLabels: ChartStatsLabels;
}) {
  const { t } = useTranslations();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: 20,
      }}
    >
      {entries.map((e) => (
        <div
          key={e.position}
          style={{
            borderRadius: 14,
            overflow: "hidden",
            background: "var(--surface)",
            border: "1px solid var(--divider)",
          }}
        >
          <div style={{ position: "relative", aspectRatio: "1" }}>
            <Link
              href={buildSongPath(e.song)}
              style={{ display: "block", lineHeight: 0 }}
            >
              <Cover
                cover={e.cover}
                song={e.song}
                size={0}
                rounded={0}
                style={{ width: "100%", minHeight: 180 }}
              />
            </Link>
            <div
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                background: "rgba(0,0,0,0.7)",
                backdropFilter: "blur(4px)",
                color: "white",
                fontSize: 14,
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: 6,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              #{e.position}
            </div>
            <div style={{ position: "absolute", top: 8, right: 8 }}>
              <MovementBadge status={e.status} delta={e.delta} compact />
            </div>
          </div>
          <div style={{ padding: "10px 12px" }}>
            <Link
              href={buildSongPath(e.song)}
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              {e.song.title}
            </Link>
            <Link
              href={buildArtistPath(
                e.song.artist,
                e.song.artistSpotifyId,
                e.song.artistRefId,
              )}
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
              {formatSongArtist(e.song)}
            </Link>
            <div
              style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}
            >
              {t("chart.gridPeakWeeks", {
                peak: e.peak,
                weeks: e.weeks,
                suffix: statsLabels.tenureSuffix,
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PodiumVariant({
  entries,
  statsLabels,
}: {
  entries: ChartEntry[];
  statsLabels: ChartStatsLabels;
}) {
  if (entries.length < 3) {
    return <ClassicList entries={entries} statsLabels={statsLabels} />;
  }
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  // Podium order: 2nd | 1st | 3rd
  const podiumOrder = [top3[1], top3[0], top3[2]];
  const medalColors: Record<number, string> = {
    1: "#FFD700",
    2: "#C0C0C0",
    3: "#CD7F32",
  };
  const podiumOffsets: Record<number, number> = { 1: 0, 2: 40, 3: 60 };

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 24,
          padding: "60px 0 60px 0",
        }}
      >
        {podiumOrder.map((e) => (
          <div
            key={e.position}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              transform: `translateY(${podiumOffsets[e.position] ?? 0}px)`,
            }}
          >
            <div style={{ position: "relative" }}>
              <Link
                href={buildSongPath(e.song)}
                style={{ display: "block", lineHeight: 0 }}
              >
                <Cover
                  cover={e.cover}
                  song={e.song}
                  size={160}
                  rounded={16}
                  style={{ boxShadow: "0 12px 30px rgba(0,0,0,0.18)" }}
                />
              </Link>
              <div
                style={{
                  position: "absolute",
                  top: -16,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background:
                    medalColors[e.position] ?? "var(--surface-elevated)",
                  color:
                    e.position === 1
                      ? "#7A5000"
                      : e.position === 2
                        ? "#555"
                        : "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 15,
                  fontWeight: 800,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                }}
              >
                {e.position}
              </div>
            </div>
            <div style={{ textAlign: "center", maxWidth: 160 }}>
              <Link
                href={buildSongPath(e.song)}
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                {e.song.title}
              </Link>
              <Link
                href={buildArtistPath(
                  e.song.artist,
                  e.song.artistSpotifyId,
                  e.song.artistRefId,
                )}
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "var(--text-muted)",
                  textDecoration: "none",
                }}
              >
                {formatSongArtist(e.song)}
              </Link>
            </div>
          </div>
        ))}
      </div>
      <ClassicList entries={rest} statsLabels={statsLabels} />
    </>
  );
}

function VideoClipLayoutToggle({
  layout,
  onChange,
  isMobile,
}: {
  layout: VideoClipLayout;
  onChange: (layout: VideoClipLayout) => void;
  isMobile: boolean;
}) {
  const { t } = useTranslations();

  return (
    <div
      style={{
        display: "flex",
        background: "var(--fill-subtle)",
        borderRadius: 8,
        padding: 3,
        gap: 2,
        marginBottom: isMobile ? 12 : 16,
        alignSelf: isMobile ? "stretch" : "flex-start",
        width: isMobile ? "100%" : "auto",
      }}
    >
      {(
        [
          ["table", t("chart.clipLayoutTable")],
          ["stacked", t("chart.clipLayoutStacked")],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          style={{
            flex: isMobile ? 1 : undefined,
            padding: isMobile ? "8px 0" : "6px 14px",
            borderRadius: 6,
            border: "none",
            fontSize: 12,
            fontWeight: 600,
            background: layout === value ? "var(--surface)" : "transparent",
            color: layout === value ? "var(--text)" : "var(--text-muted)",
            boxShadow: layout === value ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            transition: "background 120ms",
            cursor: "pointer",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function formatChartStatsProse(
  entry: ChartEntry,
  personal: number,
  isDaily: boolean,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const tenure = isDaily
    ? entry.weeks === 1
      ? t("chart.copyFmt.tenureOneDay")
      : t("chart.copyFmt.tenureDays", { count: entry.weeks })
    : entry.weeks === 1
      ? t("chart.copyFmt.tenureOneWeek")
      : t("chart.copyFmt.tenureWeeks", { count: entry.weeks });
  const peakPart =
    personal > 0
      ? t("chart.copyFmt.peakWithOnes", { peak: entry.peak, ones: personal })
      : t("chart.copyFmt.peak", { peak: entry.peak });
  return `${tenure} / ${peakPart}`;
}

function VideoClipSongInfo({
  entry,
  titleSize,
  artistSize,
  albumSize,
  statsLine,
}: {
  entry: ChartEntry;
  titleSize: number;
  artistSize: number;
  albumSize: number;
  statsLine?: string;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <Link
        href={buildSongPath(entry.song)}
        style={{
          display: "block",
          fontSize: titleSize,
          fontWeight: 700,
          lineHeight: 1.25,
          textDecoration: "none",
          color: "var(--text)",
        }}
      >
        {entry.song.title}
      </Link>
      <Link
        href={buildArtistPath(
          entry.song.artist,
          entry.song.artistSpotifyId,
          entry.song.artistRefId,
        )}
        style={{
          display: "block",
          fontSize: artistSize,
          lineHeight: 1.25,
          color: "var(--text-muted)",
          textDecoration: "none",
          marginTop: 2,
        }}
      >
        {formatSongArtist(entry.song)}
      </Link>
      {entry.song.album?.trim() ? (
        <Link
          href={buildAlbumPath(entry.song.album.trim(), entry.song.artist, {
            artistId: entry.song.artistRefId,
            albumId: entry.song.albumRefId,
          })}
          style={{
            display: "block",
            fontSize: albumSize,
            color: "var(--text-muted)",
            textDecoration: "none",
            marginTop: 2,
          }}
        >
          {entry.song.album}
        </Link>
      ) : null}
      {statsLine ? (
        <div
          style={{
            fontSize: albumSize,
            color: "var(--text-muted)",
            marginTop: 4,
            lineHeight: 1.35,
          }}
        >
          {statsLine}
        </div>
      ) : null}
    </div>
  );
}

function VideoClipVariant({
  entries,
  videoClips,
  personalNumberOnes,
  statsLabels,
  layout,
  isDaily,
}: {
  entries: ChartEntry[];
  videoClips: Record<string, string>;
  personalNumberOnes?: Record<string, number>;
  statsLabels: ChartStatsLabels;
  layout: VideoClipLayout;
  isDaily: boolean;
}) {
  if (layout === "stacked") {
    return (
      <VideoClipStackedVariant
        entries={entries}
        videoClips={videoClips}
        personalNumberOnes={personalNumberOnes}
        isDaily={isDaily}
      />
    );
  }

  return (
    <VideoClipTableVariant
      entries={entries}
      videoClips={videoClips}
      personalNumberOnes={personalNumberOnes}
      statsLabels={statsLabels}
      isDaily={isDaily}
    />
  );
}

function VideoClipStackedVariant({
  entries,
  videoClips,
  personalNumberOnes,
  isDaily,
}: {
  entries: ChartEntry[];
  videoClips: Record<string, string>;
  personalNumberOnes?: Record<string, number>;
  isDaily: boolean;
}) {
  const { t } = useTranslations();
  const isMobile = useIsMobile();
  const clipHeight = isMobile ? MOBILE_COVER_SIZE : 125;
  const clipWidth = Math.round(clipHeight * (16 / 9));
  const gridColumns = `${desktopPosCol()} ${clipWidth + 16}px minmax(0, 1fr)`;

  if (isMobile) {
    return (
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 0,
          borderTop: "1px solid var(--divider)",
          borderBottom: "1px solid var(--divider)",
          overflow: "hidden",
        }}
      >
        {entries.map((e) => {
          const clipUrl = (e.song.id ? videoClips[e.song.id] : null) ?? null;
          const personal = lookupNumberOnes(personalNumberOnes, e.song);
          const statsLine = formatChartStatsProse(e, personal, isDaily, t);
          return (
            <div
              key={e.position}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: MOBILE_ROW_GAP,
                padding: "10px 12px",
                borderBottom: "1px solid var(--divider-soft)",
              }}
            >
              <div
                style={{
                  width: MOBILE_POS_WIDTH,
                  textAlign: "center",
                  flexShrink: 0,
                  alignSelf: "flex-start",
                }}
              >
                <div
                  style={{
                    fontSize: e.position <= 3 ? 20 : 16,
                    fontWeight: 800,
                    letterSpacing: "-0.04em",
                    color: "var(--text)",
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1,
                  }}
                >
                  {e.position}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <MovementBadge status={e.status} delta={e.delta} compact />
                </div>
              </div>
              <Link
                href={buildSongPath(e.song)}
                style={{ lineHeight: 0, flexShrink: 0 }}
              >
                <VideoClipCover
                  imageUrl={clipUrl}
                  paletteA={e.cover.palette[0]}
                  paletteB={e.cover.palette[1]}
                  seed={e.cover.seed}
                  height={clipHeight}
                />
              </Link>
              <VideoClipSongInfo
                entry={e}
                titleSize={MOBILE_TITLE_SIZE}
                artistSize={MOBILE_ARTIST_SIZE}
                albumSize={11}
                statsLine={statsLine}
              />
            </div>
          );
        })}
      </div>
    );
  }

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
          gridTemplateColumns: gridColumns,
          gap: 0,
          padding: "0 20px",
          background: "var(--fill-inset)",
          borderBottom: "1px solid var(--divider)",
        }}
      >
        {[
          t("chart.colPos"),
          "",
          t("chart.colSong"),
        ].map((h, i) => (
          <div
            key={i}
            style={{
              padding: "10px 8px",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            {h}
          </div>
        ))}
      </div>
      {entries.map((e) => {
        const clipUrl = (e.song.id ? videoClips[e.song.id] : null) ?? null;
        const personal = lookupNumberOnes(personalNumberOnes, e.song);
        const statsLine = formatChartStatsProse(e, personal, isDaily, t);
        return (
          <div
            key={e.position}
            style={{
              display: "grid",
              gridTemplateColumns: gridColumns,
              alignItems: "center",
              padding: "8px 20px",
              borderBottom: "1px solid var(--divider-soft)",
              gap: 0,
            }}
          >
            <DesktopPosCell position={e.position} alignSelf="center">
              <MovementBadge status={e.status} delta={e.delta} compact />
            </DesktopPosCell>
            <Link
              href={buildSongPath(e.song)}
              style={{
                padding: "4px 8px 4px 0",
                lineHeight: 0,
                alignSelf: "center",
              }}
            >
              <VideoClipCover
                imageUrl={clipUrl}
                paletteA={e.cover.palette[0]}
                paletteB={e.cover.palette[1]}
                seed={e.cover.seed}
                height={clipHeight}
              />
            </Link>
            <div
              style={{ minWidth: 0, padding: "0 12px", alignSelf: "center" }}
            >
              <VideoClipSongInfo
                entry={e}
                titleSize={14}
                artistSize={12}
                albumSize={11}
                statsLine={statsLine}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VideoClipTableVariant({
  entries,
  videoClips,
  personalNumberOnes,
  statsLabels,
  isDaily,
}: {
  entries: ChartEntry[];
  videoClips: Record<string, string>;
  personalNumberOnes?: Record<string, number>;
  statsLabels: ChartStatsLabels;
  isDaily: boolean;
}) {
  const { t } = useTranslations();
  const isMobile = useIsMobile();
  const clipHeight = isMobile ? MOBILE_COVER_SIZE : 125;
  const clipWidth = Math.round(clipHeight * (16 / 9));
  const mobileClipIndent =
    MOBILE_POS_WIDTH + MOBILE_ROW_GAP + clipWidth + MOBILE_ROW_GAP;
  const gridColumns = desktopListGrid(
    `${clipWidth + 16}px`,
    "80px 80px 60px 90px",
  );

  if (isMobile) {
    return (
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 0,
          borderTop: "1px solid var(--divider)",
          borderBottom: "1px solid var(--divider)",
          overflow: "hidden",
        }}
      >
        {entries.map((e) => {
          const clipUrl = (e.song.id ? videoClips[e.song.id] : null) ?? null;
          return (
            <div
              key={e.position}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "10px 12px",
                borderBottom: "1px solid var(--divider-soft)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: MOBILE_ROW_GAP,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    width: MOBILE_POS_WIDTH,
                    textAlign: "center",
                    flexShrink: 0,
                    alignSelf: "flex-start",
                  }}
                >
                  <div
                    style={{
                      fontSize: e.position <= 3 ? 20 : 16,
                      fontWeight: 800,
                      letterSpacing: "-0.04em",
                      color: "var(--text)",
                      fontVariantNumeric: "tabular-nums",
                      lineHeight: 1,
                    }}
                  >
                    {e.position}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <MovementBadge status={e.status} delta={e.delta} compact />
                  </div>
                </div>
                <Link
                  href={buildSongPath(e.song)}
                  style={{ lineHeight: 0, flexShrink: 0 }}
                >
                  <VideoClipCover
                    imageUrl={clipUrl}
                    paletteA={e.cover.palette[0]}
                    paletteB={e.cover.palette[1]}
                    seed={e.cover.seed}
                    height={clipHeight}
                  />
                </Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link
                    href={buildSongPath(e.song)}
                    style={{
                      display: "block",
                      fontSize: MOBILE_TITLE_SIZE,
                      fontWeight: 700,
                      lineHeight: 1.25,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      textDecoration: "none",
                      color: "var(--text)",
                    }}
                  >
                    {e.song.title}
                  </Link>
                  <Link
                    href={buildArtistPath(
                      e.song.artist,
                      e.song.artistSpotifyId,
                      e.song.artistRefId,
                    )}
                    style={{
                      display: "block",
                      fontSize: MOBILE_ARTIST_SIZE,
                      lineHeight: 1.25,
                      color: "var(--text-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      textDecoration: "none",
                      marginTop: 2,
                    }}
                  >
                    {formatSongArtist(e.song)}
                  </Link>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  paddingLeft: mobileClipIndent,
                }}
              >
                <StatPill compact label={t("chart.pillPrev")} value={e.prevPos ?? "—"} />
                <StatPill
                  compact
                  label={t("chart.pillPeak")}
                  value={e.peak}
                  accent={e.peak === 1 ? "var(--accent)" : undefined}
                />
                <StatPill
                  compact
                  label={statsLabels.tenurePill}
                  value={e.weeks}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

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
          gridTemplateColumns: gridColumns,
          gap: 0,
          padding: "0 20px",
          background: "var(--fill-inset)",
          borderBottom: "1px solid var(--divider)",
        }}
      >
        {[
          t("chart.colPos"),
          "",
          t("chart.colSong"),
          statsLabels.prevPeriodShort,
          statsLabels.tenureShort,
          t("chart.colPeak"),
          t("chart.colOnes"),
        ].map((h, i) => (
          <div
            key={i}
            style={{
              padding: "10px 8px",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            {h}
          </div>
        ))}
      </div>
      {entries.map((e) => {
        const clipUrl = (e.song.id ? videoClips[e.song.id] : null) ?? null;
        const personal = lookupNumberOnes(personalNumberOnes, e.song);
        return (
          <div
            key={e.position}
            style={{
              display: "grid",
              gridTemplateColumns: gridColumns,
              alignItems: "stretch",
              padding: "8px 20px",
              borderBottom: "1px solid var(--divider-soft)",
              gap: 0,
            }}
          >
            <DesktopPosCell position={e.position} alignSelf="center">
              <MovementBadge status={e.status} delta={e.delta} compact />
            </DesktopPosCell>
            <Link
              href={buildSongPath(e.song)}
              style={{
                padding: "4px 8px 4px 0",
                lineHeight: 0,
                alignSelf: "center",
              }}
            >
              <VideoClipCover
                imageUrl={clipUrl}
                paletteA={e.cover.palette[0]}
                paletteB={e.cover.palette[1]}
                seed={e.cover.seed}
                height={clipHeight}
              />
            </Link>
            <div
              style={{ minWidth: 0, padding: "0 12px", alignSelf: "center" }}
            >
              <Link
                href={buildSongPath(e.song)}
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                {e.song.title}
              </Link>
              <Link
                href={buildArtistPath(
                  e.song.artist,
                  e.song.artistSpotifyId,
                  e.song.artistRefId,
                )}
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
                {formatSongArtist(e.song)}
              </Link>
              {e.song.album?.trim() ? (
                <Link
                  href={buildAlbumPath(e.song.album.trim(), e.song.artist, {
                    artistId: e.song.artistRefId,
                    albumId: e.song.albumRefId,
                  })}
                  style={{
                    display: "block",
                    fontSize: 11,
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textDecoration: "none",
                    marginTop: 2,
                  }}
                >
                  {e.song.album}
                </Link>
              ) : null}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                fontVariantNumeric: "tabular-nums",
                padding: "0 8px",
                alignSelf: "center",
              }}
            >
              {e.prevPos ?? "—"}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                fontVariantNumeric: "tabular-nums",
                padding: "0 8px",
                alignSelf: "center",
              }}
            >
              {e.weeks}
            </div>
            <div
              style={{
                fontSize: 13,
                fontVariantNumeric: "tabular-nums",
                padding: "0 8px",
                display: "flex",
                alignItems: "center",
                gap: 3,
                alignSelf: "center",
              }}
            >
              {e.peak === 1 && (
                <span
                  style={{
                    color: "var(--accent)",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  <Star size={12} color="currentColor" fill="currentColor" />
                </span>
              )}
              {e.peak}
            </div>
            <div style={{ padding: "0 8px", alignSelf: "center" }}>
              {personal > 0 ? (
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--text)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {personal}x
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "var(--text-disabled)" }}>
                  —
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PersonalExitBadge() {
  const { t } = useTranslations();
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "-0.01em",
        padding: "2px 7px",
        borderRadius: 6,
        background: "#1C1C1E",
        color: "#fff",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {t("chart.exitBadge")}
    </span>
  );
}

function PersonalDropoutsTab({
  dropouts,
  isDbChart,
  statsLabels,
}: {
  dropouts: PersonalDropoutEntry[];
  isDbChart: boolean;
  statsLabels: ChartStatsLabels;
}) {
  const { t } = useTranslations();
  const isMobile = useIsMobile();

  if (!isDbChart) {
    return (
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 18,
          border: "1px solid var(--divider)",
          padding: 24,
          color: "var(--text-muted)",
          fontSize: 14,
        }}
      >
        {t("chart.dbOnlyFeature")}
      </div>
    );
  }

  if (dropouts.length === 0) {
    return (
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 18,
          border: "1px solid var(--divider)",
          padding: 40,
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: 14,
        }}
      >
        {statsLabels.noDropouts}
      </div>
    );
  }

  if (isMobile) {
    return (
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 0,
          borderTop: "1px solid var(--divider)",
          borderBottom: "1px solid var(--divider)",
          overflow: "hidden",
        }}
      >
        {dropouts.map((e) => (
          <div
            key={`${e.song.title}\0${e.song.artist}`}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: "10px 12px",
              borderBottom: "1px solid var(--divider-soft)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: MOBILE_ROW_GAP,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  width: MOBILE_POS_WIDTH,
                  textAlign: "center",
                  flexShrink: 0,
                  alignSelf: "flex-start",
                }}
              >
                <div
                  style={{
                    fontSize: e.lastPos <= 3 ? 20 : 16,
                    fontWeight: 800,
                    letterSpacing: "-0.04em",
                    color: "var(--text-muted)",
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1,
                  }}
                >
                  {e.lastPos}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <PersonalExitBadge />
                </div>
              </div>
              <Link
                href={buildSongPath(e.song)}
                style={{ lineHeight: 0, flexShrink: 0 }}
              >
                <Cover
                  cover={e.cover}
                  song={e.song}
                  size={MOBILE_COVER_SIZE}
                  rounded={6}
                />
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link
                  href={buildSongPath(e.song)}
                  style={{
                    display: "block",
                    fontSize: MOBILE_TITLE_SIZE,
                    fontWeight: 700,
                    lineHeight: 1.25,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textDecoration: "none",
                    color: "var(--text)",
                  }}
                >
                  {e.song.title}
                </Link>
                <Link
                  href={buildArtistPath(
                    e.song.artist,
                    e.song.artistSpotifyId,
                    e.song.artistRefId,
                  )}
                  style={{
                    display: "block",
                    fontSize: MOBILE_ARTIST_SIZE,
                    lineHeight: 1.25,
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textDecoration: "none",
                    marginTop: 2,
                  }}
                >
                  {formatSongArtist(e.song)}
                </Link>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                paddingLeft: MOBILE_STATS_INDENT,
              }}
            >
              <StatPill
                compact
                label={t("chart.pillPeak")}
                value={e.peak}
                accent={e.peak === 1 ? "var(--accent)" : undefined}
              />
              <StatPill
                compact
                label={statsLabels.tenurePill}
                value={e.weeks}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const dropoutGrid = desktopListGrid(
    desktopCoverGridColumn(DESKTOP_COVER_SIZE),
    "80px 60px",
  );

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
          gridTemplateColumns: dropoutGrid,
          gap: 0,
          padding: "0 20px",
          background: "var(--fill-inset)",
          borderBottom: "1px solid var(--divider)",
        }}
      >
        {[
          t("chart.colLast"),
          "",
          t("chart.colSong"),
          t("chart.colPeak"),
          statsLabels.tenureShort,
        ].map((h, i) => (
          <div
            key={i}
            style={{
              padding: "10px 8px",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            {h}
          </div>
        ))}
      </div>
      {dropouts.map((e) => (
        <div
          key={`${e.song.title}\0${e.song.artist}`}
          style={{
            display: "grid",
            gridTemplateColumns: dropoutGrid,
            alignItems: "center",
            padding: "8px 20px",
            borderBottom: "1px solid var(--divider-soft)",
            gap: 0,
          }}
        >
          <DesktopPosCell position={e.lastPos} muted>
            <PersonalExitBadge />
          </DesktopPosCell>
          <Link
            href={buildSongPath(e.song)}
            style={{ padding: "4px 8px 4px 0", lineHeight: 0 }}
          >
            <Cover
              cover={e.cover}
              song={e.song}
              size={DESKTOP_COVER_SIZE}
              rounded={8}
            />
          </Link>
          <div style={{ minWidth: 0, padding: "0 12px" }}>
            <Link
              href={buildSongPath(e.song)}
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              {e.song.title}
            </Link>
            <Link
              href={buildArtistPath(
                e.song.artist,
                e.song.artistSpotifyId,
                e.song.artistRefId,
              )}
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
              {formatSongArtist(e.song)}
            </Link>
            {e.song.album?.trim() ? (
              <Link
                href={buildAlbumPath(e.song.album.trim(), e.song.artist, {
                  artistId: e.song.artistRefId,
                  albumId: e.song.albumRefId,
                })}
                style={{
                  display: "block",
                  fontSize: 11,
                  color: "var(--text-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textDecoration: "none",
                  marginTop: 2,
                }}
              >
                {e.song.album}
              </Link>
            ) : null}
          </div>
          <div
            style={{
              fontSize: 13,
              fontVariantNumeric: "tabular-nums",
              padding: "0 8px",
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            {e.peak === 1 && (
              <span
                style={{
                  color: "var(--accent)",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <Star size={12} color="currentColor" fill="currentColor" />
              </span>
            )}
            {e.peak}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              fontVariantNumeric: "tabular-nums",
              padding: "0 8px",
            }}
          >
            {e.weeks}
          </div>
        </div>
      ))}
    </div>
  );
}

function CommentItem({
  comment,
  chartId,
  chartOwnerId,
  onDeleted,
}: {
  comment: CommentRow;
  chartId: string;
  chartOwnerId: string;
  onDeleted: (commentId: string) => void;
}) {
  const { t } = useTranslations();
  const { data: session } = useSession();
  const isMobile = useIsMobile();
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [replies, setReplies] = useState<CommentReplyRow[]>([]);
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyCount, setReplyCount] = useState(comment.replyCount);
  const [liked, setLiked] = useState(comment.liked ?? false);
  const [likeCount, setLikeCount] = useState(comment.likes);
  const [togglingLike, setTogglingLike] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canDelete =
    !!session?.user?.id &&
    (session.user.id === comment.user.id || session.user.id === chartOwnerId);

  async function deleteComment() {
    if (!canDelete || deleting) return;
    if (!window.confirm(t("chart.deleteCommentConfirm"))) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/charts/${chartId}/comment/${comment.id}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        onDeleted(comment.id);
        return;
      }
      if (res.status === 401) {
        alert(t("chart.loginToComment"));
        return;
      }
      alert(t("chart.deleteCommentError"));
    } catch {
      alert(t("chart.connectionError"));
    } finally {
      setDeleting(false);
    }
  }

  async function toggleLike() {
    if (!session?.user || togglingLike) return;
    setTogglingLike(true);
    try {
      const res = await fetch(
        `/api/charts/${chartId}/comment/${comment.id}/like`,
        { method: "POST" },
      );
      if (res.status === 401) {
        alert(t("chart.loginToLike"));
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as { liked: boolean; likes: number };
        setLiked(data.liked);
        setLikeCount(data.likes);
      }
    } finally {
      setTogglingLike(false);
    }
  }

  async function loadReplies() {
    setLoadingReplies(true);
    try {
      const res = await fetch(
        `/api/charts/${chartId}/comment/${comment.id}/replies`,
      );
      if (res.ok) {
        const data = (await res.json()) as CommentReplyRow[];
        setReplies(data);
      }
    } finally {
      setRepliesLoaded(true);
      setLoadingReplies(false);
    }
  }

  function toggleReplies() {
    if (!repliesOpen) {
      setRepliesOpen(true);
      if (!repliesLoaded) loadReplies();
    } else {
      setRepliesOpen(false);
    }
  }

  async function submitReply() {
    const text = replyText.trim();
    if (!text || submittingReply) return;
    setSubmittingReply(true);
    try {
      const res = await fetch(
        `/api/charts/${chartId}/comment/${comment.id}/replies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        },
      );
      if (res.ok) {
        const newReply = (await res.json()) as CommentReplyRow;
        setReplies((prev) => [...prev, newReply]);
        setReplyCount((n) => n + 1);
        setReplyText("");
        if (!repliesLoaded) setRepliesLoaded(true);
        if (!repliesOpen) setRepliesOpen(true);
      }
    } finally {
      setSubmittingReply(false);
    }
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: isMobile ? 14 : 18,
        border: "1px solid var(--divider)",
        padding: isMobile ? 14 : 20,
      }}
    >
      <div style={{ display: "flex", gap: isMobile ? 10 : 12 }}>
        <Avatar
          user={{ name: comment.user.name, avatar: comment.user.avatarColor }}
          imageUrl={comment.user.image}
          size={isMobile ? 32 : 36}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              gap: isMobile ? "2px 8px" : 8,
              marginBottom: 6,
            }}
          >
            <Link
              href={`/profile/${comment.user.handle}`}
              style={{
                fontSize: isMobile ? 13 : 14,
                fontWeight: 600,
                color: "var(--text)",
                textDecoration: "none",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {comment.user.name}
            </Link>
            <span
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: isMobile ? "100%" : undefined,
              }}
            >
              @{comment.user.handle}
            </span>
            <span
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                marginLeft: isMobile ? 0 : "auto",
                flexBasis: isMobile ? "100%" : undefined,
              }}
            >
              {timeAgo(comment.createdAt)}
            </span>
          </div>
          <p
            style={{
              fontSize: isMobile ? 13 : 14,
              lineHeight: 1.5,
              color: "var(--text)",
              marginBottom: 10,
              overflowWrap: "anywhere",
            }}
          >
            {comment.text}
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: isMobile ? 8 : 12,
              flexWrap: "wrap",
              rowGap: 8,
            }}
          >
            <button
              onClick={toggleLike}
              disabled={togglingLike}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: liked ? "var(--accent-tint)" : "none",
                border: "none",
                color: liked ? "var(--accent)" : "var(--text-muted)",
                fontSize: 13,
                cursor: session?.user ? "pointer" : "default",
                borderRadius: 100,
                padding: liked ? "4px 8px" : "4px 0",
                opacity: togglingLike ? 0.6 : 1,
              }}
            >
              <Heart size={14} fill={liked ? "currentColor" : "none"} />
              {likeCount > 0 && <span>{likeCount}</span>}
            </button>
            <button
              onClick={toggleReplies}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: "none",
                border: "none",
                color: repliesOpen ? "var(--accent)" : "var(--text-muted)",
                fontSize: 13,
                fontWeight: repliesOpen ? 600 : 400,
                cursor: "pointer",
              }}
            >
              <MessageCircle size={14} />
              {replyCount > 0
                ? replyCount === 1
                  ? t("chart.replyOne", { count: replyCount })
                  : t("chart.replyMany", { count: replyCount })
                : t("chart.reply")}
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={deleteComment}
                disabled={deleting}
                aria-label={t("chart.deleteComment")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  background: "none",
                  border: "none",
                  color: "#C5291C",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: deleting ? "not-allowed" : "pointer",
                  opacity: deleting ? 0.6 : 1,
                  flexShrink: 0,
                }}
              >
                <Trash2 size={14} />
                {!isMobile && (deleting ? "…" : t("chart.deleteComment"))}
              </button>
            )}
            {comment.reactions.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  flexWrap: "wrap",
                  width: isMobile ? "100%" : undefined,
                }}
              >
                {comment.reactions.map((r, i) => (
                  <span
                    key={i}
                    style={{
                      background: "rgba(0,0,0,0.04)",
                      borderRadius: 12,
                      padding: "2px 8px",
                      fontSize: 12,
                    }}
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {repliesOpen && (
        <div
          style={{
            marginTop: 16,
            marginLeft: isMobile ? 0 : 48,
            borderLeft: isMobile ? "none" : "2px solid var(--divider)",
            paddingLeft: isMobile ? 0 : 16,
            borderTop: isMobile ? "1px solid var(--divider-soft)" : "none",
            paddingTop: isMobile ? 14 : 0,
          }}
        >
          {session?.user && (
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                marginBottom: 12,
              }}
            >
              <Avatar
                user={{ name: session.user.name ?? "", avatar: "#FA243C" }}
                imageUrl={session.user.image ?? null}
                size={28}
              />
              <div style={{ flex: 1 }}>
                <input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitReply();
                    }
                  }}
                  placeholder={t("chart.replyPlaceholder")}
                  style={{
                    width: "100%",
                    border: "none",
                    outline: "none",
                    fontSize: 13,
                    color: "var(--text)",
                    padding: "6px 0",
                    background: "transparent",
                    borderBottom: "1px solid var(--divider)",
                  }}
                />
                {replyText.trim() && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    <button
                      onClick={() => setReplyText("")}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--text-muted)",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {t("common.cancel")}
                    </button>
                    <button
                      onClick={submitReply}
                      disabled={submittingReply}
                      style={{
                        background: "var(--accent)",
                        color: "white",
                        border: "none",
                        padding: "5px 14px",
                        borderRadius: 100,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: submittingReply ? "default" : "pointer",
                        opacity: submittingReply ? 0.6 : 1,
                      }}
                    >
                      {submittingReply ? t("chart.sending") : t("chart.reply")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {loadingReplies && (
            <div
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                padding: "8px 0",
              }}
            >
              {t("chart.loadingReplies")}
            </div>
          )}

          {repliesLoaded && replies.length === 0 && !loadingReplies && (
            <div
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                padding: "4px 0",
              }}
            >
              {t("chart.noReplies")}
            </div>
          )}

          {replies.map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                gap: isMobile ? 8 : 10,
                marginBottom: 12,
              }}
            >
              <Avatar
                user={{ name: r.user.name, avatar: r.user.avatarColor }}
                imageUrl={r.user.image}
                size={isMobile ? 24 : 28}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "baseline",
                    gap: isMobile ? "2px 6px" : 6,
                    marginBottom: 4,
                  }}
                >
                  <Link
                    href={`/profile/${r.user.handle}`}
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text)",
                      textDecoration: "none",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "100%",
                    }}
                  >
                    {r.user.name}
                  </Link>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    @{r.user.handle}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      marginLeft: isMobile ? 0 : "auto",
                      flexBasis: isMobile ? "100%" : undefined,
                    }}
                  >
                    {timeAgo(r.createdAt)}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "var(--text)",
                    margin: 0,
                    overflowWrap: "anywhere",
                  }}
                >
                  {r.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentsTab({
  chartId,
  isDbChart,
  chartOwnerId,
  composeUser,
  composeImageUrl,
  onCommentAdded,
  onCommentDeleted,
}: {
  chartId: string;
  isDbChart: boolean;
  chartOwnerId: string;
  composeUser: Pick<User, "name" | "avatar">;
  composeImageUrl?: string | null;
  onCommentAdded: () => void;
  onCommentDeleted: () => void;
}) {
  const { t } = useTranslations();
  const isMobile = useIsMobile();
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const reactions = ["🔥", "💯", "❤️", "🥲", "😅", "👀"];

  useEffect(() => {
    if (!isDbChart) return;
    setLoading(true);
    fetch(`/api/charts/${chartId}/comment`)
      .then((r) => r.json())
      .then((data: CommentRow[]) => {
        setComments(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [chartId, isDbChart]);

  async function submitComment() {
    const text = comment.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/charts/${chartId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const newComment = (await res.json()) as CommentRow;
        setComments((prev) => [newComment, ...prev]);
        setComment("");
        onCommentAdded();
      } else if (res.status === 401) {
        alert(t("chart.loginToComment"));
      } else {
        alert(t("chart.commentSubmitError"));
      }
    } catch {
      alert(t("chart.connectionError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: isMobile ? 12 : 16,
      }}
    >
      {/* Compose */}
      <div
        style={{
          background: "var(--surface)",
          borderRadius: isMobile ? 14 : 18,
          border: "1px solid var(--divider)",
          padding: isMobile ? 14 : 20,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: isMobile ? 10 : 12,
            alignItems: "flex-start",
          }}
        >
          <Avatar
            user={composeUser}
            imageUrl={composeImageUrl ?? undefined}
            size={isMobile ? 32 : 36}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitComment();
                }
              }}
              placeholder={t("chart.commentPlaceholder")}
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                fontSize: isMobile ? 13 : 14,
                color: "var(--text)",
                resize: "none",
                padding: "8px 0",
                background: "transparent",
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: isMobile ? 4 : 8,
                marginTop: 8,
                flexWrap: "wrap",
                rowGap: 8,
              }}
            >
              {reactions.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setComment((c) => c + r)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: isMobile ? 16 : 18,
                    cursor: "pointer",
                    padding: 2,
                    flexShrink: 0,
                  }}
                >
                  {r}
                </button>
              ))}
              <button
                type="button"
                onClick={submitComment}
                disabled={!comment.trim() || submitting}
                style={{
                  marginLeft: isMobile ? 0 : "auto",
                  width: isMobile ? "100%" : undefined,
                  background: "var(--accent)",
                  color: "white",
                  border: "none",
                  padding: isMobile ? "10px 18px" : "8px 18px",
                  borderRadius: 100,
                  fontSize: 13,
                  fontWeight: 700,
                  boxShadow: "0 2px 8px rgba(250,36,60,0.25)",
                  opacity: !comment.trim() || submitting ? 0.5 : 1,
                  cursor: !comment.trim() || submitting ? "default" : "pointer",
                  textAlign: "center",
                }}
              >
                {t("chart.comment")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div
          style={{
            color: "var(--text-muted)",
            fontSize: 14,
            padding: "12px 0",
          }}
        >
          {t("chart.loadingComments")}
        </div>
      )}
      {!loading && comments.length === 0 && (
        <div
          style={{
            color: "var(--text-muted)",
            fontSize: 14,
            padding: "12px 0",
          }}
        >
          {t("chart.noComments")}
        </div>
      )}
      {comments.map((c) => (
        <CommentItem
          key={c.id}
          comment={c}
          chartId={chartId}
          chartOwnerId={chartOwnerId}
          onDeleted={(commentId) => {
            setComments((prev) => prev.filter((row) => row.id !== commentId));
            onCommentDeleted();
          }}
        />
      ))}
    </div>
  );
}

function OverlapTab({
  chartId,
  isDbChart,
  statsLabels,
}: {
  chartId: string;
  isDbChart: boolean;
  statsLabels: ChartStatsLabels;
}) {
  const { t } = useTranslations();
  const [rows, setRows] = useState<OverlapRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isDbChart) return;
    setLoading(true);
    fetch(`/api/charts/${chartId}/overlap`)
      .then((r) => r.json())
      .then((data: OverlapRow[]) => {
        setRows(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [chartId, isDbChart]);

  if (!isDbChart) {
    return (
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 18,
          border: "1px solid var(--divider)",
          padding: 24,
          color: "var(--text-muted)",
          fontSize: 14,
        }}
      >
        {t("chart.dbOnlyFeature")}
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 18,
          border: "1px solid var(--divider)",
          padding: 24,
          color: "var(--text-muted)",
          fontSize: 14,
        }}
      >
        {statsLabels.overlapLoading}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 18,
          border: "1px solid var(--divider)",
          padding: 24,
          color: "var(--text-muted)",
          fontSize: 14,
        }}
      >
        {statsLabels.overlapEmpty}
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: 18,
        border: "1px solid var(--divider)",
        overflow: "hidden",
      }}
    >
      {rows.map((row, i) => {
        return (
          <div
            key={row.userId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "16px 20px",
              borderBottom:
                i < rows.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
            }}
          >
            <Link
              href={`/profile/${row.user.handle}`}
              style={{ textDecoration: "none" }}
            >
              <Avatar
                user={{ name: row.user.name, avatar: row.user.avatarColor }}
                imageUrl={row.user.image}
                size={40}
              />
            </Link>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <Link
                  href={`/profile/${row.user.handle}`}
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text)",
                    textDecoration: "none",
                  }}
                >
                  {row.user.name}
                </Link>
              </div>
            </div>
            <Link
              href={`/chart/${row.chartId}`}
              style={{
                background: "var(--btn-dark-bg)",
                color: "var(--btn-dark-fg)",
                border: "none",
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {t("chart.overlapView")}
            </Link>
          </div>
        );
      })}
    </div>
  );
}

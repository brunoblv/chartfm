"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { Cover } from "@/components/ui/Cover";
import { MovementBadge } from "@/components/ui/MovementBadge";
import { PositionNumber } from "@/components/ui/PositionNumber";
import { buildArtistPath, buildSongPath } from "@/lib/music-routes";
import {
  aggregateArtists,
  aggregateSongs,
  buildNumberOnesList,
  type ArtistTableRow,
  type NumberOneRow,
  type SongTableRow,
} from "@/lib/profile-parada-aggregates";
import type { ParadaScoringTier } from "@/lib/parada-points";
import type { Chart, UserWithCharts } from "@/lib/types";
import { formatSongArtist } from "@/lib/song-artist";
import { ParadaPagination, usePublicationGridLayout } from "@/components/paradas/ParadaPagination";
import { useTranslations } from "@/hooks/useTranslations";

type ProfileChartsResponse = {
  user: UserWithCharts;
  totalCharts?: number;
  page?: number;
  perPage?: number;
};

type ParadaTab = "charts" | "numberOnes" | "artists" | "songs";

const PREVIEW_ENTRIES = 5;
const STATS_PER_PAGE = 20;

export function ParadaDetailTabs({
  handle,
  paradaId,
  user,
  scoringTier,
  cadence,
  totalCharts,
  isMobile,
  gutterX,
}: {
  handle: string;
  paradaId: string;
  user: UserWithCharts;
  scoringTier: ParadaScoringTier;
  cadence?: "weekly" | "daily";
  totalCharts: number;
  isMobile: boolean;
  gutterX: number;
}) {
  const { t } = useTranslations();
  const [tab, setTab] = useState<ParadaTab>("charts");
  const [statsPage, setStatsPage] = useState(1);
  const hasCharts = user.charts.length > 0;

  const chartsSortedAsc = useMemo(
    () => [...user.charts].sort((a, b) => a.week - b.week),
    [user.charts],
  );
  const latestWeek = chartsSortedAsc[chartsSortedAsc.length - 1]?.week ?? null;
  const previousCharts = latestWeek
    ? chartsSortedAsc.filter((c) => c.week < latestWeek)
    : [];

  const artistsRows = useMemo(
    () =>
      latestWeek
        ? aggregateArtists(chartsSortedAsc, previousCharts, scoringTier, cadence)
        : [],
    [chartsSortedAsc, latestWeek, previousCharts, scoringTier, cadence],
  );
  const songsRows = useMemo(
    () =>
      latestWeek
        ? aggregateSongs(chartsSortedAsc, previousCharts, scoringTier, cadence)
        : [],
    [chartsSortedAsc, latestWeek, previousCharts, scoringTier, cadence],
  );
  const numberOnesRows = useMemo(
    () => buildNumberOnesList(user.charts),
    [user.charts],
  );

  useEffect(() => {
    if (tab === "charts") return;
    const total =
      tab === "numberOnes"
        ? numberOnesRows.length
        : tab === "artists"
          ? artistsRows.length
          : songsRows.length;
    const totalPages = Math.max(1, Math.ceil(total / STATS_PER_PAGE));
    if (statsPage > totalPages) setStatsPage(totalPages);
  }, [tab, statsPage, numberOnesRows.length, artistsRows.length, songsRows.length]);

  const tabs: { id: ParadaTab; label: string }[] = [
    { id: "charts", label: t("chart.detailTabPublications") },
    { id: "numberOnes", label: t("chart.colOnes") },
    { id: "artists", label: t("chart.detailTabArtists") },
    { id: "songs", label: t("chart.detailTabSongs") },
  ];

  return (
    <>
      <div style={{ padding: `0 ${gutterX}px` }}>
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--divider)",
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              disabled={!hasCharts && id !== "charts"}
              onClick={() => {
                setTab(id);
                setStatsPage(1);
              }}
              style={{
                padding: isMobile ? "10px 14px" : "12px 18px",
                background: "none",
                border: "none",
                borderBottom: `2px solid ${tab === id ? "#FA243C" : "transparent"}`,
                marginBottom: -1,
                fontSize: isMobile ? 13 : 14,
                fontWeight: tab === id ? 700 : 500,
                color: tab === id ? "var(--text)" : "var(--text-muted)",
                cursor: !hasCharts && id !== "charts" ? "not-allowed" : "pointer",
                opacity: !hasCharts && id !== "charts" ? 0.45 : 1,
                whiteSpace: "nowrap",
                flexShrink: 0,
                fontFamily: "inherit",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: `20px ${gutterX}px 80px` }}>
        {tab === "charts" && (
          <PublicationsGrid
            handle={handle}
            paradaId={paradaId}
            totalCharts={totalCharts}
            isMobile={isMobile}
            cadence={cadence}
          />
        )}
        {tab === "numberOnes" && hasCharts && (
          <>
            <NumberOnesList
              rows={numberOnesRows.slice(
                (statsPage - 1) * STATS_PER_PAGE,
                statsPage * STATS_PER_PAGE,
              )}
              total={numberOnesRows.length}
            />
            <ParadaPagination
              page={statsPage}
              totalPages={Math.max(1, Math.ceil(numberOnesRows.length / STATS_PER_PAGE))}
              onChange={setStatsPage}
            />
          </>
        )}
        {tab === "artists" && hasCharts && (
          <>
            <ArtistsTable
              rows={artistsRows.slice(
                (statsPage - 1) * STATS_PER_PAGE,
                statsPage * STATS_PER_PAGE,
              )}
              cadence={cadence}
            />
            <ParadaPagination
              page={statsPage}
              totalPages={Math.max(1, Math.ceil(artistsRows.length / STATS_PER_PAGE))}
              onChange={setStatsPage}
            />
          </>
        )}
        {tab === "songs" && hasCharts && (
          <>
            <SongsTable
              rows={songsRows.slice(
                (statsPage - 1) * STATS_PER_PAGE,
                statsPage * STATS_PER_PAGE,
              )}
              cadence={cadence}
            />
            <ParadaPagination
              page={statsPage}
              totalPages={Math.max(1, Math.ceil(songsRows.length / STATS_PER_PAGE))}
              onChange={setStatsPage}
            />
          </>
        )}
      </div>
    </>
  );
}

function PublicationsGrid({
  handle,
  paradaId,
  totalCharts,
  isMobile,
  cadence,
}: {
  handle: string;
  paradaId: string;
  totalCharts: number;
  isMobile: boolean;
  cadence?: "weekly" | "daily";
}) {
  const { t } = useTranslations();
  const { gridRef, perPage, gridTemplateColumns } = usePublicationGridLayout(isMobile);
  const [page, setPage] = useState(1);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [loading, setLoading] = useState(true);

  const totalPages = Math.max(1, Math.ceil(totalCharts / perPage));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [handle, paradaId, perPage]);

  useEffect(() => {
    if (totalCharts === 0) {
      setCharts([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const q = new URLSearchParams({
          mode: "summary",
          paradaId,
          page: String(page),
          perPage: String(perPage),
        });
        const res = await fetch(
          `/api/profile/${encodeURIComponent(handle)}?${q}`,
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as ProfileChartsResponse;
        if (!cancelled) setCharts(data.user.charts ?? []);
      } catch {
        if (!cancelled) setCharts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle, paradaId, page, perPage, totalCharts]);

  if (totalCharts === 0) {
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
        <p style={{ fontSize: 15, color: "var(--text-muted)", margin: 0 }}>
          {t("chart.detailNoPublications")}
        </p>
      </div>
    );
  }

  return (
    <>
      {loading && (
        <div style={{ marginBottom: 12, color: "var(--text-muted)", fontSize: 13 }}>
          {t("chart.detailLoadingPublications")}
        </div>
      )}
      <div
        ref={gridRef}
        style={{
          display: "grid",
          gridTemplateColumns,
          gap: 16,
        }}
      >
        {charts.map((chart) => (
          <WeekPreviewCard key={chart.id} chart={chart} cadence={cadence} />
        ))}
      </div>
      <ParadaPagination
        page={page}
        totalPages={totalPages}
        onChange={setPage}
        loading={loading}
      />
    </>
  );
}

function WeekPreviewCard({
  chart,
  cadence,
}: {
  chart: Chart;
  cadence?: "weekly" | "daily";
}) {
  const { t } = useTranslations();
  const preview = chart.entries.slice(0, PREVIEW_ENTRIES);

  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: 16,
        border: "1px solid var(--divider)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid var(--divider)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--fill-subtle)",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--text)",
          }}
        >
          {chart.weekLabel}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
          {chart.dateRange}
        </div>
      </div>
      {preview.map((entry) => (
        <div
          key={`${entry.position}-${entry.song.title}-${entry.song.artist}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 14px",
            borderBottom: "1px solid var(--divider-soft)",
          }}
        >
          <PositionNumber n={entry.position} size={18} />
          <Cover cover={entry.cover} size={36} rounded={8} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "var(--text)",
              }}
            >
              {entry.song.title}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginTop: 1,
              }}
            >
              {formatSongArtist(entry.song)}
            </div>
          </div>
          <MovementBadge status={entry.status} delta={entry.delta} compact />
        </div>
      ))}
      <div style={{ padding: "10px 14px", textAlign: "center" }}>
        <Link
          href={`/chart/${chart.id}`}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--accent)",
            textDecoration: "none",
            letterSpacing: "-0.01em",
          }}
        >
          {cadence === "daily" ? t("chart.detailViewDayFull") : t("chart.detailViewWeekFull")}
        </Link>
      </div>
    </div>
  );
}

function NumberOnesList({
  rows,
  total,
}: {
  rows: NumberOneRow[];
  total: number;
}) {
  const { t } = useTranslations();
  if (total === 0) {
    return (
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          border: "1px solid var(--divider)",
          padding: 40,
          textAlign: "center",
        }}
      >
        <Trophy size={36} color="#FFD700" fill="#FFD700" style={{ marginBottom: 12 }} />
        <p style={{ fontSize: 15, color: "var(--text-muted)", margin: 0 }}>
          {t("chart.detailNoNumberOnes")}
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: 16,
        border: "1px solid var(--divider)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          background: "var(--fill-subtle)",
          borderBottom: "1px solid var(--divider)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
          {t("chart.detailNumberOnesHeader")}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {t(total === 1 ? "chart.detailSongCountSingular" : "chart.detailSongCountPlural", { count: total })}
        </div>
      </div>
      {rows.map((row) => {
        const songHref = buildSongPath({
          title: row.title,
          artist: row.artist,
          id: row.songId,
          slugArtist: row.slugArtist,
          spotifyId: row.spotifyId,
          artistRefId: row.artistRefId,
        });
        return (
          <div
            key={`${row.title}-${row.artist}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 16px",
              borderBottom: "1px solid var(--divider-soft)",
            }}
          >
            <Cover cover={row.cover} size={48} rounded={10} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link
                href={songHref}
                prefetch={false}
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "var(--text)",
                  textDecoration: "none",
                  display: "block",
                }}
              >
                {row.title}
              </Link>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {row.artist}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, fontWeight: 500 }}>
                {t("chart.detailLastDateRange", { range: row.lastDateRange })}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  color: "var(--accent)",
                  lineHeight: 1,
                }}
              >
                {row.count}×
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginTop: 3,
                }}
              >
                #1
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ArtistsTable({
  rows,
  cadence,
}: {
  rows: ArtistTableRow[];
  cadence?: "weekly" | "daily";
}) {
  const { t } = useTranslations();
  const tenureLabel = cadence === "daily" ? t("chart.stats.daysShort") : t("chart.detailTenureWeeks");
  return (
    <div
      style={{
        overflowX: "auto",
        borderRadius: 16,
        border: "1px solid var(--divider)",
      }}
    >
      <div style={{ background: "var(--surface)", minWidth: 560 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "40px 60px 1fr 80px 56px 56px 56px",
            padding: "10px 16px",
            background: "var(--fill-subtle)",
            borderBottom: "1px solid var(--divider)",
            alignItems: "center",
          }}
        >
          {(() => {
            const colPoints = t("chart.detailColPoints");
            const colPeak = t("chart.colPeak");
            const colOnes = t("chart.colOnes");
            return ["#", t("chart.detailColMov"), t("chart.detailColArtist"), colPoints, tenureLabel, colPeak, colOnes].map((h) => (
              <div
                key={h}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--text-muted)",
                  textAlign: h === colPoints || h === tenureLabel || h === colPeak || h === colOnes ? "right" : undefined,
                }}
              >
                {h}
              </div>
            ));
          })()}
        </div>
        {rows.map((artist) => (
          <div
            key={artist.name}
            style={{
              display: "grid",
              gridTemplateColumns: "40px 60px 1fr 80px 56px 56px 56px",
              padding: "11px 16px",
              borderBottom: "1px solid var(--divider-soft)",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {artist.position}
            </div>
            <div>
              <MovementBadge status={artist.status} delta={artist.delta} compact />
            </div>
            <Link
              href={buildArtistPath(artist.name, artist.artistSpotifyId, artist.artistRefId)}
              prefetch={false}
              style={{
                fontSize: 14,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "var(--text)",
                textDecoration: "none",
              }}
            >
              {artist.name}
            </Link>
            <div style={{ fontSize: 13, fontWeight: 600, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {artist.totalPoints}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "right" }}>
              {artist.weeks}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "right" }}>
              #{artist.peak}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: artist.numberOnes > 0 ? 700 : 400,
                textAlign: "right",
                color: artist.numberOnes > 0 ? "var(--text)" : "var(--text-disabled)",
              }}
            >
              {artist.numberOnes > 0 ? artist.numberOnes : "-"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SongsTable({
  rows,
  cadence,
}: {
  rows: SongTableRow[];
  cadence?: "weekly" | "daily";
}) {
  const { t } = useTranslations();
  const tenureLabel = cadence === "daily" ? t("chart.stats.daysShort") : t("chart.detailTenureWeeks");
  return (
    <div
      style={{
        overflowX: "auto",
        borderRadius: 16,
        border: "1px solid var(--divider)",
      }}
    >
      <div style={{ background: "var(--surface)", minWidth: 520 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 16px",
            background: "var(--fill-subtle)",
            borderBottom: "1px solid var(--divider)",
          }}
        >
          <div style={{ width: 36, fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)" }}>#</div>
          <div style={{ width: 36 }} />
          <div style={{ flex: 1, fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)" }}>{t("chart.colSong")}</div>
          <div style={{ width: 60, textAlign: "right", fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)" }}>{t("chart.detailColPoints")}</div>
          <div style={{ width: 44, textAlign: "right", fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)" }}>{tenureLabel}</div>
          <div style={{ width: 44, textAlign: "right", fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)" }}>{t("chart.colPeak")}</div>
          <div style={{ width: 40, textAlign: "right", fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)" }}>{t("chart.colOnes")}</div>
        </div>
        {rows.map((song) => {
          const songHref = buildSongPath({
            title: song.title,
            artist: song.artist,
            id: song.songId,
            slugArtist: song.slugArtist,
            spotifyId: song.spotifyId,
            artistRefId: song.artistRefId,
          });
          return (
            <div
              key={`${song.title}-${song.artist}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                borderBottom: "1px solid var(--divider-soft)",
              }}
            >
              <div style={{ width: 36, fontSize: 14, fontWeight: 700, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                {song.position}
              </div>
              <Cover cover={song.cover} size={36} rounded={8} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link
                  href={songHref}
                  prefetch={false}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: "var(--text)",
                    textDecoration: "none",
                    display: "block",
                  }}
                >
                  {song.title}
                </Link>
                <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                  {song.artist}
                </div>
              </div>
              <div style={{ width: 60, textAlign: "right", fontSize: 13, fontWeight: 600, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                {song.totalPoints}
              </div>
              <div style={{ width: 44, textAlign: "right", fontSize: 13, color: "var(--text-muted)", flexShrink: 0 }}>
                {song.weeks}
              </div>
              <div style={{ width: 44, textAlign: "right", fontSize: 13, color: "var(--text-muted)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                #{song.peak}
              </div>
              <div
                style={{
                  width: 40,
                  textAlign: "right",
                  fontSize: 13,
                  fontWeight: song.numberOnes > 0 ? 700 : 400,
                  flexShrink: 0,
                  color: song.numberOnes > 0 ? "var(--text)" : "var(--text-disabled)",
                }}
              >
                {song.numberOnes > 0 ? song.numberOnes : "-"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

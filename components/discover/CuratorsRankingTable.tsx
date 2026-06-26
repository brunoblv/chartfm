"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { FollowButton } from "@/components/ui/FollowButton";
import { MovementBadge } from "@/components/ui/MovementBadge";
import { DesktopPosCell } from "@/components/chart/DesktopPosCell";
import {
  DESKTOP_COVER_SIZE,
  MOBILE_POS_WIDTH,
  MOBILE_ROW_GAP,
  MOBILE_STATS_INDENT,
  desktopCoverGridColumn,
  desktopListGrid,
} from "@/lib/chart-list-layout";
import { chartStatsLabels } from "@/lib/chart-cadence";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useTranslations } from "@/hooks/useTranslations";
import type { CuratorRankingEntry } from "@/lib/curators-snapshot";

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
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 2,
        padding: compact ? "4px 8px" : "6px 10px",
        borderRadius: 8,
        background: "var(--fill-inset)",
        minWidth: compact ? 44 : 52,
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: "var(--text-muted)", textTransform: "uppercase" }}>
        {label}
      </span>
      <span style={{ fontSize: compact ? 12 : 13, fontWeight: 700, color: accent ?? "var(--text)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  );
}

type Props = {
  entries: CuratorRankingEntry[];
  followingIds: string[];
};

export function CuratorsRankingTable({ entries, followingIds }: Props) {
  const { t } = useTranslations();
  const isMobile = useIsMobile();
  const statsLabels = chartStatsLabels(false);
  const followingSet = new Set(followingIds);

  if (entries.length === 0) {
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
        {t("discover.curatorsEmpty")}
      </div>
    );
  }

  const avatarSize = DESKTOP_COVER_SIZE;
  const gridColumns = desktopListGrid(desktopCoverGridColumn(avatarSize), "80px 80px 60px 90px 72px minmax(120px, auto)");

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
        {entries.map((entry) => (
          <div
            key={entry.userId}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: "10px 12px",
              borderBottom: "1px solid var(--divider-soft)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: MOBILE_ROW_GAP, minWidth: 0 }}>
              <div style={{ width: MOBILE_POS_WIDTH, textAlign: "center", flexShrink: 0, alignSelf: "flex-start" }}>
                <div
                  style={{
                    fontSize: entry.position <= 3 ? 20 : 16,
                    fontWeight: 800,
                    letterSpacing: "-0.04em",
                    color: "var(--text)",
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1,
                  }}
                >
                  {entry.position}
                </div>
                <div style={{ marginTop: 4, display: "flex", justifyContent: "center" }}>
                  <MovementBadge status={entry.status} delta={entry.delta} compact />
                </div>
              </div>
              <Link href={`/profile/${entry.handle}`} style={{ lineHeight: 0, flexShrink: 0 }}>
                <Avatar user={{ name: entry.name, avatar: entry.avatarColor }} imageUrl={entry.image} size={avatarSize} />
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link
                  href={`/profile/${entry.handle}`}
                  style={{
                    display: "block",
                    fontSize: 14,
                    fontWeight: 700,
                    lineHeight: 1.25,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textDecoration: "none",
                    color: "var(--text)",
                  }}
                >
                  {entry.name}
                </Link>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>@{entry.handle}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, paddingLeft: MOBILE_STATS_INDENT, flexWrap: "wrap" }}>
              <StatPill compact label={statsLabels.prevPeriodShort} value={entry.prevPos ?? "—"} />
              <StatPill compact label={statsLabels.tenurePill} value={entry.weeks} />
              <StatPill compact label="PICO" value={entry.peak} accent={entry.peak === 1 ? "var(--accent)" : undefined} />
              <StatPill compact label="#1s" value={entry.numberOnes > 0 ? `${entry.numberOnes}x` : "—"} />
              <StatPill compact label={t("discover.colScore")} value={entry.score} accent="var(--accent)" />
            </div>
            <div style={{ display: "flex", gap: 8, paddingLeft: MOBILE_STATS_INDENT }}>
              {entry.chartId ? (
                <Link href={`/chart/${entry.chartId}`} style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>
                  {t("discover.viewChart")}
                </Link>
              ) : null}
              <FollowButton targetId={entry.userId} initialFollowing={followingSet.has(entry.userId)} variant="outline" size="sm" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", overflow: "hidden" }}>
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
          t("discover.colPos"),
          "",
          t("discover.colCurator"),
          statsLabels.prevPeriodShort,
          statsLabels.tenureShort,
          "Pico",
          "#1s",
          t("discover.colScore"),
          "",
        ].map((header, index) => (
          <div
            key={index}
            style={{
              padding: "10px 8px",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            {header}
          </div>
        ))}
      </div>
      {entries.map((entry) => (
        <div
          key={entry.userId}
          style={{
            display: "grid",
            gridTemplateColumns: gridColumns,
            alignItems: "center",
            padding: "8px 20px",
            borderBottom: "1px solid var(--divider-soft)",
            gap: 0,
          }}
        >
          <DesktopPosCell position={entry.position}>
            <MovementBadge status={entry.status} delta={entry.delta} compact />
          </DesktopPosCell>
          <Link href={`/profile/${entry.handle}`} style={{ padding: "4px 8px 4px 0", lineHeight: 0 }}>
            <Avatar user={{ name: entry.name, avatar: entry.avatarColor }} imageUrl={entry.image} size={avatarSize} />
          </Link>
          <div style={{ minWidth: 0, padding: "0 12px" }}>
            <Link
              href={`/profile/${entry.handle}`}
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
              {entry.name}
            </Link>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>@{entry.handle}</div>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>
            {entry.prevPos ?? "—"}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>
            {entry.weeks}
          </div>
          <div style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", padding: "0 8px", display: "flex", alignItems: "center", gap: 3 }}>
            {entry.peak === 1 && (
              <span style={{ color: "var(--accent)", display: "inline-flex", alignItems: "center" }}>
                <Star size={12} color="currentColor" fill="currentColor" />
              </span>
            )}
            {entry.peak}
          </div>
          <div style={{ padding: "0 8px" }}>
            {entry.numberOnes > 0 ? (
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                {entry.numberOnes}x
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--text-disabled)" }}>—</div>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--accent)", padding: "0 8px" }}>
            {entry.score}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "0 8px" }}>
            {entry.chartId ? (
              <Link href={`/chart/${entry.chartId}`} style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>
                {t("discover.viewChart")}
              </Link>
            ) : null}
            <FollowButton targetId={entry.userId} initialFollowing={followingSet.has(entry.userId)} variant="outline" size="sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

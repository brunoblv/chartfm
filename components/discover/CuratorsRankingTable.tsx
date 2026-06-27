"use client";

import Link from "next/link";
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
  const gridColumns = desktopListGrid(
    desktopCoverGridColumn(avatarSize),
    "56px 64px 96px 72px minmax(120px, auto)",
  );

  const headerLabels = [
    t("discover.colPos"),
    "",
    t("discover.colCurator"),
    t("discover.colCuratorChart"),
    t("discover.colCuratorLikes"),
    t("discover.colCuratorComments"),
    t("discover.colScore"),
    "",
  ] as const;

  function cellStyle(col: number, row: "header" | "body"): React.CSSProperties {
    const pad = row === "header" ? "6px 8px" : "0 8px";
    if (col === 0) return { padding: pad, textAlign: "center" };
    if (col === 2) return { padding: row === "header" ? "6px 8px" : "0 8px", minWidth: 0 };
    if (col >= 3 && col <= 6) return { padding: pad, textAlign: "center" };
    if (col === 7) return { padding: pad, textAlign: "right" };
    return { padding: pad };
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
              <StatPill compact label={t("discover.colCuratorChart")} value={entry.chartCount > 0 ? "✓" : "—"} />
              <StatPill compact label={t("discover.colCuratorLikes")} value={entry.likesGiven} />
              <StatPill compact label={t("discover.colCuratorComments")} value={entry.commentsWritten} />
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
          alignItems: "center",
          padding: "10px 20px",
          background: "var(--fill-inset)",
          borderBottom: "1px solid var(--divider)",
        }}
      >
        {headerLabels.map((header, index) => (
          <div
            key={index}
            style={{
              ...cellStyle(index, "header"),
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
          <div style={cellStyle(0, "body")}>
            <DesktopPosCell position={entry.position}>
              <MovementBadge status={entry.status} delta={entry.delta} compact />
            </DesktopPosCell>
          </div>
          <Link href={`/profile/${entry.handle}`} style={{ ...cellStyle(1, "body"), lineHeight: 0 }}>
            <Avatar user={{ name: entry.name, avatar: entry.avatarColor }} imageUrl={entry.image} size={avatarSize} />
          </Link>
          <div style={cellStyle(2, "body")}>
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
          <div style={{ ...cellStyle(3, "body"), fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
            {entry.chartCount > 0 ? (
              <span style={{ fontWeight: 700, color: "var(--accent)" }}>✓</span>
            ) : (
              <span style={{ color: "var(--text-disabled)" }}>—</span>
            )}
          </div>
          <div style={{ ...cellStyle(4, "body"), fontSize: 13, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
            {entry.likesGiven}
          </div>
          <div style={{ ...cellStyle(5, "body"), fontSize: 13, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
            {entry.commentsWritten}
          </div>
          <div style={{ ...cellStyle(6, "body"), fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--accent)" }}>
            {entry.score}
          </div>
          <div style={{ ...cellStyle(7, "body"), display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
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

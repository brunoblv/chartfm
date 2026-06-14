"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import type { MyTrlChartEntry } from "@/lib/mytrl-chart-engine";
import { buildSongPath } from "@/lib/music-routes";
import { MyTrlVideoClipList } from "@/components/mytrl/MyTrlVideoClipList";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MOBILE_LIST_BREAKPOINT } from "@/lib/chart-list-layout";

export type MyTrlWeekDay = {
  weekday: number;
  weekdayLabel: string;
  dateRange: string | null;
  computedAt: string | null;
  entries: MyTrlChartEntry[];
};

type Props = {
  weekLabel: string;
  days: MyTrlWeekDay[];
  videoClips: Record<string, string>;
  onSelectDay?: (weekday: number) => void;
};

function DayColumn({
  day,
  videoClips,
  onSelectDay,
}: {
  day: MyTrlWeekDay;
  videoClips: Record<string, string>;
  onSelectDay?: (weekday: number) => void;
}) {
  const hasData = day.entries.length > 0;

  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        background: "var(--surface)",
        borderRadius: 16,
        border: "1px solid var(--divider)",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <header
        style={{
          padding: "14px 14px 12px",
          borderBottom: "1px solid var(--divider)",
          background: "linear-gradient(180deg, var(--fill-inset) 0%, var(--surface) 100%)",
        }}
      >
        <button
          type="button"
          onClick={() => onSelectDay?.(day.weekday)}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            background: "none",
            border: "none",
            padding: 0,
            cursor: onSelectDay ? "pointer" : "default",
            color: "inherit",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.02em" }}>{day.weekdayLabel}</div>
          {day.dateRange ? (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.35 }}>{day.dateRange}</div>
          ) : (
            <div style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 4 }}>Sem parada</div>
          )}
        </button>
        {hasData && day.entries[0] && (
          <div style={{ marginTop: 12 }}>
            <Link
              href={
                day.entries[0].spotifyId
                  ? buildSongPath({
                      title: day.entries[0].track,
                      artist: day.entries[0].artist,
                      spotifyId: day.entries[0].spotifyId,
                    })
                  : "#"
              }
              style={{ display: "block", textDecoration: "none", color: "inherit" }}
            >
              <div
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  background: "var(--accent-tint)",
                  border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                }}
              >
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)" }}>
                  #1 do dia
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {day.entries[0].track}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {day.entries[0].artist}
                </div>
              </div>
            </Link>
          </div>
        )}
      </header>
      <div style={{ flex: 1 }}>
        {hasData ? (
          <MyTrlVideoClipList entries={day.entries} videoClips={videoClips} compact />
        ) : (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            Gere a parada deste dia para preencher a coluna.
          </div>
        )}
      </div>
    </article>
  );
}

export function MyTrlWeekView({ weekLabel, days, videoClips, onSelectDay }: Props) {
  const isMobile = useIsMobile(MOBILE_LIST_BREAKPOINT);
  const filledDays = days.filter((d) => d.entries.length > 0).length;

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px" }}>
          <CalendarDays size={18} color="var(--accent)" />
          <span style={{ fontSize: 16, fontWeight: 700 }}>{weekLabel}</span>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            · {filledDays}/5 dias
          </span>
        </div>
        <div
          style={{
            display: "flex",
            gap: 14,
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            paddingBottom: 8,
            margin: "0 -4px",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {days.map((day) => (
            <div
              key={day.weekday}
              style={{
                flex: "0 0 min(88vw, 340px)",
                scrollSnapAlign: "start",
              }}
            >
              <DayColumn day={day} videoClips={videoClips} onSelectDay={onSelectDay} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CalendarDays size={20} color="var(--accent)" />
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em" }}>{weekLabel}</span>
        </div>
        <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
          {filledDays} de 5 dias com parada
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 14,
          alignItems: "stretch",
        }}
      >
        {days.map((day) => (
          <DayColumn key={day.weekday} day={day} videoClips={videoClips} onSelectDay={onSelectDay} />
        ))}
      </div>
    </div>
  );
}

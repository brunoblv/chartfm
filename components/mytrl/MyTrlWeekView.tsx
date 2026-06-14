"use client";

import { CalendarDays, ChevronRight } from "lucide-react";
import type { MyTrlChartEntry } from "@/lib/mytrl-chart-engine";
import { MyTrlVideoClipList } from "@/components/mytrl/MyTrlVideoClipList";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MOBILE_LIST_BREAKPOINT } from "@/lib/chart-list-layout";

export type MyTrlWeekDay = {
  weekday: number;
  weekdayLabel: string;
  dateRange: string | null;
  scoringWindow?: string | null;
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
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            width: "100%",
            textAlign: "left",
            background: "none",
            border: "none",
            padding: 0,
            cursor: onSelectDay ? "pointer" : "default",
            color: "inherit",
            gap: 8,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.02em" }}>{day.weekdayLabel}</div>
            {day.dateRange ? (
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginTop: 4, lineHeight: 1.35 }}>
                {day.dateRange}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 4 }}>Sem parada</div>
            )}
            {day.scoringWindow && (
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.35 }}>
                Janela: {day.scoringWindow}
              </div>
            )}
          </div>
          {onSelectDay && hasData && (
            <ChevronRight size={18} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 2 }} />
          )}
        </button>
      </header>
      <div style={{ flex: 1 }}>
        {hasData ? (
          <>
            <MyTrlVideoClipList entries={day.entries} videoClips={videoClips} preview maxEntries={5} />
            {day.entries.length > 5 && onSelectDay && (
              <button
                type="button"
                onClick={() => onSelectDay(day.weekday)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px 12px",
                  border: "none",
                  borderTop: "1px solid var(--divider-soft)",
                  background: "var(--fill-inset)",
                  color: "var(--accent)",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                Ver top 10 completo
              </button>
            )}
          </>
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
          {filledDays} de 5 dias com parada · toque em um dia para ver o top 10 completo
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

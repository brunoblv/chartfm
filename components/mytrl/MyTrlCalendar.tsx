"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type TimelineEntry = {
  weekday: number;
  weekIndex: number;
  edition?: {
    weekdayLabel: string;
    dayOfMonth: number;
    monthLabel: string;
    year: number;
    fullLabel: string;
    shortLabel: string;
  };
  computedAt: string;
};

type Props = {
  timeline: TimelineEntry[];
  currentIndex: number;
  onSelect: (index: number) => void;
};

const MONTH_NAMES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const DAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function dateFromEdition(weekday: number, weekIndex: number): Date {
  const year = Math.floor(weekIndex / 100);
  const week = weekIndex % 100;
  const jan4 = new Date(year, 0, 4);
  const jan4Dow = jan4.getDay() || 7;
  const week1Monday = new Date(year, 0, 4 - jan4Dow + 1);
  const targetMonday = new Date(week1Monday);
  targetMonday.setDate(week1Monday.getDate() + (week - 1) * 7);
  const result = new Date(targetMonday);
  result.setDate(targetMonday.getDate() + weekday - 1);
  return result;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthWeeks(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const weeks: Date[][] = [];
  let cursor = mondayOf(firstDay);
  while (cursor <= lastDay) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(cursor);
      d.setDate(cursor.getDate() + i);
      week.push(d);
    }
    weeks.push(week);
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

export function MyTrlCalendar({ timeline, currentIndex, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Build a map from date key → timeline index
  const dateMap = React.useMemo(() => {
    const map = new Map<string, number>();
    timeline.forEach((entry, idx) => {
      const d = dateFromEdition(entry.weekday, entry.weekIndex);
      map.set(toDateKey(d), idx);
    });
    return map;
  }, [timeline]);

  const currentEntry = currentIndex >= 0 ? timeline[currentIndex] : null;
  const currentDate = currentEntry
    ? dateFromEdition(currentEntry.weekday, currentEntry.weekIndex)
    : today;

  const [viewYear, setViewYear] = useState(currentDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(currentDate.getMonth());

  // Update view when current edition changes
  useEffect(() => {
    if (currentEntry) {
      const d = dateFromEdition(currentEntry.weekday, currentEntry.weekIndex);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [currentEntry]);

  useEffect(() => {
    setIsMobile(window.innerWidth < 640);
    const check = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!open || isMobile) return;
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, isMobile]);

  const weeks = getMonthWeeks(viewYear, viewMonth);

  const goToPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const goToNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const triggerLabel = currentEntry?.edition?.shortLabel ?? (
    currentEntry ? `${dateFromEdition(currentEntry.weekday, currentEntry.weekIndex).toLocaleDateString("pt-BR")}` : "Calendário"
  );

  const popoverStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        bottom: 0, left: 0, right: 0,
        zIndex: 1000,
        background: "var(--surface)",
        borderRadius: "20px 20px 0 0",
        boxShadow: "0 -4px 32px rgba(0,0,0,0.16)",
        padding: "12px 16px 32px",
        width: "100%",
      }
    : {
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        zIndex: 1000,
        background: "var(--surface)",
        borderRadius: 16,
        border: "1px solid var(--divider-strong)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        padding: 16,
        width: 300,
      };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          border: "1px solid var(--divider-strong)",
          borderRadius: 10,
          padding: "8px 12px",
          background: "var(--surface)",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text)",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-subtle)" }}>{triggerLabel}</span>
        <ChevronRight size={14} style={{ color: "var(--text-muted)", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
      </button>

      {open && isMobile && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999 }} />
      )}

      {open && (
        <div ref={popoverRef} style={popoverStyle}>
          {isMobile && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 12 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--divider-strong)", marginBottom: 8 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Selecionar edição</span>
            </div>
          )}

          {/* Navigation header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button
              type="button"
              onClick={goToPrev}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text)", display: "flex", alignItems: "center", padding: 4, borderRadius: 6 }}
            >
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
              {MONTH_NAMES_PT[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={goToNext}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text)", display: "flex", alignItems: "center", padding: 4, borderRadius: 6 }}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
            {DAY_NAMES.map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.04em", paddingBottom: 6 }}>
                {d}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 2 }}>
              {week.map((day, di) => {
                const isToday = sameDay(day, today);
                const inMonth = day.getMonth() === viewMonth;
                const isFuture = day > today;
                const key = toDateKey(day);
                const editionIdx = dateMap.get(key);
                const hasEdition = editionIdx !== undefined;
                const isSelected = currentEntry
                  ? sameDay(day, dateFromEdition(currentEntry.weekday, currentEntry.weekIndex))
                  : false;
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                return (
                  <div
                    key={di}
                    onClick={hasEdition && editionIdx !== undefined ? () => { onSelect(editionIdx); setOpen(false); } : undefined}
                    style={{
                      textAlign: "center",
                      fontSize: 12,
                      fontWeight: isToday || isSelected ? 800 : 500,
                      color: isFuture || !inMonth || isWeekend
                        ? "var(--text-disabled)"
                        : isSelected
                          ? "var(--accent)"
                          : "var(--text)",
                      padding: isMobile ? "9px 2px" : "5px 2px",
                      borderRadius: 6,
                      position: "relative",
                      cursor: hasEdition ? "pointer" : "default",
                      background: isSelected ? "var(--accent-tint)" : "transparent",
                    }}
                    onMouseEnter={e => {
                      if (hasEdition && !isSelected) (e.currentTarget as HTMLElement).style.background = "var(--fill-inset)";
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    {day.getDate()}
                    {!isFuture && !isWeekend && inMonth && (
                      <span
                        style={{
                          position: "absolute",
                          bottom: 2,
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: hasEdition ? "#1B873F" : "var(--fill-subtle)",
                        }}
                      />
                    )}
                    {isToday && (
                      <span
                        style={{
                          position: "absolute",
                          bottom: 2,
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          background: isSelected ? "var(--accent)" : "var(--text-muted)",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Legend */}
          <div style={{ display: "flex", gap: 12, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--divider)", fontSize: 11, color: "var(--text-muted)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#1B873F" }} />
              Com edição
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "var(--fill-subtle)" }} />
              Sem edição
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

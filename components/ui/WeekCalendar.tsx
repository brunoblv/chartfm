"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function isoWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return d.getUTCFullYear();
}

function weekIndex(date: Date): number {
  return isoWeekYear(date) * 100 + isoWeekNumber(date);
}

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toInputDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fromInputDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getMonthWeeks(year: number, month: number): Date[][] {
  // All weeks (Mon–Sun) that overlap this month
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

const MONTH_NAMES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const DAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

type Props = {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  label?: string;
};

export function WeekCalendar({ value, onChange, label = "Semana" }: Props) {
  const [open, setOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<false | "months" | "years">(false);
  const [publishedIndexes, setPublishedIndexes] = useState<Set<number>>(new Set());
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selectedDate = fromInputDate(value) ?? today;
  const selectedMonday = mondayOf(selectedDate);
  const selectedWi = weekIndex(selectedDate);

  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());
  const [yearRangeStart, setYearRangeStart] = useState(() => Math.floor(selectedDate.getFullYear() / 12) * 12);

  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fetch("/api/charts/weeks")
      .then((r) => r.json())
      .then((data: { weekIndexes?: number[] }) => {
        setPublishedIndexes(new Set(data.weekIndexes ?? []));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) { setPickerMode(false); setYearRangeStart(Math.floor(viewYear / 12) * 12); return; }
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const weeks = getMonthWeeks(viewYear, viewMonth);

  const goToPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const goToNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const handleSelectWeek = (day: Date) => {
    if (day > today) return;
    const monday = mondayOf(day);
    onChange(toInputDate(monday));
    setOpen(false);
  };

  const isoWk = isoWeekNumber(selectedDate);
  const isoYr = isoWeekYear(selectedDate);
  const triggerLabel = `${label} ${isoWk} · ${isoYr}`;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 10,
          padding: "8px 12px",
          background: "white",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
          color: "#1D1D1F",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: "#6B6B70" }}>{triggerLabel}</span>
        <ChevronRight size={14} style={{ color: "#86868B", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
      </button>

      {open && (
        <div
          ref={popoverRef}
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 1000,
            background: "white",
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.1)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            padding: 16,
            width: 300,
          }}
        >
          {/* Navigation header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => {
                if (pickerMode === "years") setYearRangeStart(s => s - 12);
                else if (pickerMode === "months") setViewYear(y => y - 1);
                else goToPrev();
              }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#1D1D1F", display: "flex", alignItems: "center", padding: 4, borderRadius: 6 }}
            >
              <ChevronLeft size={18} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {/* Month label — only in days mode */}
              {!pickerMode && (
                <button
                  type="button"
                  onClick={() => setPickerMode("months")}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#1D1D1F", borderRadius: 6, padding: "4px 6px", display: "flex", alignItems: "center", gap: 3 }}
                >
                  {MONTH_NAMES_PT[viewMonth]}
                  <ChevronRight size={12} style={{ color: "#86868B", transform: "rotate(90deg)" }} />
                </button>
              )}
              {/* Year label — in days/months mode clickable to years; in years mode just label */}
              {pickerMode === "years" ? (
                <span style={{ fontSize: 14, fontWeight: 700, color: "#1D1D1F", padding: "4px 6px" }}>
                  {yearRangeStart}–{yearRangeStart + 11}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => { setYearRangeStart(Math.floor(viewYear / 12) * 12); setPickerMode("years"); }}
                  style={{ background: pickerMode === "months" ? "rgba(0,0,0,0.06)" : "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#1D1D1F", borderRadius: 6, padding: "4px 6px", display: "flex", alignItems: "center", gap: 3 }}
                >
                  {viewYear}
                  <ChevronRight size={12} style={{ color: "#86868B", transform: pickerMode === "months" ? "rotate(-90deg)" : "rotate(90deg)", transition: "transform 0.15s" }} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                if (pickerMode === "years") setYearRangeStart(s => s + 12);
                else if (pickerMode === "months") setViewYear(y => y + 1);
                else goToNext();
              }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#1D1D1F", display: "flex", alignItems: "center", padding: 4, borderRadius: 6 }}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Year picker grid */}
          {pickerMode === "years" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 12 }}>
              {Array.from({ length: 12 }, (_, i) => yearRangeStart + i).map((yr) => {
                const isSelected = yr === viewYear;
                const isFuture = yr > today.getFullYear();
                return (
                  <button
                    key={yr}
                    type="button"
                    disabled={isFuture}
                    onClick={() => { setViewYear(yr); setPickerMode("months"); }}
                    style={{
                      background: isSelected ? "rgba(250,36,60,0.1)" : "rgba(0,0,0,0.03)",
                      border: isSelected ? "1.5px solid rgba(250,36,60,0.35)" : "1.5px solid transparent",
                      borderRadius: 8,
                      padding: "8px 4px",
                      cursor: isFuture ? "default" : "pointer",
                      fontSize: 13,
                      fontWeight: isSelected ? 700 : 500,
                      color: isFuture ? "#C7C7CC" : isSelected ? "#FA243C" : "#1D1D1F",
                      textAlign: "center",
                    }}
                  >
                    {yr}
                  </button>
                );
              })}
            </div>
          )}

          {/* Month picker grid */}
          {pickerMode === "months" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 12 }}>
              {MONTH_NAMES_PT.map((name, idx) => {
                const isCurrentMonth = idx === viewMonth;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => { setViewMonth(idx); setPickerMode(false); }}
                    style={{
                      background: isCurrentMonth ? "rgba(250,36,60,0.1)" : "rgba(0,0,0,0.03)",
                      border: isCurrentMonth ? "1.5px solid rgba(250,36,60,0.35)" : "1.5px solid transparent",
                      borderRadius: 8,
                      padding: "7px 4px",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: isCurrentMonth ? 700 : 500,
                      color: isCurrentMonth ? "#FA243C" : "#1D1D1F",
                      textAlign: "center",
                    }}
                  >
                    {name.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Day headers */}
          {!pickerMode && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr) 12px", marginBottom: 4 }}>
            {DAY_NAMES.map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "#86868B", letterSpacing: "0.04em", paddingBottom: 6 }}>
                {d}
              </div>
            ))}
            <div /> {/* dot column header */}
          </div>
          )}

          {/* Weeks */}
          {!pickerMode && weeks.map((week, wi) => {
            const monday = week[0];
            const wIdx = weekIndex(monday);
            const isSelected = wIdx === selectedWi;
            const hasParada = publishedIndexes.has(wIdx);
            const isFutureWeek = monday > today;

            return (
              <div
                key={wi}
                onClick={() => !isFutureWeek && handleSelectWeek(monday)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr) 12px",
                  alignItems: "center",
                  borderRadius: 8,
                  marginBottom: 2,
                  cursor: isFutureWeek ? "default" : "pointer",
                  background: isSelected ? "rgba(250,36,60,0.08)" : "transparent",
                  outline: isSelected ? "1.5px solid rgba(250,36,60,0.3)" : "none",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (!isFutureWeek && !isSelected) {
                    (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }
                }}
              >
                {week.map((day, di) => {
                  const isToday = sameDay(day, today);
                  const inMonth = day.getMonth() === viewMonth;
                  const isFuture = day > today;
                  return (
                    <div
                      key={di}
                      style={{
                        textAlign: "center",
                        fontSize: 12,
                        fontWeight: isToday ? 800 : 500,
                        color: isFuture ? "#C7C7CC" : !inMonth ? "#C7C7CC" : isSelected ? "#FA243C" : "#1D1D1F",
                        padding: "5px 2px",
                        borderRadius: 6,
                        position: "relative",
                      }}
                    >
                      {day.getDate()}
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
                            background: isSelected ? "#FA243C" : "#86868B",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
                {/* Status dot */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {!isFutureWeek && (
                    <span
                      style={{
                        display: "inline-block",
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: hasParada ? "#1B873F" : "#E5E5EA",
                        flexShrink: 0,
                      }}
                      title={hasParada ? "Parada publicada" : "Sem parada"}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {/* Legend */}
          {!pickerMode && <div style={{ display: "flex", gap: 12, marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.06)", fontSize: 11, color: "#86868B" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#1B873F" }} />
              Com parada
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#E5E5EA" }} />
              Sem parada
            </div>
          </div>}
        </div>
      )}
    </div>
  );
}

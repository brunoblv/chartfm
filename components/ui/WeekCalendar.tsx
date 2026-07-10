"use client";

import React, { useState, useEffect, useRef } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { buildDayIndexFromDate, formatDayPickerLabel } from "@/lib/chart-cadence";

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
  paradaId?: string | null;
  mode?: "weekly" | "daily";
};

export function WeekCalendar({ value, onChange, label = "Semana", paradaId, mode = "weekly" }: Props) {
  const [open, setOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<false | "months" | "years">(false);
  const [yearInput, setYearInput] = useState("");
  const [publishedIndexes, setPublishedIndexes] = useState<Set<number>>(new Set());
  const [isMobile, setIsMobile] = useState(false);
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
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const url = paradaId
      ? `/api/charts/weeks?paradaId=${encodeURIComponent(paradaId)}`
      : "/api/charts/weeks";
    fetch(url)
      .then((r) => r.json())
      .then((data: { weekIndexes?: number[] }) => {
        setPublishedIndexes(new Set(data.weekIndexes ?? []));
      })
      .catch(() => {});
  }, [paradaId]);

  useEffect(() => {
    if (!open) { setPickerMode(false); setYearRangeStart(Math.floor(viewYear / 12) * 12); return; }
    if (isMobile) return;
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

  const handleSelectWeek = (day: Date) => {
    if (day > today) return;
    if (mode === "daily") {
      onChange(toInputDate(day));
    } else {
      onChange(toInputDate(mondayOf(day)));
    }
    setOpen(false);
  };

  const isoWk = isoWeekNumber(selectedDate);
  const isoYr = isoWeekYear(selectedDate);
  const triggerLabel =
    mode === "daily" ? formatDayPickerLabel(selectedDate) : `${label} ${isoWk} · ${isoYr}`;

  const popoverStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
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

  const periodLabel = mode === "daily" ? "Dia da parada" : "Semana da parada";
  const helpText =
    mode === "daily"
      ? "Toque em um dia no calendário para escolher quando publicar - inclusive dias passados."
      : "Toque em uma semana no calendário para escolher quando publicar - inclusive semanas passadas.";

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={`${periodLabel}: clique para abrir o calendário e escolher outra data`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          border: open ? "1.5px solid rgba(250,36,60,0.35)" : "1px solid var(--divider-strong)",
          borderRadius: 10,
          padding: "8px 12px",
          background: open ? "var(--accent-tint)" : "var(--surface)",
          cursor: "pointer",
          whiteSpace: "nowrap",
          transition: "border-color 0.15s, background 0.15s",
        }}
      >
        <CalendarDays size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1, minWidth: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase", lineHeight: 1 }}>
            {periodLabel}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", lineHeight: 1.2 }}>{triggerLabel}</span>
        </div>
        <ChevronRight size={14} style={{ color: "var(--text-muted)", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }} />
      </button>

      {open && isMobile && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999 }}
        />
      )}

      {open && (
        <div
          ref={popoverRef}
          style={popoverStyle}
        >
          {/* Bottom sheet handle (mobile only) */}
          {isMobile && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 12 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--divider-strong)", marginBottom: 8 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                {mode === "daily" ? "Selecionar dia" : "Selecionar semana"}
              </span>
            </div>
          )}
          {/* Navigation header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => {
                if (pickerMode === "years") setYearRangeStart(s => s - 12);
                else if (pickerMode === "months") setViewYear(y => y - 1);
                else goToPrev();
              }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text)", display: "flex", alignItems: "center", padding: 4, borderRadius: 6 }}
            >
              <ChevronLeft size={18} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {/* Month label — only in days mode */}
              {!pickerMode && (
                <button
                  type="button"
                  onClick={() => setPickerMode("months")}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "var(--text)", borderRadius: 6, padding: "4px 6px", display: "flex", alignItems: "center", gap: 3 }}
                >
                  {MONTH_NAMES_PT[viewMonth]}
                  <ChevronRight size={12} style={{ color: "var(--text-muted)", transform: "rotate(90deg)" }} />
                </button>
              )}
              {/* Year label — in days/months mode clickable to years; in years mode just label */}
              {pickerMode === "years" ? (
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", padding: "4px 6px" }}>
                  {yearRangeStart}–{yearRangeStart + 11}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => { setYearRangeStart(Math.floor(viewYear / 12) * 12); setYearInput(""); setPickerMode("years"); }}
                  style={{ background: pickerMode === "months" ? "rgba(0,0,0,0.06)" : "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "var(--text)", borderRadius: 6, padding: "4px 6px", display: "flex", alignItems: "center", gap: 3 }}
                >
                  {viewYear}
                  <ChevronRight size={12} style={{ color: "var(--text-muted)", transform: pickerMode === "months" ? "rotate(-90deg)" : "rotate(90deg)", transition: "transform 0.15s" }} />
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
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text)", display: "flex", alignItems: "center", padding: 4, borderRadius: 6 }}
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
                      background: isSelected ? "var(--accent-tint)" : "var(--fill-inset)",
                      border: isSelected ? "1.5px solid rgba(250,36,60,0.35)" : "1.5px solid transparent",
                      borderRadius: 8,
                      padding: "8px 4px",
                      cursor: isFuture ? "default" : "pointer",
                      fontSize: 13,
                      fontWeight: isSelected ? 700 : 500,
                      color: isFuture ? "var(--text-disabled)" : isSelected ? "var(--accent)" : "var(--text)",
                      textAlign: "center",
                    }}
                  >
                    {yr}
                  </button>
                );
              })}
            </div>
          )}

          {/* Year direct input */}
          {pickerMode === "years" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, paddingTop: 4, borderTop: "1px solid var(--divider)" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>Ir para o ano:</span>
              <input
                type="number"
                min={1900}
                max={today.getFullYear()}
                value={yearInput}
                placeholder={String(viewYear)}
                onChange={(e) => setYearInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const yr = parseInt(yearInput, 10);
                    if (yr >= 1900 && yr <= today.getFullYear()) {
                      setViewYear(yr);
                      setYearRangeStart(Math.floor(yr / 12) * 12);
                      setPickerMode("months");
                    }
                  }
                }}
                style={{
                  flex: 1,
                  border: "1px solid var(--divider-strong)",
                  borderRadius: 6,
                  padding: "4px 8px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text)",
                  outline: "none",
                  width: 0,
                  appearance: "textfield",
                  background: "var(--surface)",
                }}
              />
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
                      background: isCurrentMonth ? "var(--accent-tint)" : "var(--fill-inset)",
                      border: isCurrentMonth ? "1.5px solid rgba(250,36,60,0.35)" : "1.5px solid transparent",
                      borderRadius: 8,
                      padding: "7px 4px",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: isCurrentMonth ? 700 : 500,
                      color: isCurrentMonth ? "var(--accent)" : "var(--text)",
                      textAlign: "center",
                    }}
                  >
                    {name.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Help text */}
          {!pickerMode && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                lineHeight: 1.45,
                marginBottom: 12,
                padding: "8px 10px",
                background: "var(--fill-inset)",
                borderRadius: 8,
              }}
            >
              {helpText}
            </div>
          )}

          {/* Day headers */}
          {!pickerMode && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr) 12px", marginBottom: 4 }}>
            {DAY_NAMES.map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.04em", paddingBottom: 6 }}>
                {d}
              </div>
            ))}
            <div
              title={mode === "daily" ? "Status do dia" : "Status da semana"}
              style={{ textAlign: "center", fontSize: 8, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.02em", paddingBottom: 6, lineHeight: 1.1 }}
            >
              {mode === "daily" ? "Dia" : "Sem."}
            </div>
          </div>
          )}

          {/* Weeks */}
          {!pickerMode && weeks.map((week, wi) => {
            const monday = week[0];
            const wIdx = weekIndex(monday);
            const isSelectedWeek = wIdx === selectedWi;
            const isFutureWeek = monday > today;

            return (
              <div
                key={wi}
                onClick={mode === "weekly" && !isFutureWeek ? () => handleSelectWeek(monday) : undefined}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr) 12px",
                  alignItems: "center",
                  borderRadius: 8,
                  marginBottom: 2,
                  cursor: mode === "weekly" && !isFutureWeek ? "pointer" : "default",
                  background: mode === "weekly" && isSelectedWeek ? "var(--accent-tint)" : "transparent",
                  outline: mode === "weekly" && isSelectedWeek ? "1.5px solid rgba(250,36,60,0.3)" : "none",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (mode === "weekly" && !isFutureWeek && !isSelectedWeek) {
                    (e.currentTarget as HTMLElement).style.background = "var(--fill-inset)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(mode === "weekly" && isSelectedWeek)) {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }
                }}
              >
                {week.map((day, di) => {
                  const isToday = sameDay(day, today);
                  const inMonth = day.getMonth() === viewMonth;
                  const isFuture = day > today;
                  const isSelectedDay = mode === "daily" && sameDay(day, selectedDate);
                  const dayIdx = buildDayIndexFromDate(day);
                  const hasParada = mode === "daily"
                    ? publishedIndexes.has(dayIdx)
                    : publishedIndexes.has(wIdx);
                  return (
                    <div
                      key={di}
                      onClick={
                        mode === "daily" && !isFuture
                          ? (e) => {
                              e.stopPropagation();
                              handleSelectWeek(day);
                            }
                          : undefined
                      }
                      style={{
                        textAlign: "center",
                        fontSize: 12,
                        fontWeight: isToday || isSelectedDay ? 800 : 500,
                        color: isFuture
                          ? "var(--text-disabled)"
                          : !inMonth
                            ? "var(--text-disabled)"
                            : isSelectedDay || (mode === "weekly" && isSelectedWeek)
                              ? "var(--accent)"
                              : "var(--text)",
                        padding: isMobile ? "9px 2px" : "5px 2px",
                        borderRadius: 6,
                        position: "relative",
                        cursor: mode === "daily" && !isFuture ? "pointer" : "default",
                        background: isSelectedDay ? "var(--accent-tint)" : "transparent",
                      }}
                    >
                      {day.getDate()}
                      {mode === "daily" && !isFuture && (
                        <span
                          style={{
                            position: "absolute",
                            bottom: 2,
                            left: "50%",
                            transform: "translateX(-50%)",
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: hasParada ? "#1B873F" : "var(--fill-subtle)",
                          }}
                        />
                      )}
                      {isToday && mode !== "daily" && (
                        <span
                          style={{
                            position: "absolute",
                            bottom: 2,
                            left: "50%",
                            transform: "translateX(-50%)",
                            width: 4,
                            height: 4,
                            borderRadius: "50%",
                            background:
                              isSelectedDay || (mode === "weekly" && isSelectedWeek) ? "var(--accent)" : "var(--text-muted)",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
                {/* Status dot */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {mode === "weekly" && !isFutureWeek && (
                    <span
                      style={{
                        display: "inline-block",
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: publishedIndexes.has(wIdx) ? "#1B873F" : "var(--fill-subtle)",
                        flexShrink: 0,
                      }}
                      title={publishedIndexes.has(wIdx) ? "Parada publicada" : "Sem parada"}
                    />
                  )}
                  {mode === "daily" && (
                    <span style={{ width: 7, height: 7, flexShrink: 0 }} />
                  )}
                </div>
              </div>
            );
          })}

          {/* Legend */}
          {!pickerMode && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--divider)" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
                Bolinhas ao lado
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.35 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#1B873F", flexShrink: 0 }} />
                  <span><strong style={{ color: "var(--text)", fontWeight: 600 }}>Verde</strong> - {mode === "daily" ? "dia" : "semana"} com parada publicada</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "var(--fill-subtle)", flexShrink: 0 }} />
                  <span><strong style={{ color: "var(--text)", fontWeight: 600 }}>Cinza</strong> - ainda sem parada (pode publicar agora)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

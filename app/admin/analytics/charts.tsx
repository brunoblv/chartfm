"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

// ── Infra compartilhada ──────────────────────────────────────────────────────

function useContainerWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

type TooltipState = { x: number; y: number; content: ReactNode } | null;

function Tooltip({ tip }: { tip: TooltipState }) {
  if (!tip) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: tip.x,
        top: tip.y,
        transform: "translate(-50%, calc(-100% - 10px))",
        background: "var(--surface-elevated)",
        border: "1px solid var(--divider-strong)",
        borderRadius: 8,
        padding: "7px 10px",
        fontSize: 12,
        color: "var(--text)",
        pointerEvents: "none",
        whiteSpace: "nowrap",
        boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
        zIndex: 5,
      }}
    >
      {tip.content}
    </div>
  );
}

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

const axisText: CSSProperties = { fontSize: 11, fill: "var(--text-muted)" };

// ── Cartão e tile ────────────────────────────────────────────────────────────

export function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 14, padding: "16px 18px", minWidth: 0 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", marginTop: 4 }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

// ── Gráfico de linhas (1–2 séries, crosshair + tooltip) ─────────────────────

export type LineSeries = { name: string; color: string; values: number[] };

export function LineChart({
  labels,
  series,
  height = 200,
  formatValue = (v: number) => String(v),
}: {
  labels: string[];
  series: LineSeries[];
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [tip, setTip] = useState<TooltipState>(null);

  const pad = { left: 36, right: 12, top: 10, bottom: 22 };
  const n = labels.length;
  const innerW = Math.max(width - pad.left - pad.right, 10);
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(...series.flatMap((s) => s.values), 1));
  const xAt = (i: number) => pad.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v: number) => pad.top + innerH - (v / max) * innerH;

  const labelEvery = Math.max(1, Math.ceil(n / Math.max(Math.floor(innerW / 56), 2)));

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const i = Math.min(n - 1, Math.max(0, Math.round(((mx - pad.left) / innerW) * (n - 1))));
    setHover(i);
    setTip({
      x: xAt(i),
      y: Math.min(...series.map((s) => yAt(s.values[i] ?? 0))),
      content: (
        <div>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>{labels[i]}</div>
          {series.map((s) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: s.color, display: "inline-block" }} />
              <span style={{ color: "var(--text-subtle)" }}>{s.name}:</span>
              <span style={{ fontWeight: 600 }}>{formatValue(s.values[i] ?? 0)}</span>
            </div>
          ))}
        </div>
      ),
    });
  }

  if (n === 0) return <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Sem dados ainda.</div>;

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      {series.length > 1 && (
        <div style={{ display: "flex", gap: 14, marginBottom: 8, flexWrap: "wrap" }}>
          {series.map((s) => (
            <span key={s.name} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-subtle)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: s.color, display: "inline-block" }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      {width > 0 && (
        <svg
          width={width}
          height={height}
          onMouseMove={onMove}
          onMouseLeave={() => {
            setHover(null);
            setTip(null);
          }}
          style={{ display: "block", overflow: "visible" }}
        >
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={pad.left} x2={width - pad.right} y1={yAt(max * f)} y2={yAt(max * f)} stroke="var(--divider)" strokeWidth={1} />
              <text x={pad.left - 6} y={yAt(max * f) + 4} textAnchor="end" style={axisText}>
                {formatValue(max * f)}
              </text>
            </g>
          ))}
          {labels.map((l, i) =>
            i % labelEvery === 0 ? (
              <text key={i} x={xAt(i)} y={height - 6} textAnchor="middle" style={axisText}>
                {l}
              </text>
            ) : null
          )}
          {hover !== null && (
            <line x1={xAt(hover)} x2={xAt(hover)} y1={pad.top} y2={pad.top + innerH} stroke="var(--divider-strong)" strokeWidth={1} />
          )}
          {series.map((s) => (
            <polyline
              key={s.name}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={s.values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ")}
            />
          ))}
          {hover !== null &&
            series.map((s) => (
              <circle key={s.name} cx={xAt(hover)} cy={yAt(s.values[hover] ?? 0)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
            ))}
        </svg>
      )}
      <Tooltip tip={tip} />
    </div>
  );
}

// ── Gráfico de barras (tooltip por barra, topo arredondado) ─────────────────

export function BarChart({
  labels,
  values,
  height = 180,
  color = "var(--ch1)",
  formatValue = (v: number) => String(v),
}: {
  labels: string[];
  values: number[];
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
}) {
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TooltipState>(null);
  const [hover, setHover] = useState<number | null>(null);

  const pad = { left: 36, right: 8, top: 8, bottom: 22 };
  const n = labels.length;
  const innerW = Math.max(width - pad.left - pad.right, 10);
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(...values, 1));
  const step = innerW / Math.max(n, 1);
  const barW = Math.min(28, Math.max(step - 2, 3)); // 2px de respiro entre barras
  const yAt = (v: number) => pad.top + innerH - (v / max) * innerH;
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(Math.floor(innerW / 48), 2)));

  function barPath(x: number, y: number, w: number, h: number) {
    const r = Math.min(4, w / 2, h); // topo arredondado, base reta
    const bottom = pad.top + innerH;
    return `M${x},${bottom} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${bottom} Z`;
  }

  if (n === 0) return <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Sem dados ainda.</div>;

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      {width > 0 && (
        <svg width={width} height={height} style={{ display: "block", overflow: "visible" }} onMouseLeave={() => { setTip(null); setHover(null); }}>
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={pad.left} x2={width - pad.right} y1={yAt(max * f)} y2={yAt(max * f)} stroke="var(--divider)" strokeWidth={1} />
              <text x={pad.left - 6} y={yAt(max * f) + 4} textAnchor="end" style={axisText}>
                {formatValue(max * f)}
              </text>
            </g>
          ))}
          {values.map((v, i) => {
            const cx = pad.left + i * step + step / 2;
            const x = cx - barW / 2;
            const y = yAt(v);
            return (
              <g key={i}>
                {/* alvo de hover maior que a barra */}
                <rect
                  x={pad.left + i * step}
                  y={pad.top}
                  width={step}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => {
                    setHover(i);
                    setTip({
                      x: cx,
                      y,
                      content: (
                        <div>
                          <div style={{ fontWeight: 700 }}>{labels[i]}</div>
                          <div>{formatValue(v)}</div>
                        </div>
                      ),
                    });
                  }}
                />
                {v > 0 && <path d={barPath(x, y, barW, innerH - (y - pad.top))} fill={color} opacity={hover === null || hover === i ? 1 : 0.45} style={{ pointerEvents: "none" }} />}
              </g>
            );
          })}
          {labels.map((l, i) =>
            i % labelEvery === 0 ? (
              <text key={i} x={pad.left + i * step + step / 2} y={height - 6} textAnchor="middle" style={axisText}>
                {l}
              </text>
            ) : null
          )}
        </svg>
      )}
      <Tooltip tip={tip} />
    </div>
  );
}

// ── Lista de barras horizontais (features, páginas) ─────────────────────────

export function HBarList({
  items,
  color = "var(--ch1)",
  formatValue = (v: number) => String(v),
}: {
  items: { label: string; value: number; sub?: string }[];
  color?: string;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  if (items.length === 0) return <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Sem dados ainda.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item) => (
        <div key={item.label}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, marginBottom: 4 }}>
            <span style={{ color: "var(--text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.label}
              {item.sub && <span style={{ color: "var(--text-muted)", fontWeight: 400, marginLeft: 6 }}>{item.sub}</span>}
            </span>
            <span style={{ color: "var(--text-subtle)", fontVariantNumeric: "tabular-nums" }}>{formatValue(item.value)}</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: "var(--fill-subtle)", overflow: "hidden" }}>
            <div style={{ width: `${(item.value / max) * 100}%`, height: "100%", borderRadius: 4, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Grade de coortes (sequencial: uma matiz, claro→escuro) ──────────────────

export function CohortGrid({ cohorts }: { cohorts: { week: string; size: number; cells: (number | null)[] }[] }) {
  const visible = cohorts.filter((c) => c.size > 0);
  if (visible.length === 0) return <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nenhum cadastro nas últimas 12 semanas.</div>;
  const maxOffsets = Math.max(...visible.map((c) => c.cells.filter((x) => x !== null).length));

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "separate", borderSpacing: 2, fontSize: 11, minWidth: 420 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "4px 8px 4px 0", color: "var(--text-muted)", fontWeight: 600 }}>Coorte</th>
            <th style={{ padding: "4px 6px", color: "var(--text-muted)", fontWeight: 600 }}>Users</th>
            {Array.from({ length: maxOffsets }, (_, i) => (
              <th key={i} style={{ padding: "4px 2px", color: "var(--text-muted)", fontWeight: 600, minWidth: 36 }}>
                S{i}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((c) => (
            <tr key={c.week}>
              <td style={{ padding: "2px 8px 2px 0", color: "var(--text)", fontWeight: 600, whiteSpace: "nowrap" }}>{c.week}</td>
              <td style={{ padding: "2px 6px", textAlign: "center", color: "var(--text-subtle)" }}>{c.size}</td>
              {c.cells.slice(0, maxOffsets).map((pct, i) => {
                if (pct === null) return <td key={i} />;
                const mix = 8 + pct * 0.8; // 8%–88% da matiz sobre a superfície
                return (
                  <td
                    key={i}
                    title={`Semana ${i}: ${pct}% postaram chart`}
                    style={{
                      textAlign: "center",
                      padding: "6px 2px",
                      borderRadius: 6,
                      background: `color-mix(in srgb, var(--ch1) ${mix}%, var(--surface))`,
                      color: pct > 55 ? "#FFFFFF" : "var(--text)",
                      fontVariantNumeric: "tabular-nums",
                      minWidth: 36,
                    }}
                  >
                    {pct}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

function useContainerWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

type Tip = { x: number; y: number; content: ReactNode } | null;

function Tooltip({ tip }: { tip: Tip }) {
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

const axisText: CSSProperties = { fontSize: 11, fill: "var(--text-muted)" };

function niceStep(span: number, ticks: number): number {
  const raw = Math.max(span, 1) / ticks;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/** Domínio arredondado em passos "bonitos" — o total de seguidores não começa em zero. */
function niceDomain(min: number, max: number, ticks = 4, includeZero = false) {
  let lo = includeZero ? Math.min(min, 0) : min;
  let hi = includeZero ? Math.max(max, 0) : max;
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const step = niceStep(hi - lo, ticks);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const values: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) values.push(v);
  return { lo, hi, values };
}

const defaultFmt = (v: number) => Math.round(v).toLocaleString("pt-BR");

export function FollowerLineChart({
  labels,
  values,
  height = 220,
  fmt = defaultFmt,
}: {
  labels: string[];
  values: number[];
  height?: number;
  fmt?: (v: number) => string;
}) {
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [tip, setTip] = useState<Tip>(null);
  const n = values.length;
  const pad = { left: 44, right: 12, top: 10, bottom: 24 };
  const innerW = Math.max(width - pad.left - pad.right, 10);
  const innerH = height - pad.top - pad.bottom;
  const { lo, hi, values: ticks } = niceDomain(Math.min(...values), Math.max(...values));
  const xAt = (i: number) => pad.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v: number) => pad.top + innerH - ((v - lo) / (hi - lo)) * innerH;
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(Math.floor(innerW / 60), 2)));

  if (n === 0) return null;

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          style={{ display: "block", overflow: "visible" }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const i = Math.min(n - 1, Math.max(0, Math.round(((e.clientX - rect.left - pad.left) / innerW) * (n - 1))));
            setHover(i);
            setTip({
              x: xAt(i),
              y: yAt(values[i]),
              content: (
                <div>
                  <div style={{ fontWeight: 700 }}>{labels[i]}</div>
                  <div>{fmt(values[i])}</div>
                </div>
              ),
            });
          }}
          onMouseLeave={() => {
            setHover(null);
            setTip(null);
          }}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.left} x2={width - pad.right} y1={yAt(v)} y2={yAt(v)} stroke="var(--divider)" strokeWidth={1} />
              <text x={pad.left - 8} y={yAt(v) + 4} textAnchor="end" style={axisText}>
                {fmt(v)}
              </text>
            </g>
          ))}
          {labels.map((l, i) =>
            i % labelEvery === 0 ? (
              <text key={i} x={xAt(i)} y={height - 6} textAnchor="middle" style={axisText}>
                {l}
              </text>
            ) : null,
          )}
          {hover !== null && <line x1={xAt(hover)} x2={xAt(hover)} y1={pad.top} y2={pad.top + innerH} stroke="var(--divider-strong)" />}
          <polyline
            fill="none"
            stroke="var(--ig-line)"
            strokeWidth={2.25}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ")}
          />
          {hover !== null && <circle cx={xAt(hover)} cy={yAt(values[hover])} r={4} fill="var(--ig-line)" stroke="var(--surface)" strokeWidth={2} />}
        </svg>
      )}
      <Tooltip tip={tip} />
    </div>
  );
}

/** Barras com sinal: verde acima de zero, vermelho abaixo; dia sem dado não desenha barra. */
export function SignedBarChart({
  labels,
  values,
  height = 220,
  fmt = defaultFmt,
}: {
  labels: string[];
  values: (number | null)[];
  height?: number;
  fmt?: (v: number) => string;
}) {
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip>(null);
  const [hover, setHover] = useState<number | null>(null);
  const n = values.length;
  const nums = values.map((v) => v ?? 0);
  const pad = { left: 44, right: 8, top: 10, bottom: 24 };
  const innerW = Math.max(width - pad.left - pad.right, 10);
  const innerH = height - pad.top - pad.bottom;
  const { lo, hi, values: ticks } = niceDomain(Math.min(...nums), Math.max(...nums), 4, true);
  const step = innerW / Math.max(n, 1);
  const barW = Math.min(22, Math.max(step - 2, 2));
  const yAt = (v: number) => pad.top + innerH - ((v - lo) / (hi - lo)) * innerH;
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(Math.floor(innerW / 60), 2)));

  if (n === 0) return null;

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      {width > 0 && (
        <svg width={width} height={height} style={{ display: "block", overflow: "visible" }} onMouseLeave={() => { setTip(null); setHover(null); }}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.left} x2={width - pad.right} y1={yAt(v)} y2={yAt(v)} stroke={v === 0 ? "var(--divider-strong)" : "var(--divider)"} strokeWidth={1} />
              <text x={pad.left - 8} y={yAt(v) + 4} textAnchor="end" style={axisText}>
                {fmt(v)}
              </text>
            </g>
          ))}
          {values.map((v, i) => {
            const cx = pad.left + i * step + step / 2;
            const y0 = yAt(0);
            const y1 = yAt(v ?? 0);
            return (
              <g key={i}>
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
                      y: Math.min(y0, y1),
                      content: (
                        <div>
                          <div style={{ fontWeight: 700 }}>{labels[i]}</div>
                          <div>{v == null ? "—" : `${v > 0 ? "+" : ""}${fmt(v)}`}</div>
                        </div>
                      ),
                    });
                  }}
                />
                {v != null && v !== 0 && (
                  <rect
                    x={cx - barW / 2}
                    y={Math.min(y0, y1)}
                    width={barW}
                    height={Math.max(Math.abs(y1 - y0), 1.5)}
                    rx={Math.min(2, barW / 2)}
                    fill={v > 0 ? "var(--ig-pos)" : "var(--ig-neg)"}
                    opacity={hover === null || hover === i ? 1 : 0.45}
                    style={{ pointerEvents: "none" }}
                  />
                )}
              </g>
            );
          })}
          {labels.map((l, i) =>
            i % labelEvery === 0 ? (
              <text key={i} x={pad.left + i * step + step / 2} y={height - 6} textAnchor="middle" style={axisText}>
                {l}
              </text>
            ) : null,
          )}
        </svg>
      )}
      <Tooltip tip={tip} />
    </div>
  );
}

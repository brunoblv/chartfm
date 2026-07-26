import type { CSSProperties } from "react";

export type LowerThirdEntry = {
  position: number;
  title: string;
  artist: string;
  coverUrl: string | null;
  coverPalette: [string, string];
  coverSeed: number;
  status: "new" | "return" | "up" | "down" | "same";
  delta: number | null;
  peak: number;
  weeks: number;
  numberOnes: number;
};

export type LowerThirdVideoFormat = "landscape" | "portrait";

function sHue(seed: number): number {
  return Math.abs(seed * 31) % 360;
}

function LtCover({
  title,
  size,
  radius,
  imageUrl,
  palette,
  seed,
}: {
  title: string;
  size: number;
  radius: number;
  imageUrl: string | null;
  palette: [string, string];
  seed: number;
}) {
  if (imageUrl) {
    return (
      <div style={{ width: size, height: size, borderRadius: radius, flexShrink: 0, overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={title}
          crossOrigin="anonymous"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
    );
  }
  const hue = sHue(seed);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        flexShrink: 0,
        background: `linear-gradient(145deg, ${palette[0]}, ${palette[1] || `hsl(${(hue + 40) % 360},48%,46%)`})`,
        display: "grid",
        placeItems: "center",
        color: "#fff",
        fontWeight: 800,
        fontSize: size * 0.38,
        userSelect: "none",
      }}
    >
      {(title || "?")[0].toUpperCase()}
    </div>
  );
}

function LtLogo({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        background: "#FA243C",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="#fff">
        <rect x="3" y="13" width="4" height="8" rx="1.5" />
        <rect x="10" y="8" width="4" height="13" rx="1.5" />
        <rect x="17" y="4" width="4" height="17" rx="1.5" />
      </svg>
    </div>
  );
}

function LtMovement({
  status,
  delta,
  scale,
}: {
  status: LowerThirdEntry["status"];
  delta: number | null;
  scale: number;
}) {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 3 * scale,
    fontSize: 11 * scale,
    fontWeight: 700,
    letterSpacing: "0.02em",
    padding: `${3 * scale}px ${8 * scale}px`,
    borderRadius: 6 * scale,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
    flexShrink: 0,
  };
  const sz = 10 * scale;

  if (status === "new") {
    return <span style={{ ...base, background: "#fff", color: "#000" }}>NEW</span>;
  }
  if (status === "return") {
    return <span style={{ ...base, background: "rgba(255,255,255,0.15)", color: "#fff" }}>RET</span>;
  }
  if (status === "same") {
    return <span style={{ ...base, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)" }}>―</span>;
  }
  if (status === "up") {
    return (
      <span style={{ ...base, background: "rgba(46,181,80,0.22)", color: "#5FE08A" }}>
        <svg width={sz} height={sz} viewBox="0 0 10 10">
          <path d="M5 1 L9 8 L1 8 Z" fill="currentColor" />
        </svg>
        {delta}
      </span>
    );
  }
  return (
    <span style={{ ...base, background: "rgba(250,36,60,0.22)", color: "#FF8A96" }}>
      <svg width={sz} height={sz} viewBox="0 0 10 10">
        <path d="M5 9 L1 2 L9 2 Z" fill="currentColor" />
      </svg>
      {Math.abs(delta ?? 0)}
    </span>
  );
}

function LtStatCol({
  label,
  value,
  accent,
  scale,
}: {
  label: string;
  value: string;
  accent?: boolean;
  scale: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2 * scale,
        minWidth: 36 * scale,
      }}
    >
      <span
        style={{
          fontSize: 9 * scale,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 14 * scale,
          fontWeight: 700,
          color: accent ? "#FA243C" : "rgba(255,255,255,0.85)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

/** Lower third oficial (admin YouTube + Remotion videoparada). */
export function LowerThirdBar({
  entry,
  weekLabel,
  format,
  chartLabel = "Top 5 Global",
  scale: scaleOverride,
}: {
  entry: LowerThirdEntry;
  weekLabel: string;
  format: LowerThirdVideoFormat;
  /** Ex.: "Top 100 Global" — default mantém o texto do admin. */
  chartLabel?: string;
  /** Sobrescreve o scale derivado do formato (útil no Remotion em 1080p). */
  scale?: number;
}) {
  const portrait = format === "portrait";
  const scale = scaleOverride ?? (portrait ? 0.86 : 1);

  const coverSize = Math.round((portrait ? 60 : 72) * scale);
  const coverRadius = Math.round(12 * scale);
  const posSize = Math.round((portrait ? 34 : 40) * scale);
  const titleSize = Math.round((portrait ? 17 : 20) * scale);
  const artistSize = Math.round((portrait ? 12 : 14) * scale);
  const headerSize = Math.round(11 * scale);
  const accentW = Math.round(6 * scale);
  const bodyPadX = Math.round(20 * scale);
  const bodyPadY = Math.round((portrait ? 8 : 10) * scale);
  const logoSize = Math.round(16 * scale);
  const gap = Math.round(16 * scale);
  const baseScale = portrait ? 0.86 : 1;
  const titleMaxW = Math.round((portrait ? 220 : 280) * (scale / baseScale));

  const peak = entry.peak > 0 ? entry.peak : entry.position;
  const weeks = entry.weeks > 0 ? entry.weeks : 1;
  const ones = entry.numberOnes > 0 ? entry.numberOnes : 0;
  const onesLabel = ones > 0 ? `${ones}x` : "–";

  return (
    <div style={{ display: "flex", alignItems: "stretch" }}>
      <div
        style={{
          width: accentW,
          borderRadius: 4 * scale,
          background: "#FA243C",
          flexShrink: 0,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 0,
          background: "rgba(18,18,20,0.86)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderRadius: `0 ${14 * scale}px ${14 * scale}px 0`,
          boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8 * scale,
            padding: `${9 * scale}px ${bodyPadX}px 0`,
          }}
        >
          <LtLogo size={logoSize} />
          <span
            style={{
              fontSize: headerSize,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            {chartLabel} · {weekLabel}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap,
            padding: `${bodyPadY}px ${bodyPadX}px ${16 * scale}px`,
          }}
        >
          <span
            style={{
              fontSize: posSize,
              fontWeight: 800,
              color: "#fff",
              minWidth: 44 * scale,
              textAlign: "center",
              fontVariantNumeric: "tabular-nums",
              flexShrink: 0,
            }}
          >
            {entry.position}
          </span>

          <LtCover
            title={entry.title}
            size={coverSize}
            radius={coverRadius}
            imageUrl={entry.coverUrl}
            palette={entry.coverPalette}
            seed={entry.coverSeed}
          />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2 * scale,
              minWidth: 0,
              maxWidth: titleMaxW,
            }}
          >
            <span
              style={{
                fontSize: titleSize,
                fontWeight: 800,
                color: "#fff",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {entry.title}
            </span>
            <span
              style={{
                fontSize: artistSize,
                fontWeight: 500,
                color: "rgba(255,255,255,0.6)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {entry.artist}
            </span>
          </div>

          <div
            style={{
              width: 1,
              alignSelf: "stretch",
              background: "rgba(255,255,255,0.12)",
              margin: `${2 * scale}px 0`,
              flexShrink: 0,
            }}
          />

          <LtMovement status={entry.status} delta={entry.delta} scale={scale} />

          <div
            style={{
              width: 1,
              alignSelf: "stretch",
              background: "rgba(255,255,255,0.12)",
              margin: `${2 * scale}px 0`,
              flexShrink: 0,
            }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 10 * scale, flexShrink: 0 }}>
            <LtStatCol label="Pico" value={`#${peak}`} accent={peak === 1} scale={scale} />
            <LtStatCol label="Sem." value={String(weeks)} scale={scale} />
            <LtStatCol label="#1" value={onesLabel} accent={ones > 0} scale={scale} />
          </div>
        </div>
      </div>
    </div>
  );
}

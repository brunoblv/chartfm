import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ChartFMMark } from "./ChartFMMark";

export function Intro({ chartName, weekLabel }: { chartName: string; weekLabel: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoIn = spring({ frame, fps, config: { damping: 16, stiffness: 120 } });
  const titleIn = spring({ frame: frame - 8, fps, config: { damping: 18, stiffness: 110 } });
  const weekIn = spring({ frame: frame - 16, fps, config: { damping: 18, stiffness: 110 } });
  const fadeOut = interpolate(frame, [60, 74], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(ellipse at 50% 28%, #2a1014 0%, #0a0a0c 55%, #050506 100%)",
        opacity: fadeOut,
        justifyContent: "center",
        alignItems: "center",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", system-ui, sans-serif',
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 80%, rgba(250,36,60,0.22) 0%, transparent 55%)",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
          transform: `translateY(${interpolate(logoIn, [0, 1], [40, 0])}px)`,
          opacity: logoIn,
        }}
      >
        <ChartFMMark size={160} />
        <div
          style={{
            fontSize: 42,
            fontWeight: 800,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          ChartFM
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 280,
          left: 64,
          right: 64,
          textAlign: "center",
          transform: `translateY(${interpolate(titleIn, [0, 1], [30, 0])}px)`,
          opacity: titleIn,
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
          }}
        >
          {chartName}
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 32,
            fontWeight: 600,
            color: "rgba(255,255,255,0.55)",
            opacity: weekIn,
            transform: `translateY(${interpolate(weekIn, [0, 1], [16, 0])}px)`,
          }}
        >
          {weekLabel}
        </div>
      </div>
    </AbsoluteFill>
  );
}

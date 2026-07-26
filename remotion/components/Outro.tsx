import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ChartFMMark } from "./ChartFMMark";

export function Outro({
  chartName,
  siteUrl,
}: {
  chartName: string;
  siteUrl: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const inAnim = spring({ frame, fps, config: { damping: 16, stiffness: 110 } });
  const ctaIn = spring({ frame: frame - 10, fps, config: { damping: 18, stiffness: 100 } });

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(ellipse at 50% 35%, #2a1014 0%, #0a0a0c 60%, #050506 100%)",
        justifyContent: "center",
        alignItems: "center",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", system-ui, sans-serif',
        opacity: inAnim,
        transform: `scale(${interpolate(inAnim, [0, 1], [0.96, 1])})`,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <ChartFMMark size={140} />
        <div style={{ fontSize: 56, fontWeight: 800, color: "#fff", textAlign: "center" }}>
          {chartName}
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 34,
            fontWeight: 600,
            color: "rgba(255,255,255,0.65)",
            textAlign: "center",
            maxWidth: 780,
            lineHeight: 1.35,
            opacity: ctaIn,
          }}
        >
          Veja a parada completa no ChartFM
        </div>
        <div
          style={{
            marginTop: 28,
            padding: "16px 36px",
            borderRadius: 999,
            background: "linear-gradient(135deg, #FA243C, #FF5858)",
            color: "#fff",
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: "0.04em",
            opacity: ctaIn,
          }}
        >
          {siteUrl}
        </div>
      </div>
    </AbsoluteFill>
  );
}

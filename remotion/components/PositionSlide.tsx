import {
  AbsoluteFill,
  interpolate,
  Loop,
  OffthreadVideo,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { VideoparadaEntry } from "../data/testProps";
import { LowerThird } from "./LowerThird";

function resolveVideoSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  if (/^https?:\/\//i.test(src) || src.startsWith("data:")) return src;
  const rel = src.replace(/^\/+/, "").replace(/^public\//, "");
  return staticFile(rel);
}

export function PositionSlide({
  entry,
  chartName,
  weekLabel,
  format = "vertical",
  transitionInFrames = 0,
}: {
  entry: VideoparadaEntry;
  chartName: string;
  weekLabel: string;
  format?: "vertical" | "landscape";
  /** Frames da wipe de entrada — slide fica transparente até a saída das barras. */
  transitionInFrames?: number;
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const landscape = format === "landscape";
  const clipLoopFrames = landscape ? 11 * 30 : 6 * 30;
  const posFontSize = landscape ? 120 : 180;
  const posTop = landscape ? 48 : 72;
  const posLeft = landscape ? 48 : 56;
  const lowerBottom = landscape ? 48 : 100;
  const lowerSide = landscape ? 64 : 40;

  // Revela junto com a saída das barras (~últimos 28% da transição)
  const reveal =
    transitionInFrames <= 0
      ? 1
      : interpolate(
          frame,
          [Math.round(transitionInFrames * 0.72), transitionInFrames],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

  const animFrame = Math.max(0, frame - transitionInFrames);
  const enter = spring({ frame: animFrame, fps, config: { damping: 16, stiffness: 120 } });
  const exit = interpolate(frame, [durationInFrames - 14, durationInFrames - 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const posScale = spring({
    frame: Math.max(0, animFrame - 2),
    fps,
    config: { damping: 12, stiffness: 140 },
  });

  const debutPulse =
    entry.isDebut || entry.status === "new"
      ? interpolate(Math.sin(frame / 4), [-1, 1], [0.92, 1.05])
      : 1;

  const hasVideo = Boolean(resolveVideoSrc(entry.videoSrc));
  const videoSrc = resolveVideoSrc(entry.videoSrc);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 30%, ${entry.coverPalette[0]}55 0%, #0a0a0c 58%, #050506 100%)`,
        opacity: enter * exit * reveal,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", system-ui, sans-serif',
      }}
    >
      {hasVideo ? (
        <AbsoluteFill>
          {/* Clipe pré-cortado — tela cheia */}
          <Loop durationInFrames={clipLoopFrames}>
            <OffthreadVideo
              src={videoSrc!}
              volume={reveal}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </Loop>
          <AbsoluteFill
            style={{
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.75) 100%)",
            }}
          />
        </AbsoluteFill>
      ) : (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(160deg, ${entry.coverPalette[0]}, ${entry.coverPalette[1]}, #0a0a0c)`,
              opacity: 0.55,
              transform: `scale(${interpolate(enter, [0, 1], [1.08, 1])})`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.85) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "28%",
              left: "50%",
              width: 620,
              height: 620,
              marginLeft: -310,
              borderRadius: 28,
              overflow: "hidden",
              boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
              transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px) scale(${interpolate(enter, [0, 1], [0.92, 1])})`,
              opacity: enter,
              background: `linear-gradient(145deg, ${entry.coverPalette[0]}, ${entry.coverPalette[1]})`,
              display: "grid",
              placeItems: "center",
            }}
          >
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.9)", padding: 32 }}>
              <div style={{ fontSize: 28, fontWeight: 700, opacity: 0.7, marginBottom: 12 }}>
                CLIPE (placeholder)
              </div>
              <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.15 }}>{entry.title}</div>
              <div style={{ fontSize: 28, fontWeight: 600, opacity: 0.75, marginTop: 10 }}>
                {entry.artist}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Número da posição — canto superior esquerdo (spec) */}
      <div
        style={{
          position: "absolute",
          top: posTop,
          left: posLeft,
          fontSize: posFontSize,
          fontWeight: 900,
          color: "#fff",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.04em",
          textShadow: "0 12px 40px rgba(0,0,0,0.45)",
          transform: `scale(${posScale * debutPulse})`,
          transformOrigin: "top left",
          opacity: enter,
        }}
      >
        {entry.position}
      </div>

      {(entry.isDebut || entry.status === "new") && (
        <div
          style={{
            position: "absolute",
            top: landscape ? 56 : 96,
            right: landscape ? 48 : 56,
            padding: landscape ? "10px 22px" : "14px 28px",
            borderRadius: 14,
            background: "#fff",
            color: "#000",
            fontSize: landscape ? 28 : 36,
            fontWeight: 900,
            letterSpacing: "0.12em",
            transform: `scale(${debutPulse})`,
          }}
        >
          NEW
        </div>
      )}

      <div
        style={{
          position: "absolute",
          left: lowerSide,
          right: lowerSide,
          bottom: lowerBottom,
          maxWidth: landscape ? 1100 : undefined,
          transform: `translateY(${interpolate(enter, [0, 1], [50, 0])}px)`,
          opacity: enter,
        }}
      >
        <LowerThird
          entry={entry}
          chartName={chartName}
          weekLabel={weekLabel}
          format={format}
        />
      </div>
    </AbsoluteFill>
  );
}

import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const CHARTFM_RED = "#FA243C";
const BLACK = "#000000";
const WHITE = "#FFFFFF";

export type PositionTransitionDirection = "alternate" | "left" | "right";

export type PositionTransitionProps = {
  /** Próxima posição a revelar (ex.: 19). */
  position: number;
  /** Duração em frames (obrigatório — Sequence pai não altera useVideoConfig). */
  durationInFrames: number;
  /** Multiplicador de velocidade (1 = timing padrão da sequência). */
  speed?: number;
  colors?: {
    black?: string;
    red?: string;
    white?: string;
  };
  /** De onde as barras entram/saem. */
  direction?: PositionTransitionDirection;
};

type BarDef = {
  /** Fração da altura da tela (0–1). */
  heightFrac: number;
  /** Topo relativo (0–1). */
  topFrac: number;
  color: "black" | "red";
  /** +1 entra da esquerda, -1 da direita. */
  enterSign: 1 | -1;
  /** Atraso relativo 0–1 no ciclo de entrada. */
  delay: number;
  /** Velocidade relativa (1 = normal). */
  speedMul: number;
};

/** Barras com espessuras e ritmos diferentes — cobrem a tela com sobreposição. */
function buildBars(seed: number, red: string, black: string): (BarDef & { fill: string })[] {
  const raw: BarDef[] = [
    { heightFrac: 0.11, topFrac: -0.02, color: "black", enterSign: 1, delay: 0.0, speedMul: 1.15 },
    { heightFrac: 0.07, topFrac: 0.07, color: "red", enterSign: -1, delay: 0.04, speedMul: 1.0 },
    { heightFrac: 0.13, topFrac: 0.12, color: "black", enterSign: 1, delay: 0.02, speedMul: 1.25 },
    { heightFrac: 0.06, topFrac: 0.23, color: "red", enterSign: -1, delay: 0.08, speedMul: 0.95 },
    { heightFrac: 0.1, topFrac: 0.27, color: "black", enterSign: 1, delay: 0.05, speedMul: 1.1 },
    { heightFrac: 0.08, topFrac: 0.35, color: "red", enterSign: -1, delay: 0.0, speedMul: 1.2 },
    { heightFrac: 0.12, topFrac: 0.41, color: "black", enterSign: 1, delay: 0.06, speedMul: 1.05 },
    { heightFrac: 0.07, topFrac: 0.51, color: "red", enterSign: -1, delay: 0.03, speedMul: 1.15 },
    { heightFrac: 0.11, topFrac: 0.56, color: "black", enterSign: 1, delay: 0.01, speedMul: 0.9 },
    { heightFrac: 0.09, topFrac: 0.65, color: "red", enterSign: -1, delay: 0.07, speedMul: 1.18 },
    { heightFrac: 0.1, topFrac: 0.72, color: "black", enterSign: 1, delay: 0.04, speedMul: 1.0 },
    { heightFrac: 0.08, topFrac: 0.8, color: "red", enterSign: -1, delay: 0.02, speedMul: 1.22 },
    { heightFrac: 0.12, topFrac: 0.86, color: "black", enterSign: 1, delay: 0.05, speedMul: 1.08 },
    { heightFrac: 0.1, topFrac: 0.94, color: "red", enterSign: -1, delay: 0.0, speedMul: 1.12 },
  ];

  // Variação leve por posição (seed) sem mudar a estrutura
  return raw.map((b, i) => {
    const flip = (seed + i) % 3 === 0 ? -1 : 1;
    const enterSign = (b.enterSign * flip) as 1 | -1;
    return {
      ...b,
      enterSign,
      fill: b.color === "red" ? red : black,
    };
  });
}

function resolveEnterSign(
  barSign: 1 | -1,
  direction: PositionTransitionDirection,
): 1 | -1 {
  if (direction === "left") return 1;
  if (direction === "right") return -1;
  return barSign;
}

/**
 * Transição ChartFM entre posições: barras pretas/vermelhas + número gigante.
 * Duração = duração da Sequence pai (~0,6–1s).
 */
export function PositionTransition({
  position,
  durationInFrames,
  speed = 1,
  colors,
  direction = "alternate",
}: PositionTransitionProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const black = colors?.black ?? BLACK;
  const red = colors?.red ?? CHARTFM_RED;
  const white = colors?.white ?? WHITE;

  const bars = buildBars(position, red, black);
  const spd = Math.max(0.5, speed);

  // Fases em fração da duração (ajustadas pela velocidade)
  const enterEnd = Math.min(0.38, 0.38 / spd);
  const holdEnd = Math.min(0.72, enterEnd + 0.34 * Math.min(1.2, spd));
  // exit: holdEnd → 1

  const enterProgress = interpolate(frame, [0, durationInFrames * enterEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitProgress = interpolate(
    frame,
    [durationInFrames * holdEnd, durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Número: aparece perto do fim da entrada, some no início da saída
  const numberIn = spring({
    frame: frame - Math.round(durationInFrames * enterEnd * 0.55),
    fps,
    config: { damping: 14, stiffness: 160, mass: 0.7 },
  });
  const numberOut = interpolate(
    frame,
    [durationInFrames * holdEnd, durationInFrames * (holdEnd + 0.18)],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const numberOpacity = Math.min(1, numberIn) * numberOut;
  const numberScale = 0.72 + 0.28 * Math.min(1, numberIn);

  // Drift lento das barras durante a pausa (energia)
  const drift =
    Math.sin((frame / fps) * Math.PI * 2 * 1.4) * 6 +
    Math.sin((frame / fps) * Math.PI * 2 * 0.7) * 4;

  const fontSize = Math.round(width * 0.5);

  return (
    <AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
      {bars.map((bar, i) => {
        const sign = resolveEnterSign(bar.enterSign, direction);
        const localEnter = interpolate(
          enterProgress,
          [bar.delay, Math.min(1, bar.delay + 0.55 / bar.speedMul)],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const localExit = interpolate(
          exitProgress,
          [bar.delay * 0.5, Math.min(1, bar.delay * 0.5 + 0.55 / bar.speedMul)],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        // Fora → centro → fora (lado oposto na saída)
        const offX = (sign > 0 ? -1 : 1) * (width + 40);
        const enterX = offX * (1 - localEnter);
        const exitX = -offX * localExit;
        const x = enterX + exitX + drift * (i % 2 === 0 ? 1 : -0.6);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: -20,
              width: width + 40,
              top: Math.round(bar.topFrac * height),
              height: Math.max(8, Math.round(bar.heightFrac * height)),
              background: bar.fill,
              transform: `translateX(${x}px)`,
              boxShadow:
                bar.color === "red"
                  ? `0 0 ${Math.round(12 * localEnter)}px rgba(250,36,60,0.35)`
                  : undefined,
            }}
          />
        );
      })}

      <AbsoluteFill
        style={{
          display: "grid",
          placeItems: "center",
          opacity: numberOpacity,
          transform: `scale(${numberScale})`,
        }}
      >
        <span
          style={{
            fontSize,
            fontWeight: 900,
            color: white,
            lineHeight: 0.9,
            letterSpacing: "-0.06em",
            fontVariantNumeric: "tabular-nums",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", system-ui, sans-serif',
            textShadow: `
              0 0 40px rgba(250, 36, 60, 0.55),
              0 0 80px rgba(250, 36, 60, 0.28),
              0 18px 40px rgba(0, 0, 0, 0.55)
            `,
            userSelect: "none",
          }}
        >
          {position}
        </span>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

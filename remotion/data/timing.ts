/** Timing da composição Remotion — sem importar `remotion` (seguro p/ scripts Node). */

export const FPS = 30;

export const VERTICAL = {
  width: 1080,
  height: 1920,
  introFrames: 75,
  /** 3s no teste vertical (clipes Shorts = 6s). */
  positionFrames: 90,
  outroFrames: 75,
  /** ~0,8s — barras + número da próxima posição. */
  transitionFrames: 24,
} as const;

export const LANDSCAPE = {
  width: 1920,
  height: 1080,
  introFrames: 75,
  /** ~5s por posição no landscape (clipes YouTube = 11s). */
  positionFrames: 150,
  outroFrames: 75,
  /** ~0,9s. */
  transitionFrames: 27,
} as const;

/** Compat: defaults verticais. */
export const WIDTH = VERTICAL.width;
export const HEIGHT = VERTICAL.height;
export const INTRO_FRAMES = VERTICAL.introFrames;
export const POSITION_FRAMES = VERTICAL.positionFrames;
export const OUTRO_FRAMES = VERTICAL.outroFrames;
export const TRANSITION_FRAMES = VERTICAL.transitionFrames;

export function timingForFormat(format: "vertical" | "landscape" = "vertical") {
  return format === "landscape" ? LANDSCAPE : VERTICAL;
}

export function calcDurationFrames(
  entryCount: number,
  format: "vertical" | "landscape" = "vertical",
): number {
  const t = timingForFormat(format);
  if (entryCount <= 0) return t.introFrames + t.outroFrames;
  const positions =
    entryCount * t.positionFrames - (entryCount - 1) * t.transitionFrames;
  return t.introFrames + positions + t.outroFrames;
}

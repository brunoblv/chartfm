/** Layout compartilhado entre paradas pessoais e Global 100 */
export const DESKTOP_COVER_SIZE = 65;
export const LARGE_COVER_SIZE = 125;
export const DESKTOP_POS_COL = "72px";

export const MOBILE_COVER_SIZE = 48;
export const MOBILE_POS_WIDTH = 32;
export const MOBILE_ROW_GAP = 8;
export const MOBILE_TITLE_SIZE = 13;
export const MOBILE_ARTIST_SIZE = 11;
export const MOBILE_STATS_INDENT =
  MOBILE_POS_WIDTH + MOBILE_ROW_GAP + MOBILE_COVER_SIZE + MOBILE_ROW_GAP;

/** max-width: 640px — igual à página de parada pessoal */
export const MOBILE_LIST_BREAKPOINT = 641;

export function desktopCoverGridColumn(coverSize = DESKTOP_COVER_SIZE) {
  return `${coverSize + 16}px`;
}

export function desktopPosCol(isLarge = false) {
  return isLarge ? "80px" : DESKTOP_POS_COL;
}

export function desktopListGrid(coverCol: string, tailCols: string, isLarge = false) {
  return `${desktopPosCol(isLarge)} ${coverCol} minmax(0,1fr) ${tailCols}`;
}

export function desktopPosFontSize(position: number, opts?: { large?: boolean; emphasizeTop3?: boolean }) {
  const { large = false, emphasizeTop3 = true } = opts ?? {};
  if (emphasizeTop3 && position <= 3) return large ? 24 : 22;
  return large ? 22 : 20;
}

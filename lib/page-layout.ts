/** Padding horizontal padrão das seções (largura total da coluna principal). */
export const PAGE_GUTTER_X = {
  desktop: 40,
  mobile: 16,
} as const;

export function pageGutterPadding(isMobile: boolean): string {
  const x = isMobile ? PAGE_GUTTER_X.mobile : PAGE_GUTTER_X.desktop;
  return `0 ${x}px`;
}

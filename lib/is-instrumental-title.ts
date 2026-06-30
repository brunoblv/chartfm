/** Título de faixa instrumental (ex.: "Damocles - Instrumental"). */
export function isInstrumentalTitle(title: string | null | undefined): boolean {
  return /\binstrumental\b/i.test((title ?? "").trim());
}

/** Data civil em Brasília (UTC−3), usada como chave do snapshot diário. */
export function snapshotDayBrt(now: Date = new Date()): Date {
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate()));
}

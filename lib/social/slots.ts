/** América/São_Paulo é UTC-3 fixo (sem horário de verão desde 2019) — evita dependência de lib de timezone. */
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

function slotDateUtc(year: number, month: number, day: number, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(year, month, day, h, m, 0, 0) + BRT_OFFSET_MS);
}

/** Próximos horários de slot (em UTC) a partir de `from`, cobrindo `daysAhead` dias, em ordem crescente. */
export function upcomingSlots(slots: string[], from: Date, daysAhead = 5): Date[] {
  const brtNow = new Date(from.getTime() - BRT_OFFSET_MS);
  const y = brtNow.getUTCFullYear();
  const m = brtNow.getUTCMonth();
  const d = brtNow.getUTCDate();

  const result: Date[] = [];
  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
    for (const s of slots) {
      const dt = slotDateUtc(y, m, d + dayOffset, s);
      if (dt.getTime() >= from.getTime()) result.push(dt);
    }
  }
  return result.sort((a, b) => a.getTime() - b.getTime());
}

/** Chave do dia civil em América/São_Paulo (ex.: "2026-07-09"), para agrupar limites diários por plataforma. */
export function brtDayKey(date: Date): string {
  const brt = new Date(date.getTime() - BRT_OFFSET_MS);
  return `${brt.getUTCFullYear()}-${String(brt.getUTCMonth() + 1).padStart(2, "0")}-${String(brt.getUTCDate()).padStart(2, "0")}`;
}

/** Dia da semana em América/São_Paulo (0=domingo … 6=sábado). */
export function weekdayInBrt(date: Date): number {
  const brt = new Date(date.getTime() - BRT_OFFSET_MS);
  return brt.getUTCDay();
}

/** Horário do dia em América/São_Paulo, formato "HH:mm". */
export function timeOfDayInBrt(date: Date): string {
  const brt = new Date(date.getTime() - BRT_OFFSET_MS);
  return `${String(brt.getUTCHours()).padStart(2, "0")}:${String(brt.getUTCMinutes()).padStart(2, "0")}`;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Mínimo entre edições (~6.5 dias) — evita duas postagens na mesma semana. */
export const GENRE_PARADA_MIN_GAP_MS = WEEK_MS - 12 * 60 * 60 * 1000;

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Mistura extra — ids parecidos (ex. prefixos iguais) não colidem no mesmo slot.
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Componentes de calendário em BRT (UTC−3 fixo, sem horário de verão). */
export function brtCalendarParts(date: Date): {
  year: number;
  month: number;
  day: number;
  dow: number;
} {
  const shifted = new Date(date.getTime() - BRT_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    dow: shifted.getUTCDay(),
  };
}

/** Instante UTC para data/hora civil BRT. */
export function dateTimeBrtToUtc(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  return new Date(Date.UTC(year, monthIndex, day, hour + 3, minute, 0, 0));
}

/**
 * Slot semanal estável por parada: segunda–sexta, 08:00–22:45 BRT (passos de 15 min).
 * Derivado do id — cada uma das 22 cai em dia/hora distintos com alta probabilidade.
 */
export function genreParadaPublishSlot(paradaId: string, weekRef: Date): Date {
  const h = fnv1a(paradaId);
  const weekdayOffset = h % 5; // 0=seg … 4=sex
  const hour = 8 + ((h >>> 8) % 15); // 8..22
  const minute = ((h >>> 16) % 4) * 15; // 0, 15, 30, 45

  const parts = brtCalendarParts(weekRef);
  const daysFromMonday = parts.dow === 0 ? 6 : parts.dow - 1;
  const mondayUtcMidnight = Date.UTC(parts.year, parts.month, parts.day - daysFromMonday);
  const target = new Date(mondayUtcMidnight + weekdayOffset * 24 * 60 * 60 * 1000);

  return dateTimeBrtToUtc(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate(),
    hour,
    minute,
  );
}

/**
 * Próxima publicação da parada autoDecay: slot estável na semana seguinte à última,
 * avançando semanas se o slot cair cedo demais (< ~6.5 dias).
 */
export function nextGenreParadaPublishAt(paradaId: string, latestPublishedAt: Date): Date {
  let weekRef = new Date(latestPublishedAt.getTime() + WEEK_MS);
  for (let i = 0; i < 4; i++) {
    const slot = genreParadaPublishSlot(paradaId, weekRef);
    if (slot.getTime() >= latestPublishedAt.getTime() + GENRE_PARADA_MIN_GAP_MS) return slot;
    weekRef = new Date(weekRef.getTime() + WEEK_MS);
  }
  return genreParadaPublishSlot(paradaId, weekRef);
}

/**
 * Gerador de Top 10 diário (UMS Total Request @bruno) a partir do Top 20 semanal
 * (Under My Skin Video Countdown).
 *
 * COTAS POR FAIXA:
 *   #1       → 5×  · teto: pode chegar ao #1
 *   #2       → 5×  · teto: pode chegar ao #1-2
 *   #3-5     → 4-5× · teto: pode chegar ao #1-2
 *   #6-9     → 3×  · teto: nunca passa do #2
 *   #10-14   → 2×  · teto: nunca passa do #2
 *   #15-20   → 1×  · teto: nunca passa do #5 (faixa 5-8)
 *
 * REGRAS ESTRUTURAIS:
 *   1) #1 do dia: exclusivo para músicas das posições 1-5 do Top 20.
 *   2) #2 do dia: exclusivo para músicas das posições 6-10 do Top 20.
 *   3) Estreias (isNewEntry): só entram em #5, #7 ou #8, e tocam 1× na semana.
 *   4) Sem retorno direto ao #1: se a música não apareceu no dia útil anterior,
 *      ela não pode abrir em #1 (não se aplica à segunda-feira da janela).
 *   5) Sem #1 repetido: após bater #1, fica bloqueada para #1 nos demais dias.
 *   6) Máximo 1 estreia por dia a partir de terça-feira.
 */

export interface Top20Entry {
  pos: number;
  artist: string;
  song: string;
  isNewEntry?: boolean;
}

export interface DailyChartEntry {
  pos: number;
  artist: string;
  song: string;
  top20Pos: number;
  isDebut: boolean;
}

export type WeekdayLabel = "Segunda" | "Terça" | "Quarta" | "Quinta" | "Sexta";
export type WeeklyDailyCharts = Record<WeekdayLabel, DailyChartEntry[]>;

export const DISK_MTV_WEEKDAYS: WeekdayLabel[] = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
];

const N_DAYS = 5;
const SLOTS_PER_DAY = 10;
const DEBUT_ALLOWED_SLOTS = [5, 7, 8] as const;

interface BandConfig {
  range: [number, number];
  appearances: number[];
  peakTarget: [number, number];
  normalTarget: [number, number];
  absoluteCeiling: number;
}

const BANDS: BandConfig[] = [
  { range: [1, 1], appearances: [5], peakTarget: [1, 1], normalTarget: [2, 6], absoluteCeiling: 1 },
  { range: [2, 2], appearances: [5], peakTarget: [1, 2], normalTarget: [2, 6], absoluteCeiling: 1 },
  { range: [3, 5], appearances: [4, 5], peakTarget: [1, 2], normalTarget: [3, 7], absoluteCeiling: 1 },
  { range: [6, 9], appearances: [3], peakTarget: [2, 3], normalTarget: [4, 9], absoluteCeiling: 2 },
  { range: [10, 14], appearances: [2], peakTarget: [2, 4], normalTarget: [5, 10], absoluteCeiling: 2 },
  { range: [15, 20], appearances: [1], peakTarget: [5, 8], normalTarget: [5, 8], absoluteCeiling: 5 },
];

function getBand(top20Pos: number): BandConfig {
  const band = BANDS.find((b) => top20Pos >= b.range[0] && top20Pos <= b.range[1]);
  if (!band) throw new Error(`Posição de Top20 fora do intervalo esperado (1-20): ${top20Pos}`);
  return band;
}

function randInt(rnd: () => number, min: number, max: number): number {
  return Math.floor(rnd() * (max - min + 1)) + min;
}

function pickFrom<T>(rnd: () => number, arr: readonly T[]): T {
  return arr[randInt(rnd, 0, arr.length - 1)];
}

function shuffle<T>(rnd: () => number, arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randInt(rnd, 0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** PRNG determinístico (Mulberry32) para reproduzir a mesma semana. */
export function createSeededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

interface SongPlan {
  entry: Top20Entry;
  quota: number;
  band: BandConfig;
  isDebut: boolean;
}

const MAX_DEBUTS_PER_DAY = 1;

function allocateDays(plans: SongPlan[], rnd: () => number): Map<Top20Entry, number[]> {
  const capacity = [SLOTS_PER_DAY, SLOTS_PER_DAY, SLOTS_PER_DAY, SLOTS_PER_DAY, SLOTS_PER_DAY];
  const debutCapacity = [Infinity, MAX_DEBUTS_PER_DAY, MAX_DEBUTS_PER_DAY, MAX_DEBUTS_PER_DAY, MAX_DEBUTS_PER_DAY];
  const result = new Map<Top20Entry, number[]>();

  const debutPlans = plans.filter((p) => p.isDebut);
  const normalPlans = shuffle(rnd, plans.filter((p) => !p.isDebut)).sort((a, b) => b.quota - a.quota);

  for (const plan of shuffle(rnd, debutPlans)) {
    const candidates = [0, 1, 2, 3, 4].filter((d) => capacity[d] > 0 && debutCapacity[d] > 0);
    const pool = candidates.length > 0 ? candidates : [0, 1, 2, 3, 4].filter((d) => capacity[d] > 0);
    const day = pickFrom(rnd, pool);
    capacity[day] -= 1;
    debutCapacity[day] -= 1;
    result.set(plan.entry, [day]);
  }

  for (const plan of normalPlans) {
    const q = Math.min(plan.quota, N_DAYS);
    const favorEnd = plan.entry.pos <= 9;

    const dayScore = (d: number) => {
      let score = capacity[d] * 10;
      if (favorEnd) score += d * 2;
      score += rnd() * 3;
      return score;
    };

    const daysSorted = [0, 1, 2, 3, 4]
      .filter((d) => capacity[d] > 0)
      .sort((a, b) => dayScore(b) - dayScore(a));

    const chosen = daysSorted.slice(0, q);
    for (const d of chosen) capacity[d] -= 1;
    chosen.sort((a, b) => a - b);
    result.set(plan.entry, chosen);
  }

  return result;
}

interface DayCandidate {
  entry: Top20Entry;
  target: number;
  isPeak: boolean;
  isDebut: boolean;
}

export function generateWeeklyDailyCharts(
  top20: Top20Entry[],
  options: { random?: () => number } = {},
): WeeklyDailyCharts {
  const rnd = options.random ?? Math.random;

  if (top20.length === 0) throw new Error("Top20 vazio.");
  if (top20.length > 20) throw new Error("Top20 deve ter no máximo 20 músicas.");

  const sorted = [...top20].sort((a, b) => a.pos - b.pos);

  const plans: SongPlan[] = sorted.map((entry) => {
    const band = getBand(entry.pos);
    const isDebut = entry.isNewEntry === true;
    const quota = isDebut ? 1 : pickFrom(rnd, band.appearances);
    return { entry, quota, band, isDebut };
  });

  const daysOf = allocateDays(plans, rnd);

  const byDay: DayCandidate[][] = [[], [], [], [], []];
  for (const plan of plans) {
    const days = daysOf.get(plan.entry) ?? [];
    const peakDay = days.length > 0 ? days[days.length - 1] : -1;
    for (const d of days) {
      byDay[d].push({ entry: plan.entry, target: 0, isPeak: d === peakDay, isDebut: plan.isDebut });
    }
  }

  for (const dayCandidates of byDay) {
    for (const c of dayCandidates) {
      if (c.isDebut) {
        c.target = pickFrom(rnd, DEBUT_ALLOWED_SLOTS);
        continue;
      }
      const band = getBand(c.entry.pos);
      const [lo, hi] = c.isPeak ? band.peakTarget : band.normalTarget;
      c.target = randInt(rnd, lo, hi);
    }
  }

  const songsThatWereNumber1ThisWeek = new Set<number>();
  let previousDayArtists = new Set<number>();

  const result: WeeklyDailyCharts = {
    Segunda: [],
    Terça: [],
    Quarta: [],
    Quinta: [],
    Sexta: [],
  };

  DISK_MTV_WEEKDAYS.forEach((label, dayIndex) => {
    const candidates = byDay[dayIndex];

    const ranked = [...candidates].sort((a, b) => {
      if (a.target !== b.target) return a.target - b.target;
      if (a.entry.pos !== b.entry.pos) return a.entry.pos - b.entry.pos;
      return rnd() - 0.5;
    });

    const pool = new Set(ranked.map((c) => c.entry.pos));
    const slotAssignment = new Map<number, Top20Entry>();
    const debutSlotAssignment = new Set<number>();

    const wasPresentYesterday = (top20Pos: number) => previousDayArtists.has(top20Pos);

    function takeFromRanked(predicate: (c: DayCandidate) => boolean): DayCandidate | null {
      const idx = ranked.findIndex((c) => pool.has(c.entry.pos) && predicate(c));
      if (idx === -1) return null;
      const chosen = ranked[idx];
      pool.delete(chosen.entry.pos);
      return chosen;
    }

    // Slot #1: exclusivo faixa 1-5; sem debut; sem retorno direto (regra 4); sem repeat #1 (regra 5)
    const winner1 = takeFromRanked((c) => {
      if (c.isDebut) return false;
      if (c.entry.pos < 1 || c.entry.pos > 5) return false;
      if (songsThatWereNumber1ThisWeek.has(c.entry.pos)) return false;
      if (dayIndex > 0 && !wasPresentYesterday(c.entry.pos)) return false;
      return true;
    });
    if (winner1) {
      slotAssignment.set(1, winner1.entry);
      songsThatWereNumber1ThisWeek.add(winner1.entry.pos);
    }

    // Slot #2: exclusivo faixa 6-10; sem debut
    const winner2 = takeFromRanked((c) => {
      if (c.isDebut) return false;
      return c.entry.pos >= 6 && c.entry.pos <= 10;
    });
    if (winner2) {
      slotAssignment.set(2, winner2.entry);
    }

    // Slots de estreia: preenche #5, #7, #8 com quem está estreando hoje
    for (const slot of DEBUT_ALLOWED_SLOTS) {
      if (slotAssignment.has(slot)) continue;
      const winner = takeFromRanked((c) => c.isDebut && c.target === slot);
      if (winner) {
        slotAssignment.set(slot, winner.entry);
        debutSlotAssignment.add(winner.entry.pos);
      }
    }
    for (const slot of DEBUT_ALLOWED_SLOTS) {
      if (slotAssignment.has(slot)) continue;
      const winner = takeFromRanked((c) => c.isDebut);
      if (winner) {
        slotAssignment.set(slot, winner.entry);
        debutSlotAssignment.add(winner.entry.pos);
      }
    }

    // Slots restantes não-debut, respeitando teto absoluto da faixa
    const remainingSlots = Array.from({ length: SLOTS_PER_DAY }, (_, i) => i + 1).filter(
      (s) => !slotAssignment.has(s),
    );

    for (const slot of remainingSlots) {
      const chosen = takeFromRanked((c) => {
        if (c.isDebut) return false;
        const band = getBand(c.entry.pos);
        if (slot < band.absoluteCeiling) return false;
        if (slot === 1) {
          if (c.entry.pos < 1 || c.entry.pos > 5) return false;
          if (songsThatWereNumber1ThisWeek.has(c.entry.pos)) return false;
          if (dayIndex > 0 && !wasPresentYesterday(c.entry.pos)) return false;
        }
        if (slot === 2) {
          if (c.entry.pos < 6 || c.entry.pos > 10) return false;
        }
        return true;
      });
      if (chosen) {
        slotAssignment.set(slot, chosen.entry);
        if (slot === 1) songsThatWereNumber1ThisWeek.add(chosen.entry.pos);
      }
    }

    // Fallback de segurança para #1 e #2 ainda não preenchidos
    let unassignedSlots = Array.from({ length: SLOTS_PER_DAY }, (_, i) => i + 1).filter(
      (s) => !slotAssignment.has(s),
    );

    if (unassignedSlots.includes(1)) {
      const idx = ranked.findIndex((c) => {
        if (!pool.has(c.entry.pos)) return false;
        if (c.isDebut) return false;
        if (c.entry.pos < 1 || c.entry.pos > 5) return false;
        if (songsThatWereNumber1ThisWeek.has(c.entry.pos)) return false;
        if (dayIndex > 0 && !wasPresentYesterday(c.entry.pos)) return false;
        return true;
      });
      if (idx !== -1) {
        const chosen = ranked[idx].entry;
        slotAssignment.set(1, chosen);
        songsThatWereNumber1ThisWeek.add(chosen.pos);
        pool.delete(chosen.pos);
      }
    }

    if (unassignedSlots.includes(2) && !slotAssignment.has(2)) {
      const idx = ranked.findIndex((c) => {
        if (!pool.has(c.entry.pos)) return false;
        if (c.isDebut) return false;
        return c.entry.pos >= 6 && c.entry.pos <= 10;
      });
      if (idx !== -1) {
        const chosen = ranked[idx].entry;
        slotAssignment.set(2, chosen);
        pool.delete(chosen.pos);
      }
    }

    // Fallback genérico: preenche o que sobrar excluindo slots 1 e 2
    // (se nenhum elegível foi encontrado, o slot fica vazio — dia roda com 9 — em vez de violar as regras)
    unassignedSlots = Array.from({ length: SLOTS_PER_DAY }, (_, i) => i + 1).filter(
      (s) => !slotAssignment.has(s) && s !== 1 && s !== 2,
    );
    const unassignedEntries = ranked.filter((c) => pool.has(c.entry.pos));
    unassignedSlots.forEach((slot, idx) => {
      const c = unassignedEntries[idx];
      if (c) {
        slotAssignment.set(slot, c.entry);
        if (c.isDebut) debutSlotAssignment.add(c.entry.pos);
        pool.delete(c.entry.pos);
      }
    });

    const finalDay: DailyChartEntry[] = [];
    for (let slot = 1; slot <= SLOTS_PER_DAY; slot += 1) {
      const entry = slotAssignment.get(slot);
      if (!entry) continue;
      finalDay.push({
        pos: slot,
        artist: entry.artist,
        song: entry.song,
        top20Pos: entry.pos,
        isDebut: debutSlotAssignment.has(entry.pos),
      });
    }

    result[label] = finalDay;
    previousDayArtists = new Set(finalDay.map((e) => e.top20Pos));
  });

  return result;
}

/**
 * Gerador de Top 10 diário (Disk MTV / UMS Live Request) a partir de um Top 20 semanal.
 *
 * Faixas e cotas (planilha de referência):
 * | Top 20   | Clipes | Aparições/clip | Slots |
 * |----------|--------|----------------|-------|
 * | 1–2      | 2      | 5              | 10    |
 * | 3–5      | 3      | 4              | 12    |
 * | 6–9      | 4      | 3              | 12    |
 * | 10–14    | 5      | 2              | 10    |
 * | 15–20    | 6      | 1              | 6     |
 * Total: 50 slots = 5 dias × 10 faixas/dia
 */

export interface Top20Entry {
  pos: number;
  artist: string;
  song: string;
}

export interface DailyChartEntry {
  pos: number;
  artist: string;
  song: string;
  top20Pos: number;
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

interface BandConfig {
  range: [number, number];
  /** Aparições fixas por música na faixa (planilha). */
  appearances: number;
  peakTarget: [number, number];
  normalTarget: [number, number];
  absoluteCeiling: number;
}

const BANDS: BandConfig[] = [
  { range: [1, 2], appearances: 5, peakTarget: [1, 1], normalTarget: [2, 6], absoluteCeiling: 1 },
  { range: [3, 5], appearances: 4, peakTarget: [1, 2], normalTarget: [3, 7], absoluteCeiling: 1 },
  { range: [6, 9], appearances: 3, peakTarget: [2, 3], normalTarget: [4, 9], absoluteCeiling: 2 },
  { range: [10, 14], appearances: 2, peakTarget: [2, 4], normalTarget: [5, 10], absoluteCeiling: 2 },
  { range: [15, 20], appearances: 1, peakTarget: [5, 8], normalTarget: [5, 8], absoluteCeiling: 5 },
];

function getBand(top20Pos: number): BandConfig {
  const band = BANDS.find((b) => top20Pos >= b.range[0] && top20Pos <= b.range[1]);
  if (!band) throw new Error(`Posição de Top20 fora do intervalo esperado (1-20): ${top20Pos}`);
  return band;
}

function randInt(rnd: () => number, min: number, max: number): number {
  return Math.floor(rnd() * (max - min + 1)) + min;
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
}

function allocateDays(plans: SongPlan[], rnd: () => number): Map<Top20Entry, number[]> {
  const capacity = [SLOTS_PER_DAY, SLOTS_PER_DAY, SLOTS_PER_DAY, SLOTS_PER_DAY, SLOTS_PER_DAY];
  const result = new Map<Top20Entry, number[]>();

  const order = shuffle(rnd, plans).sort((a, b) => b.quota - a.quota);

  for (const plan of order) {
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
    return { entry, quota: band.appearances, band };
  });

  const daysOf = allocateDays(plans, rnd);

  const byDay: { entry: Top20Entry; target: number }[][] = [[], [], [], [], []];

  for (const plan of plans) {
    const days = daysOf.get(plan.entry) ?? [];
    const peakDay = days.length > 0 ? days[days.length - 1] : -1;
    for (const d of days) {
      const isPeak = d === peakDay;
      const [lo, hi] = isPeak ? plan.band.peakTarget : plan.band.normalTarget;
      const target = randInt(rnd, lo, hi);
      byDay[d].push({ entry: plan.entry, target });
    }
  }

  const result: WeeklyDailyCharts = {
    Segunda: [],
    Terça: [],
    Quarta: [],
    Quinta: [],
    Sexta: [],
  };

  DISK_MTV_WEEKDAYS.forEach((label, dayIndex) => {
    const dayList = [...byDay[dayIndex]].sort((a, b) => {
      if (a.target !== b.target) return a.target - b.target;
      if (a.entry.pos !== b.entry.pos) return a.entry.pos - b.entry.pos;
      return rnd() - 0.5;
    });

    const remaining = [...dayList];
    const finalDay: { entry: Top20Entry }[] = [];

    for (let slot = 1; slot <= dayList.length; slot += 1) {
      let pickIdx = remaining.findIndex((item) => {
        const band = getBand(item.entry.pos);
        return slot >= band.absoluteCeiling;
      });
      if (pickIdx === -1) pickIdx = 0;

      const [chosen] = remaining.splice(pickIdx, 1);
      finalDay.push(chosen);
    }

    result[label] = finalDay.map((w, idx) => ({
      pos: idx + 1,
      artist: w.entry.artist,
      song: w.entry.song,
      top20Pos: w.entry.pos,
    }));
  });

  return result;
}

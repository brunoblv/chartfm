import { prisma } from "@/lib/prisma";
import type { ChartTop3EventType } from "@/lib/social/content/chart-top3";

/** Formato de uma entrada de chart, cobrindo os campos que existem no Global 100 (mais ricos) e nos charts do Last.fm (mais simples). */
export type HighlightSourceEntry = {
  position: number;
  song: { title: string; artist: string };
  status: "new" | "return" | "up" | "down" | "same";
  delta: number | null;
  points?: number;
  peak?: number;
  weeks?: number;
  numberOnes?: number;
  growthPct?: number | null;
};

export type ChartHighlight =
  | { type: "leader"; title: string; artist: string; isDebut: boolean; numberOnes: number | null }
  | { type: "riser"; title: string; artist: string; delta: number; position: number }
  | { type: "faller"; title: string; artist: string; delta: number; prevPos: number; position: number }
  | { type: "debut"; title: string; artist: string; position: number }
  | { type: "weeksAtOne"; title: string; artist: string; numberOnes: number }
  | { type: "growth"; title: string; artist: string; growthPct: number }
  | { type: "catalogMilestone"; artist: string; songTitle: string; count: number };

const MILESTONE_STEP = 5;

function isMilestone(n: number): boolean {
  return n > 0 && n % MILESTONE_STEP === 0;
}

/** Marcos e destaques calculáveis diretamente da semana congelada, sem consultar histórico. */
export function computeChartHighlights(entries: HighlightSourceEntry[]): ChartHighlight[] {
  const highlights: ChartHighlight[] = [];
  if (entries.length === 0) return highlights;

  const leader = entries[0];
  if (leader) {
    highlights.push({
      type: "leader",
      title: leader.song.title,
      artist: leader.song.artist,
      isDebut: leader.status === "new",
      numberOnes: leader.numberOnes ?? null,
    });
    if (leader.numberOnes != null && isMilestone(leader.numberOnes)) {
      highlights.push({
        type: "weeksAtOne",
        title: leader.song.title,
        artist: leader.song.artist,
        numberOnes: leader.numberOnes,
      });
    }
  }

  const risers = entries.filter((e) => e.status === "up" && (e.delta ?? 0) > 0);
  if (risers.length > 0) {
    const riser = risers.reduce((best, e) => ((e.delta ?? 0) > (best.delta ?? 0) ? e : best));
    highlights.push({ type: "riser", title: riser.song.title, artist: riser.song.artist, delta: riser.delta ?? 0, position: riser.position });
  }

  const fallers = entries.filter((e) => e.status === "down" && (e.delta ?? 0) < 0);
  if (fallers.length > 0) {
    const faller = fallers.reduce((worst, e) => ((e.delta ?? 0) < (worst.delta ?? 0) ? e : worst));
    const delta = faller.delta ?? 0;
    highlights.push({
      type: "faller",
      title: faller.song.title,
      artist: faller.song.artist,
      delta,
      prevPos: faller.position - delta,
      position: faller.position,
    });
  }

  const debuts = entries.filter((e) => e.status === "new");
  if (debuts.length > 0) {
    const topDebut = debuts.reduce((best, e) => (e.position < best.position ? e : best));
    if (topDebut.position !== leader?.position) {
      highlights.push({ type: "debut", title: topDebut.song.title, artist: topDebut.song.artist, position: topDebut.position });
    }
  }

  const withGrowth = entries.filter((e) => e.growthPct != null && (e.growthPct ?? 0) > 0);
  if (withGrowth.length > 0) {
    const best = withGrowth.reduce((top, e) => ((e.growthPct ?? 0) > (top.growthPct ?? 0) ? e : top));
    highlights.push({ type: "growth", title: best.song.title, artist: best.song.artist, growthPct: best.growthPct ?? 0 });
  }

  return highlights;
}

/**
 * Marco de catálogo: "Nª música do artista no Global 100" — conta títulos distintos do artista
 * já aparecidos em qualquer semana congelada até (e incluindo) weekIndex. Só sinaliza quando o
 * total bate um número redondo (5, 10, 15…), para não forçar uma frase toda semana.
 * Consulta só é feita para GLOBAL100_PUBLISHED (único chart com histórico rico o suficiente) e
 * limitada a um punhado de artistas (líder + destaques) para não escanear o histórico à toa.
 */
export async function computeCatalogMilestones(
  eventType: ChartTop3EventType,
  weekIndex: number,
  candidateArtists: string[],
): Promise<ChartHighlight[]> {
  if (eventType !== "GLOBAL100_PUBLISHED" || candidateArtists.length === 0) return [];

  const uniqueArtists = Array.from(new Set(candidateArtists));
  const snapshots = await prisma.globalSnapshot.findMany({
    where: { weekIndex: { lte: weekIndex } },
    select: { weeklySongs: true },
  });

  const titlesByArtist = new Map<string, Map<string, string>>(); // artist -> (titleLower -> titleOriginal)
  for (const snap of snapshots) {
    const songs = (snap.weeklySongs as unknown as HighlightSourceEntry[]) ?? [];
    for (const entry of songs) {
      const artist = entry.song.artist;
      if (!uniqueArtists.includes(artist)) continue;
      const bucket = titlesByArtist.get(artist) ?? new Map<string, string>();
      bucket.set(entry.song.title.toLowerCase(), entry.song.title);
      titlesByArtist.set(artist, bucket);
    }
  }

  const highlights: ChartHighlight[] = [];
  for (const artist of uniqueArtists) {
    const titles = titlesByArtist.get(artist);
    if (!titles) continue;
    const count = titles.size;
    if (isMilestone(count)) {
      const latestTitle = Array.from(titles.values()).pop() ?? "";
      highlights.push({ type: "catalogMilestone", artist, songTitle: latestTitle, count });
    }
  }
  return highlights;
}

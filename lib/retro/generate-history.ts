/**
 * Hot 100 Retrospectivo — orquestrador da geração de histórico (F6/F7).
 *
 * Liga as duas pontas do sistema:
 *   1. Curadoria mensal (`build-pool.ts` + `scoring.ts`, o mesmo motor que a
 *      tela `/retro` usa) — dá o Score Final de cada estreia, já com todos os
 *      ajustes manuais do usuário aplicados.
 *   2. Simulação semanal (`weekly-simulation.ts`) — transforma essas estreias
 *      em semanas reais de carry-over.
 *
 * Roda o Last.fm overall + o catálogo UMA VEZ (via `loadRetroSources`) e reusa
 * para todos os meses do intervalo — nunca repete chamada de rede por mês.
 * Nunca gera uma semana que já existe de verdade na parada-alvo (boundary).
 */

import { prisma } from "@/lib/prisma";
import {
  buildRetroPoolFromSources,
  canHaveRealPeriodData,
  endOfMonthUTC,
  fetchRealPeriodPlays,
  loadRetroSources,
  type RetroTarget,
} from "@/lib/retro/build-pool";
import { buildRetroChart } from "@/lib/retro/scoring";
import { simulateWeeklyChart, weekIndexUTC, type WeeklyDebut, type WeeklySnapshot } from "@/lib/retro/weekly-simulation";

/** As duas paradas reais que o sistema alimenta (ver hot100retroativo.md §"Paradas-alvo"). */
export const TARGET_PARADA: Record<RetroTarget, { paradaId: string; chartSize: number; isPrimary: boolean }> = {
  hot100: { paradaId: "cmqyiop8m00012b83w8d56h7e", chartSize: 100, isPrimary: true },
  clipes: { paradaId: "cmpn5qqi20001mly9beqx3xkt", chartSize: 20, isPrimary: false },
};

/** Segurança contra boundary mal calculado / parada sem nenhum chart real ainda. */
const MAX_MONTHS = 40 * 12;

export interface GenerateHistoryOptions {
  userId: string;
  lastfmUser: string;
  target: RetroTarget;
  /** Ano civil de início do backfill (semana ISO 1 desse ano). */
  startYear: number;
  /**
   * Busca plays reais do Last.fm por mês (pós-Out/2010) em vez de estimar por
   * playsScore×eraWeight. Desligado por padrão: multiplicaria as chamadas ao
   * Last.fm por mês gerado, o que a política de rate-limit do projeto pede pra
   * evitar num backfill em massa. Ligar só para uma faixa curta de meses.
   */
  fetchRealPeriodPlays?: boolean;
}

export interface DebutSummary {
  songId: string;
  title: string;
  artist: string;
  debutDate: string; // ISO yyyy-mm-dd
  scoreFinal: number;
}

export interface GenerateHistoryResult {
  target: RetroTarget;
  paradaId: string;
  chartSize: number;
  startYear: number;
  /** weekIndex da semana real mais antiga já publicada nessa parada — nunca gerado além disso. */
  boundaryWeekIndex: number;
  boundaryWeekLabel: string | null;
  monthsScanned: number;
  debuts: DebutSummary[];
  weeks: WeeklySnapshot[];
}

/** weekIndex da semana real mais antiga da parada-alvo, ou "agora" se ela ainda não tem nenhum chart. */
async function resolveBoundaryWeekIndex(paradaId: string): Promise<{ weekIndex: number; weekLabel: string | null }> {
  const earliest = await prisma.chart.findFirst({
    where: { paradaId },
    orderBy: { weekIndex: "asc" },
    select: { weekIndex: true, weekLabel: true },
  });
  if (earliest) return { weekIndex: earliest.weekIndex, weekLabel: earliest.weekLabel };
  return { weekIndex: weekIndexUTC(new Date()), weekLabel: null };
}

/**
 * Varre mês a mês desde `startYear` até a fronteira segura, reaproveitando as
 * fontes carregadas 1x, e devolve as estreias (songId + data + Score Final)
 * prontas para a simulação semanal.
 */
export async function generateRetroHistory(opts: GenerateHistoryOptions): Promise<GenerateHistoryResult> {
  const { userId, lastfmUser, target, startYear } = opts;
  const { paradaId, chartSize } = TARGET_PARADA[target];

  const [sources, boundary] = await Promise.all([
    loadRetroSources(userId, lastfmUser),
    resolveBoundaryWeekIndex(paradaId),
  ]);

  const titleById = new Map<string, { title: string; artist: string }>();
  for (const song of sources.songIndex.values()) {
    titleById.set(song.id, { title: song.title, artist: song.artist });
  }

  const debuts: WeeklyDebut[] = [];
  const debutSummaries: DebutSummary[] = [];
  const seenSongIds = new Set<string>();

  let year = startYear;
  let month = 1;
  let monthsScanned = 0;

  while (monthsScanned < MAX_MONTHS) {
    const chartDate = endOfMonthUTC(year, month);
    const monthEndWeekIndex = weekIndexUTC(chartDate);
    if (monthEndWeekIndex >= boundary.weekIndex && weekIndexUTC(new Date(Date.UTC(year, month - 1, 1))) >= boundary.weekIndex) {
      break; // o mês inteiro já está na (ou depois da) fronteira real — para
    }

    const periodPlays =
      opts.fetchRealPeriodPlays && canHaveRealPeriodData(chartDate)
        ? await fetchRealPeriodPlays(lastfmUser, year, month)
        : null;

    const pool = buildRetroPoolFromSources(sources, { year, month, target, periodPlays });
    const rows = buildRetroChart(pool.songs, { chartDate, mode: "retrospectivo", now: new Date(), chartSize });

    for (const row of rows) {
      if (row.position == null || row.releaseRef == null) continue;
      if (seenSongIds.has(row.songId)) continue; // cada música estreia 1x só
      const debutWeekIndex = weekIndexUTC(row.releaseRef);
      if (debutWeekIndex >= boundary.weekIndex) continue; // cairia numa semana já real

      seenSongIds.add(row.songId);
      debuts.push({ songId: row.songId, debutDate: row.releaseRef, scoreFinal: row.scoreFinal });
      const meta = titleById.get(row.songId);
      debutSummaries.push({
        songId: row.songId,
        title: meta?.title ?? "—",
        artist: meta?.artist ?? "—",
        debutDate: row.releaseRef.toISOString().slice(0, 10),
        scoreFinal: Math.round(row.scoreFinal * 10) / 10,
      });
    }

    monthsScanned += 1;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  const weeks = simulateWeeklyChart({
    debuts,
    startYear,
    endWeekIndexExclusive: boundary.weekIndex,
    chartSize,
  });

  return {
    target,
    paradaId,
    chartSize,
    startYear,
    boundaryWeekIndex: boundary.weekIndex,
    boundaryWeekLabel: boundary.weekLabel,
    monthsScanned,
    debuts: debutSummaries,
    weeks,
  };
}

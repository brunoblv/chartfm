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
  enrichZeroPlaycounts,
  fetchRealPeriodPlays,
  loadRetroSources,
  RETRO_TOP20_SOURCE_PARADA_ID,
  type RetroTarget,
} from "@/lib/retro/build-pool";
import { buildRetroChart } from "@/lib/retro/scoring";
import {
  endWeekIndexAfterMonth,
  simulateWeeklyChart,
  weekIndexUTC,
  type WeeklyDebut,
  type WeeklySnapshot,
} from "@/lib/retro/weekly-simulation";

/** As duas paradas reais que o sistema alimenta (ver hot100retroativo.md §"Paradas-alvo"). */
export const TARGET_PARADA: Record<RetroTarget, { paradaId: string; chartSize: number; isPrimary: boolean }> = {
  hot100: { paradaId: "cmqyiop8m00012b83w8d56h7e", chartSize: 100, isPrimary: true },
  /** Mesma parada que alimenta pico/semanas/#1s na curadoria. */
  clipes: { paradaId: RETRO_TOP20_SOURCE_PARADA_ID, chartSize: 20, isPrimary: false },
};

/** Segurança contra boundary mal calculado / parada sem nenhum chart real ainda. */
const MAX_MONTHS = 40 * 12;

export { endWeekIndexAfterMonth };

export interface GenerateHistoryOptions {
  userId: string;
  lastfmUser: string;
  target: RetroTarget;
  /** Ano civil de início do backfill. */
  startYear: number;
  /**
   * Mês civil de início (1-12). Default 1.
   * Use o mesmo mês do "até" um ano antes para aquecer o Hot 100 com ~12 meses
   * de estreias (ex.: desde maio/2004 até maio/2005).
   */
  startMonth?: number;
  /**
   * Se definidos, só varre estreias e só gera semanas até o fim deste mês
   * (inclusive). Fluxo mês a mês: curar maio → publicar até maio → junho → …
   * Semanas já publicadas são puladas na gravação; a simulação não para na
   * semana mais antiga da parada.
   */
  throughYear?: number;
  throughMonth?: number; // 1-12
  /**
   * Busca plays reais do Last.fm por mês (pós-Out/2010) em vez de estimar por
   * playsScore×eraWeight. Desligado por padrão: multiplicaria as chamadas ao
   * Last.fm por mês gerado, o que a política de rate-limit do projeto pede pra
   * evitar num backfill em massa. Ligar só para uma faixa curta de meses.
   */
  fetchRealPeriodPlays?: boolean;
  /** Parada de destino, se diferente da parada padrão de `target` (ver `TARGET_PARADA`). */
  paradaId?: string;
  /** Tamanho do chart da parada de destino, se diferente do padrão de `target`. */
  chartSize?: number;
  /**
   * Preview na UI: simula até `throughYear`/`throughMonth` sem cap em “agora”.
   * Enrich de plays só no mês pedido (mais rápido).
   */
  previewOnly?: boolean;
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
  startMonth: number;
  /** Se a geração foi limitada a um mês (fluxo mês a mês). */
  throughYear: number | null;
  throughMonth: number | null;
  /**
   * weekIndex da semana real mais antiga já publicada nessa parada.
   * Só limita o fim no backfill em massa (sem throughMonth). No fluxo mês a mês
   * a publicação pula semanas que já existem; a simulação vai até o mês pedido.
   */
  boundaryWeekIndex: number;
  boundaryWeekLabel: string | null;
  /** Fim exclusivo efetivo da simulação. */
  endWeekIndexExclusive: number;
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
  const defaults = TARGET_PARADA[target];
  const paradaId = opts.paradaId ?? defaults.paradaId;
  const chartSize = opts.chartSize ?? defaults.chartSize;
  const startMonth = Math.min(12, Math.max(1, opts.startMonth ?? 1));
  const throughYear = opts.throughYear ?? null;
  const throughMonth = opts.throughMonth ?? null;
  const previewOnly = opts.previewOnly === true;

  const [sources, boundary] = await Promise.all([
    loadRetroSources(userId, lastfmUser),
    resolveBoundaryWeekIndex(paradaId),
  ]);

  // Fim da simulação:
  // - Fluxo mês a mês / preview (`throughYear`+`throughMonth`): até o fim do mês
  //   pedido. Semanas já publicadas são puladas na gravação (idempotente) — não
  //   usamos a semana mais antiga como teto, senão um chart em jan/2005 bloqueia
  //   abril–maio e o fluxo “avançar mês a mês” morre.
  // - Backfill em massa (sem through): para na semana real mais antiga (preenche
  //   o buraco histórico antes do que já existe).
  // - Non-preview: nunca gera semanas futuras.
  const nowWeekIndex = weekIndexUTC(new Date());
  let endWeekIndexExclusive: number;
  if (throughYear != null && throughMonth != null) {
    const throughEnd = endWeekIndexAfterMonth(throughYear, throughMonth);
    endWeekIndexExclusive = previewOnly ? throughEnd : Math.min(throughEnd, nowWeekIndex);
  } else {
    endWeekIndexExclusive = Math.min(boundary.weekIndex, nowWeekIndex);
  }

  const titleById = new Map<string, { title: string; artist: string }>();
  for (const song of sources.songIndex.values()) {
    titleById.set(song.id, { title: song.title, artist: song.artist });
  }

  const debuts: WeeklyDebut[] = [];
  const debutSummaries: DebutSummary[] = [];
  const seenSongIds = new Set<string>();

  let year = startYear;
  let month = startMonth;
  let monthsScanned = 0;

  if (
    throughYear != null &&
    throughMonth != null &&
    (startYear > throughYear || (startYear === throughYear && startMonth > throughMonth))
  ) {
    return {
      target,
      paradaId,
      chartSize,
      startYear,
      startMonth,
      throughYear,
      throughMonth,
      boundaryWeekIndex: boundary.weekIndex,
      boundaryWeekLabel: boundary.weekLabel,
      endWeekIndexExclusive,
      monthsScanned: 0,
      debuts: [],
      weeks: [],
    };
  }

  while (monthsScanned < MAX_MONTHS) {
    if (throughYear != null && throughMonth != null) {
      if (year > throughYear || (year === throughYear && month > throughMonth)) break;
    }

    const chartDate = endOfMonthUTC(year, month);
    const monthStartWeekIndex = weekIndexUTC(new Date(Date.UTC(year, month - 1, 1)));
    if (monthStartWeekIndex >= endWeekIndexExclusive) {
      break; // o mês inteiro já está na (ou depois da) fronteira efetiva — para
    }

    const periodPlays =
      opts.fetchRealPeriodPlays && canHaveRealPeriodData(chartDate)
        ? await fetchRealPeriodPlays(lastfmUser, year, month)
        : null;

    const pool = buildRetroPoolFromSources(sources, { year, month, target, periodPlays });
    // Hidrata plays (fora do top 1000 Last.fm) antes de pontuar a estreia.
    // - Publish mês a mês: todos os meses até o pedido
    // - Preview: só o mês atual (senão fica lento demais)
    // - Backfill em massa (sem throughMonth): pula
    const isThroughMonth = throughYear != null && throughMonth != null && year === throughYear && month === throughMonth;
    const shouldEnrich =
      throughYear != null && throughMonth != null && (previewOnly ? isThroughMonth : true);
    if (shouldEnrich) {
      await enrichZeroPlaycounts(pool, lastfmUser);
    }
    const rows = buildRetroChart(pool.songs, { chartDate, mode: "retrospectivo", now: new Date(), chartSize });

    for (const row of rows) {
      if (row.position == null || row.releaseRef == null) continue;
      if (seenSongIds.has(row.songId)) continue; // cada música estreia 1x só
      const debutWeekIndex = weekIndexUTC(row.releaseRef);
      if (debutWeekIndex >= endWeekIndexExclusive) continue; // cairia fora do intervalo pedido / já real

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
    startMonth,
    endWeekIndexExclusive,
    chartSize,
  });

  return {
    target,
    paradaId,
    chartSize,
    startYear,
    startMonth,
    throughYear,
    throughMonth,
    boundaryWeekIndex: boundary.weekIndex,
    boundaryWeekLabel: boundary.weekLabel,
    endWeekIndexExclusive,
    monthsScanned,
    debuts: debutSummaries,
    weeks,
  };
}

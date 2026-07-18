/**
 * Hot 100 Retrospectivo — montagem do pool (Fase 3).
 *
 * Cruza as fontes externas/internas e devolve `RetroSongInput[]` pronto para o
 * motor determinístico de `scoring.ts`:
 *   1. Last.fm overall  → força all-time (proxy pré-2010)
 *   2. Last.fm período  → plays reais do mês (pós-Out/2010)
 *   3. Song             → datas de lançamento / clipe (elegibilidade)
 *   4. ChartEntry       → histórico Top20 do usuário (pico / semanas / #1)
 *   5. RetroSongProfile / RetroEraOverride → ajustes manuais do usuário
 *
 * Faz I/O (DB + rede); a lógica pura fica em `scoring.ts`.
 */

import { prisma } from "@/lib/prisma";
import { fetchTopTracks, fetchTracksBetweenUnix } from "@/lib/lastfm";
import { normalizeTrackMatchKey } from "@/lib/lastfm-import";
import type { RetroMode, RetroSongInput } from "@/lib/retro/scoring";

/** Antes disto não há dado real de Last.fm por período → estimativa. */
const LASTFM_REAL_DATA_FROM = Date.UTC(2010, 9, 1); // 2010-10-01

/** Nº de faixas overall a considerar como universo do usuário. */
const OVERALL_LIMIT = 1000;

export interface BuildPoolArgs {
  userId: string;
  lastfmUser: string | null;
  year: number;
  month: number; // 1-12
  mode: RetroMode;
}

export interface RetroSongMeta {
  title: string;
  artist: string;
  note: string | null;
}

export interface BuildPoolResult {
  chartDate: Date;
  usesRealPeriodData: boolean;
  matched: number;
  unmatched: number;
  songs: RetroSongInput[];
  /** Metadados de exibição por songId (título/artista) para a UI. */
  meta: Map<string, RetroSongMeta>;
}

/** Chave normalizada "titulo|artista" para casar Last.fm ↔ Song. */
function matchKey(title: string, artist: string): string {
  const a = artist.split(",")[0] ?? artist;
  return `${normalizeTrackMatchKey(title)}|${normalizeTrackMatchKey(a)}`;
}

/** Último dia do mês selecionado, em UTC (ex.: 2005-05 → 2005-05-31). */
export function endOfMonthUTC(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0));
}

interface Top20Agg {
  weeks: number;
  bestPeak: number | null;
  numberOnes: number;
}

/** Agrega o histórico de charts do usuário publicados até a data (pico/semanas/#1). */
async function aggregateTop20History(userId: string, chartDate: Date): Promise<Map<string, Top20Agg>> {
  const entries = await prisma.chartEntry.findMany({
    where: { chart: { userId, weekStartDate: { lte: chartDate } } },
    select: { songId: true, position: true },
  });
  const map = new Map<string, Top20Agg>();
  for (const e of entries) {
    const agg = map.get(e.songId) ?? { weeks: 0, bestPeak: null, numberOnes: 0 };
    if (e.position <= 20) agg.weeks += 1;
    if (e.position === 1) agg.numberOnes += 1;
    agg.bestPeak = agg.bestPeak == null ? e.position : Math.min(agg.bestPeak, e.position);
    map.set(e.songId, agg);
  }
  return map;
}

/** Índice normalizado das músicas cadastradas → dados de elegibilidade. */
interface SongRow {
  id: string;
  title: string;
  artist: string;
  singleReleaseDate: Date | null;
  youtubeReleaseDate: Date | null;
  albumReleaseDate: Date | null;
}

async function loadSongIndex(): Promise<Map<string, SongRow>> {
  const songs = await prisma.song.findMany({
    select: {
      id: true,
      title: true,
      artist: true,
      singleReleaseDate: true,
      youtubeReleaseDate: true,
      musicVideoReleaseDate: true,
      albumRef: { select: { releaseDate: true } },
    },
  });
  const map = new Map<string, SongRow>();
  for (const s of songs) {
    const key = matchKey(s.title, s.artist);
    // Primeiro cadastro vence; evita que variações sobrescrevam o principal.
    if (map.has(key)) continue;
    map.set(key, {
      id: s.id,
      title: s.title,
      artist: s.artist,
      singleReleaseDate: s.singleReleaseDate,
      youtubeReleaseDate: s.youtubeReleaseDate ?? s.musicVideoReleaseDate,
      albumReleaseDate: s.albumRef?.releaseDate ?? null,
    });
  }
  return map;
}

/** Plays reais por música no mês (pós-Out/2010), casados pela chave normalizada. */
async function fetchRealPeriodPlays(
  lastfmUser: string,
  year: number,
  month: number,
): Promise<Map<string, number>> {
  const from = Math.floor(Date.UTC(year, month - 1, 1) / 1000);
  const toExclusive = Math.floor(Date.UTC(year, month, 1) / 1000);
  const tracks = await fetchTracksBetweenUnix(from, toExclusive, lastfmUser);
  const map = new Map<string, number>();
  for (const t of tracks) {
    const plays = t.dayPlays.reduce((sum, d) => sum + d.plays, 0);
    if (plays <= 0) continue;
    map.set(matchKey(t.track, t.artist), plays);
  }
  return map;
}

export async function buildRetroPool(args: BuildPoolArgs): Promise<BuildPoolResult> {
  const { userId, lastfmUser, year, month, mode } = args;
  const chartDate = endOfMonthUTC(year, month);
  const usesRealPeriodData = chartDate.getTime() >= LASTFM_REAL_DATA_FROM;

  if (!lastfmUser) {
    return { chartDate, usesRealPeriodData, matched: 0, unmatched: 0, songs: [], meta: new Map() };
  }

  const [overall, songIndex, top20, profiles, eraOverrides, periodPlays] = await Promise.all([
    fetchTopTracks("overall", OVERALL_LIMIT, lastfmUser),
    loadSongIndex(),
    aggregateTop20History(userId, chartDate),
    prisma.retroSongProfile.findMany({ where: { userId } }),
    prisma.retroEraOverride.findMany({ where: { userId, year } }),
    usesRealPeriodData ? fetchRealPeriodPlays(lastfmUser, year, month) : Promise.resolve(new Map<string, number>()),
  ]);

  const profileBySong = new Map(profiles.map((p) => [p.songId, p]));
  const eraBySong = new Map(eraOverrides.map((e) => [e.songId, e.weight]));

  const songs: RetroSongInput[] = [];
  const meta = new Map<string, RetroSongMeta>();
  let matched = 0;
  let unmatched = 0;

  for (const t of overall) {
    const key = matchKey(t.track, t.artist);
    const song = songIndex.get(key);
    if (!song) {
      unmatched += 1;
      continue;
    }
    matched += 1;

    const agg = top20.get(song.id) ?? { weeks: 0, bestPeak: null, numberOnes: 0 };
    const profile = profileBySong.get(song.id) ?? null;
    meta.set(song.id, { title: song.title, artist: song.artist, note: profile?.note ?? null });
    const periodPlaycount = usesRealPeriodData ? periodPlays.get(key) ?? 0 : null;

    songs.push({
      songId: song.id,
      overallPlaycount: t.playcount,
      periodPlaycount,
      lastScrobbleAt: null, // preenchido numa fase futura (histórico de scrobbles)
      hasScrobbleInPeriod: (periodPlaycount ?? 0) > 0,
      singleReleaseDate: song.singleReleaseDate,
      albumReleaseDate: song.albumReleaseDate,
      youtubeReleaseDate: song.youtubeReleaseDate,
      top20Weeks: agg.weeks,
      top20BestPeak: agg.bestPeak,
      numberOnes: agg.numberOnes,
      manualImportance: profile?.importance ?? null,
      importanceLocked: profile?.importanceLocked ?? false,
      manualPeakPotential: (profile?.peakPotential as RetroSongInput["manualPeakPotential"]) ?? null,
      manualAdjustment: profile?.manualAdjustment ?? 0,
      eraOverrideWeight: eraBySong.get(song.id) ?? null,
    });
  }

  // Modo histórico: sem dado real de período (pré-Out/2010) não dá para saber o
  // que foi ouvido no mês → tratamos como não-elegível no motor. Alertamos aqui.
  void mode;

  return { chartDate, usesRealPeriodData, matched, unmatched, songs, meta };
}

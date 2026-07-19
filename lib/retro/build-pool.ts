/**
 * Hot 100 Retrospectivo — montagem do pool (Fase 3, modelo estreia + carry-over).
 *
 * O pool de um período são as CANDIDATAS A ESTREIA: somente músicas cuja data
 * de estreia (releaseRef) cai DENTRO do mês selecionado. Músicas antigas não
 * entram na lista — elas já estão no chart da semana anterior (carry-over).
 *
 * Cruza as fontes externas/internas e devolve `RetroSongInput[]` pronto para o
 * motor determinístico de `scoring.ts`:
 *   1. Last.fm overall  → força all-time (proxy pré-2010)
 *   2. Last.fm período  → plays reais do mês (pós-Out/2010)
 *   3. Song             → datas de lançamento / clipe (estreia)
 *   4. ChartEntry       → histórico Top20 vitalício só da parada-base
 *                         (`RETRO_TOP20_SOURCE_PARADA_ID`: Video Countdown) —
 *                         pico / semanas / #1 / 1ª entrada (hindsight OK)
 *   5. RetroSongProfile / RetroEraOverride → ajustes manuais do usuário
 *
 * Faz I/O (DB + rede); a lógica pura fica em `scoring.ts`.
 *
 * `loadRetroSources()` busca tudo (Last.fm overall, catálogo, histórico Top20,
 * overrides) UMA VEZ; `buildRetroPoolFromSources()` monta o pool de um mês
 * específico a partir dessas fontes já em memória, sem I/O novo — permite ao
 * `generate-history.ts` varrer décadas sem repetir a chamada ao Last.fm por mês
 * (política de espaçar chamadas à API, ver memória do projeto).
 *
 * Plays fora do top 1000: `enrichZeroPlaycounts` (rota interativa + publish mês a mês).
 */

import { prisma } from "@/lib/prisma";
import { fetchTopTracks, fetchTracksBetweenUnix, fetchTrackUserPlaycount, type TopTrack } from "@/lib/lastfm";
import { normalizeTrackMatchKey } from "@/lib/lastfm-import";
import { normalizePeakPotential, type ReleaseRefSource, type RetroMode, type RetroSongInput } from "@/lib/retro/scoring";

/** Parada-alvo da geração: define a cadeia de datas da estreia. */
export type RetroTarget = "hot100" | "clipes";

/**
 * Parada Top 20 semanal histórica (Under My Skin Video Countdown) — base de
 * pico/semanas/#1s do motor retrospectivo (tanto Hot 100 quanto Clipes).
 */
export const RETRO_TOP20_SOURCE_PARADA_ID = "cmpn5qqi20001mly9beqx3xkt";

/** Antes disto não há dado real de Last.fm por período → estimativa. */
const LASTFM_REAL_DATA_FROM = Date.UTC(2010, 9, 1); // 2010-10-01

/** Nº de faixas overall a considerar como universo do usuário. */
const OVERALL_LIMIT = 1000;

/** Último dia do mês selecionado, em UTC (ex.: 2005-05 → 2005-05-31). */
export function endOfMonthUTC(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0));
}

/** A data do chart tem dado real de plays por período disponível no Last.fm. */
export function canHaveRealPeriodData(chartDate: Date): boolean {
  return chartDate.getTime() >= LASTFM_REAL_DATA_FROM;
}

export interface RetroSongMeta {
  title: string;
  artist: string;
  album: string | null;
  coverUrl: string | null;
  note: string | null;
  /** De onde veio a data de estreia (single/álbum/clipe/1ª entrada Top 20/Billboard). */
  releaseRefSource: ReleaseRefSource | null;
  /** Data de estreia na Billboard Hot 100 informada manualmente (target "hot100"), se houver. */
  billboardHot100DebutDate: Date | null;
}

export interface BuildPoolResult {
  chartDate: Date;
  usesRealPeriodData: boolean;
  matched: number;
  unmatched: number;
  /** Candidatas vindas só do catálogo (sem nenhum scrobble na biblioteca). */
  catalogOnly: number;
  /** songId de quem entrou pela passada de catálogo (overallPlaycount=0 "cru", sem confirmação do Last.fm). */
  catalogOnlySongIds: string[];
  songs: RetroSongInput[];
  /** Metadados de exibição por songId (título/artista) para a UI. */
  meta: Map<string, RetroSongMeta>;
}

/** Chave normalizada "titulo|artista" para casar Last.fm ↔ Song. */
function matchKey(title: string, artist: string): string {
  const a = artist.split(",")[0] ?? artist;
  return `${normalizeTrackMatchKey(title)}|${normalizeTrackMatchKey(a)}`;
}

/** Índice normalizado das músicas cadastradas → dados de elegibilidade. */
export interface SongRow {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  coverUrl: string | null;
  singleReleaseDate: Date | null;
  youtubeReleaseDate: Date | null;
  albumReleaseDate: Date | null;
  /** Estreia real na Billboard Hot 100, importada automaticamente (mhollingshead/billboard-hot-100). */
  billboardHot100DebutDate: Date | null;
  /** Estreia real mais antiga em algum chart secundário da Billboard (Mainstream Rock, Alternative Airplay etc.). */
  billboardGenreChartDebutDate: Date | null;
}

/** Ponto do histórico Top20 do usuário: uma posição publicada numa semana. */
export interface Top20Point {
  position: number;
  weekStartDate: Date | null;
}

interface Top20Agg {
  weeks: number;
  bestPeak: number | null;
  numberOnes: number;
  /** 1ª semana da música na Top 20 — fallback da data de estreia no Hot 100. */
  firstEntryDate: Date | null;
}

const EMPTY_TOP20_AGG: Top20Agg = { weeks: 0, bestPeak: null, numberOnes: 0, firstEntryDate: null };

async function loadSongIndex(): Promise<Map<string, SongRow>> {
  const songs = await prisma.song.findMany({
    select: {
      id: true,
      title: true,
      artist: true,
      singleReleaseDate: true,
      youtubeReleaseDate: true,
      musicVideoReleaseDate: true,
      billboardHot100DebutDate: true,
      billboardGenreChartDebutDate: true,
      albumRef: { select: { releaseDate: true, coverUrl: true, title: true, exhibitionName: true } },
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
      album: s.albumRef?.exhibitionName ?? s.albumRef?.title ?? null,
      coverUrl: s.albumRef?.coverUrl ?? null,
      singleReleaseDate: s.singleReleaseDate,
      youtubeReleaseDate: s.youtubeReleaseDate ?? s.musicVideoReleaseDate,
      albumReleaseDate: s.albumRef?.releaseDate ?? null,
      billboardHot100DebutDate: s.billboardHot100DebutDate,
      billboardGenreChartDebutDate: s.billboardGenreChartDebutDate,
    });
  }
  return map;
}

/**
 * Histórico de posições só na Top 20 semanal-base (`RETRO_TOP20_SOURCE_PARADA_ID`).
 * Não mistura diária, Hot 100 Singles nem outras paradas.
 */
async function loadTop20Points(userId: string): Promise<Map<string, Top20Point[]>> {
  const entries = await prisma.chartEntry.findMany({
    where: {
      chart: {
        userId,
        paradaId: RETRO_TOP20_SOURCE_PARADA_ID,
      },
      position: { lte: 20 },
    },
    select: {
      songId: true,
      position: true,
      chart: { select: { weekStartDate: true, publishedAt: true } },
    },
  });
  const map = new Map<string, Top20Point[]>();
  for (const e of entries) {
    // Charts sem week_start_date ainda contam via publishedAt.
    const weekStartDate = e.chart.weekStartDate ?? e.chart.publishedAt ?? null;
    const list = map.get(e.songId) ?? [];
    list.push({ position: e.position, weekStartDate });
    map.set(e.songId, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.weekStartDate?.getTime() ?? 0) - (b.weekStartDate?.getTime() ?? 0));
  }
  return map;
}

/**
 * Histórico Top20 vitalício da parada-base (hindsight de propósito).
 * Plays overall já são all-time; o Top20 segue a mesma lógica.
 */
export function aggregateTop20Lifetime(points: Top20Point[] | undefined): Top20Agg {
  if (!points || points.length === 0) return EMPTY_TOP20_AGG;
  const agg: Top20Agg = { weeks: 0, bestPeak: null, numberOnes: 0, firstEntryDate: null };
  for (const p of points) {
    if (p.weekStartDate == null) continue;
    if (p.position <= 20) {
      agg.weeks += 1;
      if (agg.firstEntryDate == null || p.weekStartDate.getTime() < agg.firstEntryDate.getTime()) {
        agg.firstEntryDate = p.weekStartDate;
      }
      if (p.position === 1) agg.numberOnes += 1;
      agg.bestPeak = agg.bestPeak == null ? p.position : Math.min(agg.bestPeak, p.position);
    }
  }
  return agg;
}

/** A mais antiga entre duas datas, ignorando nulas (ou null se ambas nulas). */
function earliestOf(a: Date | null, b: Date | null): Date | null {
  if (a == null) return b;
  if (b == null) return a;
  return a.getTime() < b.getTime() ? a : b;
}

/**
 * Data de estreia + origem, na cadeia da parada-alvo:
 *   hot100: single → álbum → clipe → 1ª entrada Top 20
 *   clipes: clipe → álbum → single → 1ª entrada Top 20
 *
 * Só no target "hot100": se há uma data real de estreia na Billboard
 * (`billboardDebutDate`, override manual do usuário; na ausência dele, cai
 * para o mais antigo entre `song.billboardHot100DebutDate` e
 * `song.billboardGenreChartDebutDate`, importados automaticamente) E ela é
 * anterior TANTO à data do single QUANTO à 1ª entrada da música na Top20 do
 * usuário, ela vence as duas — corrige casos em que a data de lançamento
 * cadastrada (ou a própria Top20 pessoal) é mais tardia que a estreia real
 * em algum chart americano.
 */
export function debutRefFor(
  target: RetroTarget,
  song: SongRow,
  firstEntryDate: Date | null,
  billboardDebutDate: Date | null,
): { date: Date | null; source: ReleaseRefSource | null } {
  const effectiveBillboardDebutDate =
    billboardDebutDate ?? earliestOf(song.billboardHot100DebutDate, song.billboardGenreChartDebutDate);

  if (target === "hot100" && effectiveBillboardDebutDate != null) {
    const earlierThanSingle =
      song.singleReleaseDate == null || effectiveBillboardDebutDate.getTime() < song.singleReleaseDate.getTime();
    const earlierThanTop20 = firstEntryDate == null || effectiveBillboardDebutDate.getTime() < firstEntryDate.getTime();
    if (earlierThanSingle && earlierThanTop20) return { date: effectiveBillboardDebutDate, source: "billboard" };
  }

  const chain: [ReleaseRefSource, Date | null][] =
    target === "clipes"
      ? [
          ["clipe", song.youtubeReleaseDate],
          ["album", song.albumReleaseDate],
          ["single", song.singleReleaseDate],
          ["top20", firstEntryDate],
        ]
      : [
          ["single", song.singleReleaseDate],
          ["album", song.albumReleaseDate],
          ["clipe", song.youtubeReleaseDate],
          ["top20", firstEntryDate],
        ];
  for (const [source, date] of chain) {
    if (date != null) return { date, source };
  }
  return { date: null, source: null };
}

/** Plays reais por música no mês (pós-Out/2010), casados pela chave normalizada. */
export async function fetchRealPeriodPlays(
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

/**
 * Tudo que `buildRetroPoolFromSources` precisa, buscado UMA VEZ (rede + DB) e
 * reutilizado por quantos meses forem necessários — sem repetir chamadas ao
 * Last.fm por mês.
 */
export interface RetroSources {
  overall: TopTrack[];
  songIndex: Map<string, SongRow>;
  top20Points: Map<string, Top20Point[]>;
  profileBySong: Map<
    string,
    { importance: number | null; importanceLocked: boolean; peakPotential: string | null; manualAdjustment: number; note: string | null; billboardHot100DebutDate: Date | null }
  >;
  /** year → songId → weight (0-100) */
  eraOverridesByYear: Map<number, Map<string, number>>;
}

export async function loadRetroSources(userId: string, lastfmUser: string): Promise<RetroSources> {
  const [overall, songIndex, top20Points, profiles, eraOverrides] = await Promise.all([
    fetchTopTracks("overall", OVERALL_LIMIT, lastfmUser),
    loadSongIndex(),
    loadTop20Points(userId),
    prisma.retroSongProfile.findMany({ where: { userId } }),
    prisma.retroEraOverride.findMany({ where: { userId } }),
  ]);

  const profileBySong = new Map(
    profiles.map((p) => [
      p.songId,
      {
        importance: p.importance,
        importanceLocked: p.importanceLocked,
        peakPotential: p.peakPotential,
        manualAdjustment: p.manualAdjustment,
        note: p.note,
        billboardHot100DebutDate: p.billboardHot100DebutDate,
      },
    ]),
  );

  const eraOverridesByYear = new Map<number, Map<string, number>>();
  for (const e of eraOverrides) {
    const byYear = eraOverridesByYear.get(e.year) ?? new Map<string, number>();
    byYear.set(e.songId, e.weight);
    eraOverridesByYear.set(e.year, byYear);
  }

  return { overall, songIndex, top20Points, profileBySong, eraOverridesByYear };
}

export interface BuildPoolFromSourcesArgs {
  year: number;
  month: number; // 1-12
  target: RetroTarget;
  /**
   * Plays reais do mês (mapa vazio conta como "zero plays reais"). `null`/omitido
   * → sempre usa a estimativa por playsScore×eraWeight, mesmo em datas pós-2010
   * (é o padrão do backfill em massa, para não multiplicar chamadas ao Last.fm).
   */
  periodPlays?: Map<string, number> | null;
}

/** Monta o pool de UM mês a partir de fontes já carregadas — sem I/O. */
export function buildRetroPoolFromSources(sources: RetroSources, args: BuildPoolFromSourcesArgs): BuildPoolResult {
  const { year, month, target } = args;
  const chartDate = endOfMonthUTC(year, month);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const usesRealPeriodData = args.periodPlays != null;
  const periodPlays = args.periodPlays ?? null;
  const eraBySong = sources.eraOverridesByYear.get(year) ?? new Map<string, number>();

  const songs: RetroSongInput[] = [];
  const meta = new Map<string, RetroSongMeta>();
  const added = new Set<string>();
  let matched = 0;
  let unmatched = 0;
  let catalogOnly = 0;

  /**
   * Adiciona a música como candidata se a estreia dela cai DENTRO do mês.
   * O resto do chart vem do carry-over da semana anterior, não desta lista.
   */
  function pushCandidate(song: SongRow, overallPlaycount: number, periodPlaycount: number | null): boolean {
    if (added.has(song.id)) return false;

    const agg = aggregateTop20Lifetime(sources.top20Points.get(song.id));
    const billboardDebutDate = sources.profileBySong.get(song.id)?.billboardHot100DebutDate ?? null;
    const debut = debutRefFor(target, song, agg.firstEntryDate, billboardDebutDate);
    if (debut.date == null) return false; // sem data → só entra via liberação manual (F6)
    const ts = debut.date.getTime();
    if (ts < monthStart.getTime() || ts > chartDate.getTime()) return false;

    const profile = sources.profileBySong.get(song.id) ?? null;
    added.add(song.id);
    meta.set(song.id, {
      title: song.title,
      artist: song.artist,
      album: song.album,
      coverUrl: song.coverUrl,
      note: profile?.note ?? null,
      releaseRefSource: debut.source,
      billboardHot100DebutDate: billboardDebutDate,
    });

    songs.push({
      songId: song.id,
      releaseRef: debut.date,
      overallPlaycount,
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
      manualPeakPotential: normalizePeakPotential(profile?.peakPotential),
      manualAdjustment: profile?.manualAdjustment ?? 0,
      eraOverrideWeight: eraBySong.get(song.id) ?? null,
    });
    return true;
  }

  // 1) Biblioteca do Last.fm (tem playcount real do usuário).
  for (const t of sources.overall) {
    const key = matchKey(t.track, t.artist);
    const song = sources.songIndex.get(key);
    if (!song) {
      unmatched += 1;
      continue;
    }
    matched += 1;
    const periodPlaycount = usesRealPeriodData ? periodPlays!.get(key) ?? 0 : null;
    pushCandidate(song, t.playcount, periodPlaycount);
  }

  // 2) Resto do catálogo: músicas lançadas no mês que o usuário nunca scrobblou
  //    (ou que scrobblou, mas ficaram fora do top N de `fetchTopTracks`) também
  //    são candidatas. `overallPlaycount` fica 0 "cru" aqui — `buildRetroPool`
  //    (rota de 1 mês) pode confirmar com uma consulta pontual ao Last.fm.
  const catalogOnlySongIds: string[] = [];
  for (const song of sources.songIndex.values()) {
    if (pushCandidate(song, 0, usesRealPeriodData ? 0 : null)) {
      catalogOnly += 1;
      catalogOnlySongIds.push(song.id);
    }
  }

  return { chartDate, usesRealPeriodData, matched, unmatched, catalogOnly, catalogOnlySongIds, songs, meta };
}

export interface BuildPoolArgs {
  userId: string;
  lastfmUser: string | null;
  year: number;
  month: number; // 1-12
  mode: RetroMode;
  target: RetroTarget;
}

/**
 * Wrapper de conveniência para a rota interativa de um mês só: busca as fontes
 * (incluindo os plays reais do mês, se a data permitir) e monta o pool.
 * Para varrer muitos meses, use `loadRetroSources` + `buildRetroPoolFromSources`
 * diretamente (ver `lib/retro/generate-history.ts`).
 */
export async function buildRetroPool(args: BuildPoolArgs): Promise<BuildPoolResult> {
  const { userId, lastfmUser, year, month, mode, target } = args;
  const chartDate = endOfMonthUTC(year, month);

  if (!lastfmUser) {
    return { chartDate, usesRealPeriodData: false, matched: 0, unmatched: 0, catalogOnly: 0, catalogOnlySongIds: [], songs: [], meta: new Map() };
  }

  const [sources, periodPlays] = await Promise.all([
    loadRetroSources(userId, lastfmUser),
    canHaveRealPeriodData(chartDate) ? fetchRealPeriodPlays(lastfmUser, year, month) : Promise.resolve(null),
  ]);

  void mode; // gating do modo Histórico é feito em scoring.ts via ctx.mode, não aqui
  const pool = buildRetroPoolFromSources(sources, { year, month, target, periodPlays });
  await enrichZeroPlaycounts(pool, lastfmUser);
  return pool;
}

/**
 * Confirma o playcount vitalício de quem ficou com TOTAL 0 (fora do top
 * `OVERALL_LIMIT` do Last.fm, ou mismatch de nome). Usado na rota interativa
 * e no publish mês a mês.
 *
 * Prioriza músicas com histórico Top20 — são as que mais precisam de força
 * correta na curadoria. Cap generoso: um mês típico tem <100 estreias.
 */
const ENRICH_MAX_LOOKUPS = 120;
const ENRICH_DELAY_MS = 120;

export async function enrichZeroPlaycounts(pool: BuildPoolResult, lastfmUser: string): Promise<void> {
  const targets = pool.songs
    .filter((s) => s.overallPlaycount <= 0)
    .sort((a, b) => b.top20Weeks - a.top20Weeks || b.numberOnes - a.numberOnes || a.songId.localeCompare(b.songId))
    .slice(0, ENRICH_MAX_LOOKUPS);
  if (targets.length === 0) return;

  for (let i = 0; i < targets.length; i++) {
    const song = targets[i];
    const meta = pool.meta.get(song.songId);
    if (!meta) continue;

    const realCount = await fetchTrackUserPlaycount(meta.title, meta.artist, lastfmUser);
    if (realCount != null && realCount > 0) song.overallPlaycount = realCount;

    if (i < targets.length - 1) await new Promise((resolve) => setTimeout(resolve, ENRICH_DELAY_MS));
  }
}

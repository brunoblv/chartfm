import { fetchTopTracks, fetchTracksBetweenUnix, type TopTrack, type TrackPlays } from "./lastfm";
import { scoreLastfmTracks } from "./lastfm-chart-engine";
import { formatWeightedLastfmWeightsLabel, getWeightedLastfmImportConfig } from "./mytrl-access";
import { getMyTrlOwnerUser } from "./spotify-user";
import {
  formatPreviousCalendarMonthLabel,
  isCurrentChartWeek,
  parseChartWeekPickerDate,
  previousCalendarMonthUnixRange,
} from "./chart-week";

export type LastfmImportResult = {
  tracks: TopTrack[];
  periodLabel: string;
  source: "rolling_1month" | "calendar_month" | "rolling_30day_weighted";
};

/** Import ponderado — últimos 7 dias (incl. hoje) vs dias 8–30. */
function weightedImportPlayWeight(
  diffDays: number,
  recentWeight: number,
  olderWeight: number,
): number {
  if (diffDays < 0 || diffDays >= 30) return 0;
  if (diffDays < 7) return recentWeight;
  return olderWeight;
}

function computeWeightedImportScore(
  dayPlays: TrackPlays["dayPlays"],
  referenceDay: Date,
  recentWeight: number,
  olderWeight: number,
): number {
  const refMs = Date.UTC(referenceDay.getUTCFullYear(), referenceDay.getUTCMonth(), referenceDay.getUTCDate());
  let score = 0;

  for (const { date, plays } of dayPlays) {
    const playMs = new Date(`${date}T00:00:00Z`).getTime();
    const diffDays = Math.round((refMs - playMs) / 86_400_000);
    const w = weightedImportPlayWeight(diffDays, recentWeight, olderWeight);
    if (w === 0) continue;
    score += plays * w;
  }

  return score;
}

function scoreWeightedImportTracks(
  trackPlays: TrackPlays[],
  referenceDay: Date,
  recentWeight: number,
  olderWeight: number,
): Array<{ track: string; artist: string; album: string; score: number }> {
  return trackPlays
    .map((tp) => ({
      track: tp.track,
      artist: tp.artist,
      album: tp.album,
      score: computeWeightedImportScore(tp.dayPlays, referenceDay, recentWeight, olderWeight),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
}

function resolveWeightedImportWeights(handle: string | null | undefined): {
  recentPlayWeight: number;
  olderPlayWeight: number;
  periodLabel: string;
} {
  const config = getWeightedLastfmImportConfig(handle);
  const recentPlayWeight = config?.recentPlayWeight ?? 20;
  const olderPlayWeight = config?.olderPlayWeight ?? 10;
  const periodLabel = config
    ? `últimos 30 dias (${formatWeightedLastfmWeightsLabel(config)})`
    : `últimos 30 dias (7d ×${recentPlayWeight}, demais ×${olderPlayWeight})`;
  return { recentPlayWeight, olderPlayWeight, periodLabel };
}

function normalizeTrackMatchKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function scoreTrackTitleArtistMatch(
  wantTitle: string,
  wantArtist: string,
  gotTitle: string,
  gotArtist: string,
): number {
  const wt = normalizeTrackMatchKey(wantTitle);
  const waRaw = normalizeTrackMatchKey(wantArtist.split(",")[0] ?? wantArtist);
  const wa = waRaw.split(" feat ")[0] ?? waRaw;
  const ct = normalizeTrackMatchKey(gotTitle);
  const ca = normalizeTrackMatchKey(gotArtist.split(",")[0] ?? gotArtist);
  let s = 0;
  if (ct === wt) s += 100;
  else if (ct.includes(wt) || wt.includes(ct)) s += 58;
  if (ca === wa) s += 90;
  else if (ca.includes(wa) || wa.includes(ca)) s += 48;
  return s;
}

export type BrunoNewHitsImportTrack = TopTrack & {
  spotifyId: string;
  imageUrl: string | null;
};

/** Last.fm efetivo para import ponderado (ex.: @bringtheleo usa o histórico do @bruno). */
export async function resolveWeightedLastfmUsername(
  handle: string | null | undefined,
  userLastfmUser: string | null | undefined,
): Promise<string | null> {
  const config = getWeightedLastfmImportConfig(handle);
  if (config?.useMyTrlOwnerLastfm) {
    const owner = await getMyTrlOwnerUser();
    const fromOwner = owner?.lastfmUser?.trim();
    if (fromOwner) return fromOwner;
    const fromEnv = process.env.LASTFM_USERNAME?.trim();
    return fromEnv || null;
  }
  return userLastfmUser?.trim() || null;
}

/**
 * @bruno — cruza todos os scrobbles dos últimos 30 dias com a playlist "new hits"
 * (sem cortar no top 200 antes do filtro).
 */
export async function resolveBrunoNewHitsImportTracks(
  weekDateInput: unknown,
  username: string,
  playlistTracks: Array<{ spotifyId: string; title: string; artist: string; album: string; imageUrl: string | null }>,
  handle?: string | null,
): Promise<{ tracks: BrunoNewHitsImportTrack[]; periodLabel: string }> {
  const anchor = parseChartWeekPickerDate(weekDateInput) ?? new Date();
  const { recentPlayWeight, olderPlayWeight, periodLabel } = resolveWeightedImportWeights(handle);
  const toExclusive = Math.floor(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate() + 1) / 1000,
  );
  const from = toExclusive - 30 * 86400;
  const trackPlays = await fetchTracksBetweenUnix(from, toExclusive, username);
  const scored = scoreWeightedImportTracks(trackPlays, anchor, recentPlayWeight, olderPlayWeight);

  const bestBySpotifyId = new Map<string, BrunoNewHitsImportTrack>();

  // Playlist-first: cada faixa da "new hits" com scrobbles no período entra no ranking.
  for (const pl of playlistTracks) {
    let bestLf: (typeof scored)[number] | null = null;
    let bestMatch = -1;

    for (const lf of scored) {
      const match = scoreTrackTitleArtistMatch(lf.track, lf.artist, pl.title, pl.artist);
      if (match >= 120 && match > bestMatch) {
        bestMatch = match;
        bestLf = lf;
      }
    }

    if (!bestLf) continue;

    bestBySpotifyId.set(pl.spotifyId, {
      track: pl.title,
      artist: pl.artist,
      album: pl.album,
      playcount: bestLf.score,
      spotifyId: pl.spotifyId,
      imageUrl: pl.imageUrl,
    });
  }

  const tracks = Array.from(bestBySpotifyId.values()).sort((a, b) => b.playcount - a.playcount);

  return {
    tracks,
    periodLabel,
  };
}

/**
 * Import ponderado — scrobbles dos últimos 7 dias, sem filtro de playlist.
 */
export async function resolveBrunoLastfm7DaysImportTracks(
  weekDateInput: unknown,
  limit: number,
  username: string,
  handle?: string | null,
): Promise<LastfmImportResult> {
  const anchor = parseChartWeekPickerDate(weekDateInput) ?? new Date();
  const toExclusive = Math.floor(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate() + 1) / 1000,
  );
  const from = toExclusive - 7 * 86400;
  const trackPlays = await fetchTracksBetweenUnix(from, toExclusive, username);
  const scored = trackPlays
    .map((tp) => ({
      track: tp.track,
      artist: tp.artist,
      album: tp.album,
      score: tp.dayPlays.reduce((acc, p) => acc + p.plays, 0),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const tracks = scored
    .slice(0, limit)
    .map((t) => ({
      track: t.track,
      artist: t.artist,
      album: t.album,
      playcount: t.score,
    }));

  return {
    tracks,
    periodLabel: "últimos 7 dias",
    source: "rolling_30day_weighted",
  };
}

/**
 * Import ponderado — scrobbles dos últimos 30 dias, sem filtro de playlist.
 */
export async function resolveBrunoLastfmImportTracks(
  weekDateInput: unknown,
  limit: number,
  username: string,
  handle?: string | null,
): Promise<LastfmImportResult> {
  const anchor = parseChartWeekPickerDate(weekDateInput) ?? new Date();
  const { recentPlayWeight, olderPlayWeight, periodLabel } = resolveWeightedImportWeights(handle);
  const toExclusive = Math.floor(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate() + 1) / 1000,
  );
  const from = toExclusive - 30 * 86400;
  const trackPlays = await fetchTracksBetweenUnix(from, toExclusive, username);
  const tracks = scoreWeightedImportTracks(trackPlays, anchor, recentPlayWeight, olderPlayWeight)
    .slice(0, limit)
    .map((t) => ({
      track: t.track,
      artist: t.artist,
      album: t.album,
      playcount: t.score,
    }));

  return {
    tracks,
    periodLabel,
    source: "rolling_30day_weighted",
  };
}

/**
 * Semana ISO atual → top tracks rolling `1month` do Last.fm.
 * Outras semanas → scrobbles do mês civil anterior à data da parada, ranqueados por plays.
 */
export async function resolveLastfmImportTracks(
  weekDateInput: unknown,
  limit: number,
  username: string,
): Promise<LastfmImportResult> {
  const anchor = parseChartWeekPickerDate(weekDateInput) ?? new Date();

  if (isCurrentChartWeek(anchor)) {
    return {
      tracks: await fetchTopTracks("1month", limit, username),
      periodLabel: "último mês",
      source: "rolling_1month",
    };
  }

  const { from, toExclusive } = previousCalendarMonthUnixRange(anchor);
  const trackPlays = await fetchTracksBetweenUnix(from, toExclusive, username);
  const tracks = scoreLastfmTracks(trackPlays, limit).map((t) => ({
    track: t.track,
    artist: t.artist,
    album: t.album,
    playcount: t.score,
  }));

  return {
    tracks,
    periodLabel: formatPreviousCalendarMonthLabel(anchor),
    source: "calendar_month",
  };
}

export function describeLastfmImportPeriod(
  weekDateInput: unknown,
  handle?: string | null,
  filterNewHits = true,
): string {
  const weighted = getWeightedLastfmImportConfig(handle);
  if (weighted) {
    const weightsLabel = formatWeightedLastfmWeightsLabel(weighted);
    if (filterNewHits) {
      const lastfmNote = weighted.useMyTrlOwnerLastfm
        ? "O histórico vem do Last.fm do @bruno. "
        : "";
      return `${lastfmNote}Suas músicas dos últimos 30 dias serão importadas, ordenadas por pontuação ponderada (${weightsLabel}). Apenas faixas da playlist Spotify "${weighted.playlistLabel}" entram na parada.`;
    }
    const lastfmNote = weighted.useMyTrlOwnerLastfm
      ? "O histórico vem do Last.fm do @bruno. "
      : "";
    return `${lastfmNote}Suas músicas dos últimos 30 dias serão importadas, ordenadas por pontuação ponderada (${weightsLabel}). Todas as faixas ouvidas no período entram na parada.`;
  }
  const anchor = parseChartWeekPickerDate(weekDateInput) ?? new Date();
  if (isCurrentChartWeek(anchor)) {
    return "Suas top tracks do Last.fm no último mês serão importadas, na ordem oficial do Last.fm.";
  }
  const label = formatPreviousCalendarMonthLabel(anchor);
  return `Suas músicas mais ouvidas em ${label} serão importadas, ordenadas por plays no Last.fm.`;
}

export function describeLastfmImportOrder(
  weekDateInput: unknown,
  handle?: string | null,
  filterNewHits = true,
): string {
  const weighted = getWeightedLastfmImportConfig(handle);
  if (weighted) {
    if (filterNewHits) {
      return `Máximo de 200 músicas. Período: últimos 30 dias. Somente faixas da playlist "${weighted.playlistLabel}".`;
    }
    return "Máximo de 200 músicas. Período: últimos 30 dias. Sem filtro de playlist.";
  }
  const anchor = parseChartWeekPickerDate(weekDateInput) ?? new Date();
  if (isCurrentChartWeek(anchor)) {
    return "Máximo de 200 músicas. Ordenadas pelo ranking mensal do Last.fm.";
  }
  return `Máximo de 200 músicas. Período: ${formatPreviousCalendarMonthLabel(anchor)}.`;
}

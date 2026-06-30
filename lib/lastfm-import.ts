import { fetchTopTracks, fetchTracksBetweenUnix, type TopTrack, type TrackPlays } from "./lastfm";
import { scoreLastfmTracks } from "./lastfm-chart-engine";
import { isMyTrlOwner } from "./mytrl-access";
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

/** @bruno — últimos 7 dias (incl. hoje): ×20; dias 8–30: ×10. */
function brunoImportPlayWeight(diffDays: number): number {
  if (diffDays < 0 || diffDays >= 30) return 0;
  if (diffDays < 7) return 20;
  return 10;
}

function computeBrunoImportScore(dayPlays: TrackPlays["dayPlays"], referenceDay: Date): number {
  const refMs = Date.UTC(referenceDay.getUTCFullYear(), referenceDay.getUTCMonth(), referenceDay.getUTCDate());
  let score = 0;

  for (const { date, plays } of dayPlays) {
    const playMs = new Date(`${date}T00:00:00Z`).getTime();
    const diffDays = Math.round((refMs - playMs) / 86_400_000);
    const w = brunoImportPlayWeight(diffDays);
    if (w === 0) continue;
    score += plays * w;
  }

  return score;
}

function scoreBrunoImportTracks(
  trackPlays: TrackPlays[],
  referenceDay: Date,
): Array<{ track: string; artist: string; album: string; score: number }> {
  return trackPlays
    .map((tp) => ({
      track: tp.track,
      artist: tp.artist,
      album: tp.album,
      score: computeBrunoImportScore(tp.dayPlays, referenceDay),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
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

/**
 * @bruno — cruza todos os scrobbles dos últimos 30 dias com a playlist "new hits"
 * (sem cortar no top 200 antes do filtro).
 */
export async function resolveBrunoNewHitsImportTracks(
  weekDateInput: unknown,
  username: string,
  playlistTracks: Array<{ spotifyId: string; title: string; artist: string; album: string; imageUrl: string | null }>,
): Promise<{ tracks: BrunoNewHitsImportTrack[]; periodLabel: string }> {
  const anchor = parseChartWeekPickerDate(weekDateInput) ?? new Date();
  const toExclusive = Math.floor(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate() + 1) / 1000,
  );
  const from = toExclusive - 30 * 86400;
  const trackPlays = await fetchTracksBetweenUnix(from, toExclusive, username);
  const scored = scoreBrunoImportTracks(trackPlays, anchor);

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
    periodLabel: "últimos 30 dias (7d ×20, demais ×10)",
  };
}

/**
 * @bruno — scrobbles dos últimos 30 dias, ranqueados por plays ponderados
 * (7 dias recentes ×20, demais ×10), sem filtro de playlist.
 */
export async function resolveBrunoLastfmImportTracks(
  weekDateInput: unknown,
  limit: number,
  username: string,
): Promise<LastfmImportResult> {
  const anchor = parseChartWeekPickerDate(weekDateInput) ?? new Date();
  const toExclusive = Math.floor(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate() + 1) / 1000,
  );
  const from = toExclusive - 30 * 86400;
  const trackPlays = await fetchTracksBetweenUnix(from, toExclusive, username);
  const tracks = scoreBrunoImportTracks(trackPlays, anchor)
    .slice(0, limit)
    .map((t) => ({
      track: t.track,
      artist: t.artist,
      album: t.album,
      playcount: t.score,
    }));

  return {
    tracks,
    periodLabel: "últimos 30 dias (7d ×20, demais ×10)",
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
  if (isMyTrlOwner(handle)) {
    if (filterNewHits) {
      return 'Suas músicas dos últimos 30 dias serão importadas, ordenadas por pontuação ponderada (7 dias recentes ×20, demais ×10). Apenas faixas da playlist Spotify "new hits" entram na parada.';
    }
    return "Suas músicas dos últimos 30 dias serão importadas, ordenadas por pontuação ponderada (7 dias recentes ×20, demais ×10). Todas as faixas ouvidas no período entram na parada.";
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
  if (isMyTrlOwner(handle)) {
    if (filterNewHits) {
      return 'Máximo de 200 músicas. Período: últimos 30 dias. Somente faixas da playlist "new hits".';
    }
    return "Máximo de 200 músicas. Período: últimos 30 dias. Sem filtro de playlist.";
  }
  const anchor = parseChartWeekPickerDate(weekDateInput) ?? new Date();
  if (isCurrentChartWeek(anchor)) {
    return "Máximo de 200 músicas. Ordenadas pelo ranking mensal do Last.fm.";
  }
  return `Máximo de 200 músicas. Período: ${formatPreviousCalendarMonthLabel(anchor)}.`;
}

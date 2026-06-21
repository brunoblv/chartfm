import { fetchTopTracks, fetchTracksBetweenUnix, type TopTrack } from "./lastfm";
import { scoreLastfmTracks } from "./lastfm-chart-engine";
import {
  formatPreviousCalendarMonthLabel,
  isCurrentChartWeek,
  parseChartWeekPickerDate,
  previousCalendarMonthUnixRange,
} from "./chart-week";

export type LastfmImportResult = {
  tracks: TopTrack[];
  periodLabel: string;
  source: "rolling_1month" | "calendar_month";
};

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

export function describeLastfmImportPeriod(weekDateInput: unknown): string {
  const anchor = parseChartWeekPickerDate(weekDateInput) ?? new Date();
  if (isCurrentChartWeek(anchor)) {
    return "Suas top tracks do Last.fm no último mês serão importadas, na ordem oficial do Last.fm.";
  }
  const label = formatPreviousCalendarMonthLabel(anchor);
  return `Suas músicas mais ouvidas em ${label} serão importadas, ordenadas por plays no Last.fm.`;
}

export function describeLastfmImportOrder(weekDateInput: unknown): string {
  const anchor = parseChartWeekPickerDate(weekDateInput) ?? new Date();
  if (isCurrentChartWeek(anchor)) {
    return "Máximo de 200 músicas. Ordenadas pelo ranking mensal do Last.fm.";
  }
  return `Máximo de 200 músicas. Período: ${formatPreviousCalendarMonthLabel(anchor)}.`;
}

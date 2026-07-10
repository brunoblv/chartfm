import type { Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/translate";
import { formatSongArtist } from "@/lib/song-artist";
import { lookupNumberOnes } from "@/lib/song-stats-key";
import type { ChartEntry, PersonalDropoutEntry } from "@/lib/types";

function formatPeakPart(
  t: (key: string, params?: Record<string, string | number>) => string,
  peak: number,
  personal: number,
): string {
  return personal > 0
    ? t("chart.copyFmt.peakWithOnes", { peak, ones: personal })
    : t("chart.copyFmt.peak", { peak });
}

function formatTenureCopy(
  t: (key: string, params?: Record<string, string | number>) => string,
  weeks: number,
  isDaily: boolean,
): string {
  if (isDaily) {
    return weeks === 1
      ? t("chart.copyFmt.tenureOneDay")
      : t("chart.copyFmt.tenureDays", { count: weeks });
  }
  return weeks === 1
    ? t("chart.copyFmt.tenureOneWeek")
    : t("chart.copyFmt.tenureWeeks", { count: weeks });
}

function formatMovementCopy(
  t: (key: string, params?: Record<string, string | number>) => string,
  status: ChartEntry["status"],
  delta?: number | null,
): string {
  switch (status) {
    case "new":
      return t("chart.movementNew");
    case "return":
      return t("chart.movementReturn");
    case "up":
      return `+${delta ?? 0}`;
    case "down":
      return `-${Math.abs(delta ?? 0)}`;
    default:
      return "-";
  }
}

function formatChartCopyLine(
  t: (key: string, params?: Record<string, string | number>) => string,
  position: number,
  song: ChartEntry["song"],
  weeks: number,
  movement: string,
  peak: number,
  personal: number,
  isDaily: boolean,
): string {
  const pos = String(position).padStart(2, "0");
  const artist = formatSongArtist(song);
  const tenure = formatTenureCopy(t, weeks, isDaily);
  const peakPart = formatPeakPart(t, peak, personal);
  return `${pos}. ${artist} - ${song.title} [${tenure} / ${movement} / ${peakPart}]`;
}

export function buildChartCopyText(options: {
  entries: ChartEntry[];
  dropouts: PersonalDropoutEntry[];
  personalNumberOnes?: Record<string, number>;
  isDaily: boolean;
  locale: Locale;
}): string {
  const { entries, dropouts, personalNumberOnes, isDaily, locale } = options;
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(locale, key, params);

  const lines = entries.map((entry) => {
    const personal = lookupNumberOnes(personalNumberOnes, entry.song);
    const movement = formatMovementCopy(t, entry.status, entry.delta);
    return formatChartCopyLine(
      t,
      entry.position,
      entry.song,
      entry.weeks,
      movement,
      entry.peak,
      personal,
      isDaily,
    );
  });

  if (dropouts.length > 0) {
    lines.push("");
    lines.push(t("chart.copyFmt.dropoutsHeader"));
    for (const entry of dropouts) {
      const personal = lookupNumberOnes(personalNumberOnes, entry.song);
      lines.push(
        formatChartCopyLine(
          t,
          entry.lastPos,
          entry.song,
          entry.weeks,
          t("chart.copyFmt.exit"),
          entry.peak,
          personal,
          isDaily,
        ),
      );
    }
  }

  return lines.join("\n");
}

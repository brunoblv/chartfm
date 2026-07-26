import type { Locale } from "./config";

/** Data curta para “Fundada em …” / “Founded …”. */
export function formatCommunityFoundedDate(
  locale: Locale,
  createdAtIso: string | null | undefined,
  foundedFallback: string,
): string {
  if (createdAtIso) {
    const d = new Date(createdAtIso);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(locale === "en" ? "en-US" : "pt-BR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
  }
  return foundedFallback;
}

/** "Semana 21 - 2026" → "Week 21, 2026" (en) or "Semana 21, 2026" (pt-BR). */
export function formatWeekLabel(locale: Locale, weekLabel: string): string {
  const match = weekLabel.match(/Semana\s+(\d+)\s*[-–]\s*(\d{4})/i);
  if (!match) return weekLabel;
  const week = match[1];
  const year = match[2];
  return locale === "en" ? `Week ${week}, ${year}` : `Semana ${week}, ${year}`;
}

export function formatRelativeTime(locale: Locale, date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (locale === "en") {
    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "1d ago";
    return `${diffDays}d ago`;
  }

  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `há ${diffMins}min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays === 1) return "há 1d";
  return `há ${diffDays}d`;
}

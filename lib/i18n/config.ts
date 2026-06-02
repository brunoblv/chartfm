export const LOCALES = ["pt-BR", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pt-BR";
export const LOCALE_COOKIE = "chartfm.locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "pt-BR" || value === "en";
}

/** Prefer browser language on first visit (no cookie yet). */
export function localeFromAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const first = header.split(",")[0]?.trim().toLowerCase() ?? "";
  if (first.startsWith("en")) return "en";
  return DEFAULT_LOCALE;
}

export const LOCALE_LABELS: Record<Locale, { short: string; full: string }> = {
  "pt-BR": { short: "PT", full: "Português (Brasil)" },
  en: { short: "EN", full: "English" },
};

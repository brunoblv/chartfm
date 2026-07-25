"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Locale,
  isLocale,
} from "@/lib/i18n/config";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

export const LocaleContext = createContext<LocaleContextValue | null>(null);

function persistLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
  try {
    localStorage.setItem(LOCALE_COOKIE, locale);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = locale;
}

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(
    isLocale(initialLocale) ? initialLocale : DEFAULT_LOCALE,
  );
  const router = useRouter();

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
    // Textos vindos de server components (postedAgo, weekLabel, etc.) ficam
    // "presos" no idioma antigo até um refresh do RSC payload.
    router.refresh();
  }, [router]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

"use client";

import { useCallback, useContext } from "react";
import { LocaleContext } from "@/components/i18n/LocaleProvider";
import { translate } from "@/lib/i18n/translate";

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}

export function useTranslations() {
  const { locale } = useLocale();

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(locale, key, params),
    [locale],
  );

  return { t, locale };
}

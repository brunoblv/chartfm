"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n/config";

export function Providers({
  children,
  session,
  initialLocale,
}: {
  children: React.ReactNode;
  session: Session | null;
  initialLocale: Locale;
}) {
  return (
    <SessionProvider session={session}>
      <LocaleProvider initialLocale={initialLocale}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </LocaleProvider>
    </SessionProvider>
  );
}

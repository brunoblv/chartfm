"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { CookieConsentBanner } from "@/components/privacy/CookieConsentBanner";
import { ThemeProvider } from "@/components/ThemeProvider";

export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return (
    <SessionProvider session={session}>
      <ThemeProvider>
        {children}
        <CookieConsentBanner />
      </ThemeProvider>
    </SessionProvider>
  );
}

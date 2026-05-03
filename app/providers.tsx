"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { CookieConsentBanner } from "@/components/privacy/CookieConsentBanner";

export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return (
    <SessionProvider session={session}>
      {children}
      <CookieConsentBanner />
    </SessionProvider>
  );
}

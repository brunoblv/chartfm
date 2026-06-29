"use client";

/**
 * AdSlot — slot reutilizável do Google AdSense
 *
 * Publisher ID: ca-pub-4600084865044867 (já carregado em app/layout.tsx)
 */

import { useEffect, useRef, useState } from "react";
import { isAdSlotConfigured } from "@/lib/adsense-slots";
import { CONSENT_STORAGE_KEY, hasAdsConsent } from "@/lib/consent";

export type AdFormat =
  | "leaderboard"
  | "rectangle"
  | "mobile-banner"
  | "auto";

interface AdSlotProps {
  slotId: string;
  format?: AdFormat;
  style?: React.CSSProperties;
}

const PUB_ID = "ca-pub-4600084865044867";

const MIN_HEIGHT: Record<AdFormat, number> = {
  leaderboard: 90,
  rectangle: 250,
  "mobile-banner": 100,
  auto: 100,
};

const WRAPPER_MAX_WIDTH: Record<AdFormat, number | string> = {
  leaderboard: 728,
  rectangle: 300,
  "mobile-banner": 320,
  auto: "100%",
};

export function AdSlot({ slotId, format = "auto", style }: AdSlotProps) {
  const pushed = useRef(false);
  const active = isAdSlotConfigured(slotId);
  const [adsAllowed, setAdsAllowed] = useState(false);

  useEffect(() => {
    function sync() {
      setAdsAllowed(hasAdsConsent(localStorage.getItem(CONSENT_STORAGE_KEY)));
    }
    sync();
    window.addEventListener("chartfm-consent-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("chartfm-consent-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!active || !adsAllowed) return;
    if (pushed.current) return;
    try {
      (
        (window as unknown as { adsbygoogle: unknown[] }).adsbygoogle =
          (window as unknown as { adsbygoogle: unknown[] }).adsbygoogle ?? []
      ).push({});
      pushed.current = true;
    } catch {
      // script ainda não carregou
    }
  }, [active, adsAllowed]);

  if (!active || !adsAllowed) return null;

  const isAuto = format === "auto";

  return (
    <div
      aria-hidden="true"
      style={{
        display: "flex",
        justifyContent: "center",
        overflow: "hidden",
        minHeight: MIN_HEIGHT[format],
        maxWidth: WRAPPER_MAX_WIDTH[format],
        width: "100%",
        margin: "0 auto",
        ...style,
      }}
    >
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "100%", minHeight: MIN_HEIGHT[format] }}
        data-ad-client={PUB_ID}
        data-ad-slot={slotId}
        {...(isAuto
          ? { "data-ad-format": "auto", "data-full-width-responsive": "true" }
          : {})}
      />
    </div>
  );
}

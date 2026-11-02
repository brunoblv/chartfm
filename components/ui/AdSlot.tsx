"use client";

/**
 * AdSlot — slot reutilizável do Google AdSense.
 *
 * O script adsbygoogle.js NÃO é carregado globalmente: só entra na página quando
 * um slot elegível renderiza. Carregá-lo no layout disparava requisições (e Auto
 * ads) em páginas noindex, fichas automáticas e diretórios sem contribuição —
 * superfícies que a política do AdSense não permite monetizar.
 */

import Script from "next/script";
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
  /** Decidido no servidor por lib/content-quality.ts. */
  eligible: boolean;
  format?: AdFormat;
  style?: React.CSSProperties;
}

const PUB_ID = "ca-pub-4600084865044867";
const ADSENSE_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${PUB_ID}`;

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

export function AdSlot({ slotId, eligible, format = "auto", style }: AdSlotProps) {
  const pushed = useRef(false);
  const active = eligible && isAdSlotConfigured(slotId);
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

  // A fila window.adsbygoogle é processada quando o script termina de carregar.
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
      // ignora: slot fica vazio
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
      <Script
        id="adsbygoogle-js"
        src={ADSENSE_SRC}
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
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

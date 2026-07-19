"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { CONSENT_STORAGE_KEY, hasAdsConsent } from "@/lib/consent";

const ADSENSE_SRC =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4600084865044867";

const AD_PROVIDER = process.env.NEXT_PUBLIC_AD_PROVIDER === "adsterra" ? "adsterra" : "adsense";

export function AdSenseScript() {
  const [loadAds, setLoadAds] = useState(false);

  useEffect(() => {
    function sync() {
      setLoadAds(hasAdsConsent(localStorage.getItem(CONSENT_STORAGE_KEY)));
    }
    sync();
    window.addEventListener("chartfm-consent-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("chartfm-consent-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (AD_PROVIDER !== "adsense" || !loadAds) return null;

  return (
    <Script src={ADSENSE_SRC} crossOrigin="anonymous" strategy="afterInteractive" />
  );
}

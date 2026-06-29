"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { CONSENT_STORAGE_KEY, hasAdsConsent } from "@/lib/consent";

const ADSENSE_SRC =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4600084865044867";

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

  if (!loadAds) return null;

  return (
    <Script src={ADSENSE_SRC} crossOrigin="anonymous" strategy="afterInteractive" />
  );
}

"use client";

/**
 * Componentes Adsterra — rodam isolados num <iframe srcDoc> pra evitar que os
 * scripts deles (document.write / manipulação direta do DOM) colidam com o React.
 */

import { useEffect, useState } from "react";
import { isAdsterraSlotConfigured } from "@/lib/adsterra-slots";
import { CONSENT_STORAGE_KEY, hasAdsConsent } from "@/lib/consent";

function useAdsConsent(): boolean {
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

  return adsAllowed;
}

interface AdsterraBannerProps {
  adKey: string;
  width: number;
  height: number;
  style?: React.CSSProperties;
}

/** Banner direto Adsterra (formato "iframe" via highperformanceformat.com). */
export function AdsterraBanner({ adKey, width, height, style }: AdsterraBannerProps) {
  const active = isAdsterraSlotConfigured(adKey);
  const adsAllowed = useAdsConsent();

  if (!active || !adsAllowed) return null;

  const srcDoc = `<!doctype html><html><head><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent;}</style></head><body>
<script>
atOptions = { key: ${JSON.stringify(adKey)}, format: "iframe", height: ${height}, width: ${width}, params: {} };
</script>
<script src="//www.highperformanceformat.com/${adKey}/invoke.js"></script>
</body></html>`;

  return (
    <div
      aria-hidden="true"
      style={{
        display: "flex",
        justifyContent: "center",
        overflow: "hidden",
        width: "100%",
        margin: "0 auto",
        ...style,
      }}
    >
      <iframe
        title="advertisement"
        srcDoc={srcDoc}
        width={width}
        height={height}
        scrolling="no"
        style={{ border: "none", maxWidth: "100%" }}
      />
    </div>
  );
}

interface AdsterraNativeProps {
  scriptSrc: string;
  adKey: string;
  style?: React.CSSProperties;
}

/** Native banner Adsterra (widget 4:1) — se estiliza como conteúdo do site. */
export function AdsterraNative({ scriptSrc, adKey, style }: AdsterraNativeProps) {
  const active = isAdsterraSlotConfigured(scriptSrc) && isAdsterraSlotConfigured(adKey);
  const adsAllowed = useAdsConsent();

  if (!active || !adsAllowed) return null;

  const srcDoc = `<!doctype html><html><head><style>html,body{margin:0;padding:0;}</style></head><body>
<div id="container-${adKey}"></div>
<script async data-cfasync="false" src="${scriptSrc}"></script>
</body></html>`;

  return (
    <div aria-hidden="true" style={{ width: "100%", minHeight: 90, ...style }}>
      <iframe
        title="advertisement"
        srcDoc={srcDoc}
        scrolling="no"
        style={{ border: "none", width: "100%", minHeight: 90 }}
      />
    </div>
  );
}

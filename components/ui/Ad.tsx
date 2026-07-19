"use client";

/**
 * Ad — escolhe o provedor de anúncio (AdSense ou Adsterra) por placement,
 * controlado pela env NEXT_PUBLIC_AD_PROVIDER ("adsense" | "adsterra", default "adsense").
 * Os call-sites usam `placement` em vez de `slotId` para funcionar com os dois provedores.
 *
 * No Adsterra: "leaderboard"/"mobile-banner" viram Direct Banner (tamanho fixo por placement,
 * via ADSTERRA_SLOTS); "rectangle"/"auto" viram Native Banner (zona única 4:1, via ADSTERRA_NATIVE)
 * já que esses slots são faixas de largura total dentro do conteúdo, não caixas de banner isoladas.
 */

import { AdSlot, type AdFormat } from "@/components/ui/AdSlot";
import { AdsterraBanner, AdsterraNative } from "@/components/ui/AdsterraSlot";
import { ADSENSE_SLOTS } from "@/lib/adsense-slots";
import { ADSTERRA_NATIVE, ADSTERRA_SLOTS } from "@/lib/adsterra-slots";

export type { AdFormat };
export type AdPlacement = keyof typeof ADSENSE_SLOTS;

const AD_PROVIDER: "adsense" | "adsterra" =
  process.env.NEXT_PUBLIC_AD_PROVIDER === "adsterra" ? "adsterra" : "adsense";

const ADSTERRA_BANNER_SIZE: Record<"leaderboard" | "mobile-banner", { width: number; height: number }> = {
  leaderboard: { width: 728, height: 90 },
  "mobile-banner": { width: 320, height: 50 },
};

interface AdProps {
  placement: AdPlacement;
  format?: AdFormat;
  style?: React.CSSProperties;
}

export function Ad({ placement, format = "auto", style }: AdProps) {
  if (AD_PROVIDER === "adsterra") {
    if (format === "leaderboard" || format === "mobile-banner") {
      const { width, height } = ADSTERRA_BANNER_SIZE[format];
      return <AdsterraBanner adKey={ADSTERRA_SLOTS[placement]} width={width} height={height} style={style} />;
    }
    return <AdsterraNative scriptSrc={ADSTERRA_NATIVE.scriptSrc} adKey={ADSTERRA_NATIVE.key} style={style} />;
  }
  return <AdSlot slotId={ADSENSE_SLOTS[placement]} format={format} style={style} />;
}

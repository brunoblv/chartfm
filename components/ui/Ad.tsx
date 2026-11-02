"use client";

/**
 * Ad — wrapper fino sobre o AdSlot (AdSense), usado pelos call-sites via `placement`.
 */

import { AdSlot, type AdFormat } from "@/components/ui/AdSlot";
import { ADSENSE_SLOTS } from "@/lib/adsense-slots";

export type { AdFormat };
export type AdPlacement = keyof typeof ADSENSE_SLOTS;

interface AdProps {
  placement: AdPlacement;
  /** Obrigatório: a página precisa provar que tem conteúdo próprio (lib/content-quality.ts). */
  eligible: boolean;
  format?: AdFormat;
  style?: React.CSSProperties;
}

export function Ad({ placement, eligible, format = "auto", style }: AdProps) {
  return <AdSlot slotId={ADSENSE_SLOTS[placement]} eligible={eligible} format={format} style={style} />;
}

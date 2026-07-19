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
  format?: AdFormat;
  style?: React.CSSProperties;
}

export function Ad({ placement, format = "auto", style }: AdProps) {
  return <AdSlot slotId={ADSENSE_SLOTS[placement]} format={format} style={style} />;
}

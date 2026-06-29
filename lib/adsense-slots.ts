/**
 * IDs dos slots AdSense — configure no painel Google AdSense e defina no .env.
 * Publisher: ca-pub-4600084865044867 (app/layout.tsx)
 */
export const ADSENSE_SLOTS = {
  song: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SONG ?? "",
  chart: process.env.NEXT_PUBLIC_ADSENSE_SLOT_CHART ?? "",
  globalHub: process.env.NEXT_PUBLIC_ADSENSE_SLOT_GLOBAL_HUB ?? "",
  global100: process.env.NEXT_PUBLIC_ADSENSE_SLOT_GLOBAL_100 ?? "",
  profile: process.env.NEXT_PUBLIC_ADSENSE_SLOT_PROFILE ?? "",
  homeFeed: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_FEED ?? "",
  criticsFm: process.env.NEXT_PUBLIC_ADSENSE_SLOT_CRITICS_FM ?? "",
} as const;

const PLACEHOLDER_RE = /^COLE_AQUI/i;

export function isAdSlotConfigured(slotId: string | undefined | null): slotId is string {
  const id = slotId?.trim() ?? "";
  return id.length > 0 && !PLACEHOLDER_RE.test(id);
}

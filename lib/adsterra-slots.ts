/**
 * Keys de banner Adsterra (direct banner, highperformanceformat.com) — configure
 * no painel Adsterra e defina no .env. Mesma nomenclatura de placement usada em
 * lib/adsense-slots.ts, para o componente Ad poder alternar entre provedores.
 */
export const ADSTERRA_SLOTS = {
  song: process.env.NEXT_PUBLIC_ADSTERRA_KEY_SONG ?? "",
  chart: process.env.NEXT_PUBLIC_ADSTERRA_KEY_CHART ?? "",
  globalHub: process.env.NEXT_PUBLIC_ADSTERRA_KEY_GLOBAL_HUB ?? "",
  global100: process.env.NEXT_PUBLIC_ADSTERRA_KEY_GLOBAL_100 ?? "",
  profile: process.env.NEXT_PUBLIC_ADSTERRA_KEY_PROFILE ?? "",
  homeFeed: process.env.NEXT_PUBLIC_ADSTERRA_KEY_HOME_FEED ?? "",
  criticsFm: process.env.NEXT_PUBLIC_ADSTERRA_KEY_CRITICS_FM ?? "",
  editorial: process.env.NEXT_PUBLIC_ADSTERRA_KEY_EDITORIAL ?? "",
} as const;

export function isAdsterraSlotConfigured(key: string | undefined | null): key is string {
  return (key?.trim().length ?? 0) > 0;
}

/**
 * Zona única de Native Banner (layout 4:1), usada em todos os placements
 * "rectangle"/"auto" — eles são faixas horizontais de largura total dentro
 * do fluxo de conteúdo, o formato que o widget 4:1 do Adsterra foi pensado pra preencher.
 */
export const ADSTERRA_NATIVE = {
  scriptSrc: process.env.NEXT_PUBLIC_ADSTERRA_NATIVE_SRC ?? "",
  key: process.env.NEXT_PUBLIC_ADSTERRA_NATIVE_KEY ?? "",
} as const;

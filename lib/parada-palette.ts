import { COVER_PALETTES } from "@/lib/data";

/** Paletas de destaque para cards e hero das paradas pessoais. */
export const PARADA_PALETTES: [string, string][] = [
  ["#FA243C", "#FF8C69"],
  ["#7C3AED", "#A78BFA"],
  ["#0A84FF", "#5AC8FA"],
  ["#FF9F0A", "#FFD60A"],
  ...COVER_PALETTES,
];

export function paradaPalette(sortOrder: number): [string, string] {
  return PARADA_PALETTES[Math.abs(sortOrder) % PARADA_PALETTES.length];
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function paradaGradientStyle(palette: [string, string], alpha = 0.12): string {
  const [a, b] = palette.map(hexToRgb) as [[number, number, number], [number, number, number]];
  return `linear-gradient(135deg, rgba(${a[0]},${a[1]},${a[2]},${alpha}) 0%, rgba(${b[0]},${b[1]},${b[2]},${alpha * 0.5}) 100%)`;
}

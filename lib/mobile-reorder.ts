export type MobileReorderMode = "arrows" | "position" | "swap";

export const MOBILE_REORDER_STORAGE_KEY = "chartfm.mobile-reorder-mode";
export const DEFAULT_MOBILE_REORDER_MODE: MobileReorderMode = "arrows";

export function readMobileReorderMode(): MobileReorderMode {
  if (typeof window === "undefined") return DEFAULT_MOBILE_REORDER_MODE;
  try {
    const stored = localStorage.getItem(MOBILE_REORDER_STORAGE_KEY);
    if (stored === "arrows" || stored === "position" || stored === "swap") return stored;
  } catch {
    // ignore
  }
  return DEFAULT_MOBILE_REORDER_MODE;
}

export function writeMobileReorderMode(mode: MobileReorderMode) {
  try {
    localStorage.setItem(MOBILE_REORDER_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

export function moveItemUp<T>(items: T[], index: number): T[] {
  if (index <= 0) return items;
  const next = [...items];
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  return next;
}

export function moveItemDown<T>(items: T[], index: number): T[] {
  if (index >= items.length - 1) return items;
  const next = [...items];
  [next[index], next[index + 1]] = [next[index + 1], next[index]];
  return next;
}

export function swapItemsAt<T>(items: T[], a: number, b: number): T[] {
  if (a === b) return items;
  const next = [...items];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

export function moveItemToIndex<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

type ModeMeta = {
  tab: string;
  label: string;
  description: string;
  hint: (ctx: { selectedTitle: string | null }) => string;
};

export const MOBILE_REORDER_MODE_META: Record<MobileReorderMode, ModeMeta> = {
  arrows: {
    tab: "↑↓  Botões",
    label: "↑↓  Botões de movimento",
    description:
      "Simples e previsível — move uma posição por toque. Ideal para ajustes de 1–2 posições.",
    hint: () => "Toque ↑ ou ↓ para mover uma posição",
  },
  position: {
    tab: "#  Posição",
    label: "#  Edição direta de posição",
    description:
      "Perfeito para saltos grandes. Toque na faixa e digite a posição ou use as setas.",
    hint: () => "Toque em uma faixa para definir a posição",
  },
  swap: {
    tab: "✦  Selecionar",
    label: "✦  Selecionar e trocar",
    description:
      "Toque em uma faixa para selecioná-la, depois toque no destino — elas trocam de lugar.",
    hint: ({ selectedTitle }) =>
      selectedTitle
        ? `"${selectedTitle}" selecionada — toque no destino`
        : "Toque em uma faixa para selecioná-la",
  },
};

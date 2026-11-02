import { calcularPontosPrimary } from "@/lib/parada-points";

/**
 * Fonte única dos números de pontuação exibidos em guias, FAQ, landing e editoriais.
 * Nenhum texto deve citar pontos fixos: tudo vem de `calcularPontosPrimary`, a mesma
 * função usada no backend ao publicar a parada (ChartEntry.points).
 */

export const SCORING_MAX_POSITION = 100;

export type ScoringTableRow = { position: number; points: number };

/** Tabela completa 1–100 usada na documentação. */
export function scoringTable(maxPosition = SCORING_MAX_POSITION): ScoringTableRow[] {
  return Array.from({ length: maxPosition }, (_, i) => ({
    position: i + 1,
    points: calcularPontosPrimary(i + 1),
  }));
}

/** Posições destacadas no texto/tabela resumida. */
export const SCORING_HIGHLIGHT_POSITIONS = [1, 2, 3, 4, 5, 10, 15, 20, 30, 50, 75, 100] as const;

const EXAMPLE_MULTI_TOP = 5;
const EXAMPLE_LOW_POSITION = 20;

/**
 * Parâmetros de interpolação para os textos i18n que citam a fórmula.
 * Placeholders: {p1} {p2} {p3} {p5} {p10} {p20} {p50} {p100}, {top3x}, {ex1plus10},
 * {multiTop}, {multiTopTotal}, {lowPos}, {lowPts}, {lowCharts}, {lowTotal}.
 */
export function scoringDocParams(locale: string): Record<string, string> {
  const fmt = (n: number) => n.toLocaleString(locale);
  const p = (pos: number) => calcularPontosPrimary(pos);

  const multiTopTotal = EXAMPLE_MULTI_TOP * p(1);
  const lowPts = p(EXAMPLE_LOW_POSITION);
  const lowCharts = Math.ceil(multiTopTotal / lowPts);

  return {
    p1: fmt(p(1)),
    p2: fmt(p(2)),
    p3: fmt(p(3)),
    p5: fmt(p(5)),
    p10: fmt(p(10)),
    p20: fmt(p(20)),
    p50: fmt(p(50)),
    p100: fmt(p(100)),
    top3x: fmt(3 * p(1)),
    ex1plus10: fmt(p(1) + p(10)),
    multiTop: String(EXAMPLE_MULTI_TOP),
    multiTopTotal: fmt(multiTopTotal),
    lowPos: String(EXAMPLE_LOW_POSITION),
    lowPts: fmt(lowPts),
    lowCharts: String(lowCharts),
    lowTotal: fmt(lowCharts * lowPts),
  };
}

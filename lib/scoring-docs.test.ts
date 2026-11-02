import { describe, expect, it } from "vitest";
import { calcularPontosPrimary } from "@/lib/parada-points";
import { scoringDocParams, scoringTable } from "@/lib/scoring-docs";
import { translate } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";

const SCORING_TEXT_KEYS = [
  "faq.a4",
  "guides.pontuacaoSec1Body1",
  "guides.pontuacaoSec1Body2",
  "guides.pontuacaoSec3Body1",
  "guides.pontuacaoSec3Body2",
  "guides.pontuacaoSec3Body3",
  "guides.pontuacaoSec4Body1",
  "guides.pontuacaoSec4Body2",
  "guides.global100Sec2Body1",
  "landing.calcP2",
];

describe("scoringTable", () => {
  it("as 100 posições documentadas batem com o cálculo real do backend", () => {
    const rows = scoringTable();
    expect(rows).toHaveLength(100);
    for (const row of rows) {
      expect(row.points).toBe(calcularPontosPrimary(row.position));
    }
    expect(rows[0].points).toBe(1000);
    expect(rows[1].points).toBe(900);
    expect(rows[2].points).toBe(850);
    expect(rows[99].points).toBe(10);
  });
});

describe("textos de pontuação", () => {
  for (const locale of ["pt-BR", "en"] as Locale[]) {
    it(`${locale}: não sobra placeholder nem número da fórmula antiga`, () => {
      const params = scoringDocParams(locale);
      for (const key of SCORING_TEXT_KEYS) {
        const text = translate(locale, key, params);
        expect(text, key).not.toBe(key);
        expect(text, key).not.toMatch(/\{\w+\}/);
        expect(text, key).not.toMatch(/95%|0[.,]95|\b950\b|\b903\b/);
      }
    });
  }

  it("exemplos citados derivam da função real", () => {
    const p = scoringDocParams("en");
    expect(p.p2).toBe(calcularPontosPrimary(2).toLocaleString("en"));
    expect(p.p100).toBe(calcularPontosPrimary(100).toLocaleString("en"));
    expect(p.ex1plus10).toBe((calcularPontosPrimary(1) + calcularPontosPrimary(10)).toLocaleString("en"));
    const lowCharts = Number(p.lowCharts);
    expect(lowCharts * calcularPontosPrimary(20)).toBeGreaterThanOrEqual(5 * calcularPontosPrimary(1));
    expect((lowCharts - 1) * calcularPontosPrimary(20)).toBeLessThan(5 * calcularPontosPrimary(1));
  });
});

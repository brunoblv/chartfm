import { describe, it, expect } from "vitest";
import {
  buildRetroChart,
  computeEraWeight,
  derivePeakPotential,
  evaluateEligibility,
  monthsBetween,
  normalizePeakPotential,
  peakScore,
  playsScore,
  releaseRefOf,
  type RetroContext,
  type RetroSongInput,
} from "./scoring";

// Fábrica de música com defaults neutros; sobrescreva o que o teste precisa.
function song(over: Partial<RetroSongInput> = {}): RetroSongInput {
  return {
    songId: "s",
    overallPlaycount: 100,
    periodPlaycount: null,
    lastScrobbleAt: null,
    hasScrobbleInPeriod: true,
    singleReleaseDate: new Date("2004-01-01"),
    albumReleaseDate: null,
    youtubeReleaseDate: null,
    top20Weeks: 0,
    top20BestPeak: null,
    numberOnes: 0,
    manualImportance: null,
    importanceLocked: false,
    manualPeakPotential: null,
    manualAdjustment: 0,
    eraOverrideWeight: null,
    ...over,
  };
}

function ctx(over: Partial<RetroContext> = {}): RetroContext {
  return {
    chartDate: new Date("2005-05-31"),
    mode: "retrospectivo",
    now: new Date("2026-07-17"),
    chartSize: 100,
    ...over,
  };
}

describe("elegibilidade", () => {
  it("exclui música lançada depois da data do chart (Firework em Maio/2005)", () => {
    const firework = song({ songId: "firework", singleReleaseDate: new Date("2010-10-26") });
    expect(evaluateEligibility(firework, ctx())).toBe("not_released");
  });

  it("inclui a mesma música num chart posterior ao lançamento", () => {
    const firework = song({ songId: "firework", singleReleaseDate: new Date("2010-10-26") });
    expect(evaluateEligibility(firework, ctx({ chartDate: new Date("2011-01-31") }))).toBe("eligible");
  });

  it("marca no_release_date quando não há nenhuma data", () => {
    const s = song({ singleReleaseDate: null, albumReleaseDate: null, youtubeReleaseDate: null });
    expect(evaluateEligibility(s, ctx())).toBe("no_release_date");
    expect(releaseRefOf(s)).toBeNull();
  });

  it("usa fallback álbum → clipe quando não há single", () => {
    const s = song({ singleReleaseDate: null, albumReleaseDate: new Date("2004-06-01") });
    expect(releaseRefOf(s)).toEqual(new Date("2004-06-01"));
    expect(evaluateEligibility(s, ctx())).toBe("eligible");
  });

  it("marca excluded_out quando o usuário define Peak Potential 'Fora' (bulk exclusion)", () => {
    const s = song({ manualPeakPotential: "out" });
    expect(evaluateEligibility(s, ctx())).toBe("excluded_out");
    const rows = buildRetroChart([s], ctx());
    expect(rows[0].eligible).toBe(false);
    expect(rows[0].position).toBeNull();
    expect(rows[0].scoreFinal).toBe(0);
  });

  it("modo histórico exige scrobble no período; retrospectivo não", () => {
    const s = song({ hasScrobbleInPeriod: false });
    expect(evaluateEligibility(s, ctx({ mode: "historico" }))).toBe("no_scrobble_in_period");
    expect(evaluateEligibility(s, ctx({ mode: "retrospectivo" }))).toBe("eligible");
  });
});

describe("era weight", () => {
  const brightside = (release: string) => song({ singleReleaseDate: new Date(release) });

  it("é 1.0 no auge (até 12 meses após o lançamento)", () => {
    expect(computeEraWeight(brightside("2005-01-01"), ctx())).toBe(1);
  });

  it("decai ao longo dos anos (Mr. Brightside: 2005 > 2010 > 2022)", () => {
    const rel = "2003-09-29";
    const ew2005 = computeEraWeight(brightside(rel), ctx({ chartDate: new Date("2005-05-31") }));
    const ew2010 = computeEraWeight(brightside(rel), ctx({ chartDate: new Date("2010-05-31") }));
    const ew2022 = computeEraWeight(brightside(rel), ctx({ chartDate: new Date("2022-05-31") }));
    expect(ew2005).toBeGreaterThan(ew2010);
    expect(ew2010).toBeGreaterThan(ew2022);
    expect(ew2022).toBeGreaterThanOrEqual(0.3); // piso
  });

  it("respeita override manual por ano", () => {
    const s = song({ eraOverrideWeight: 75 });
    expect(computeEraWeight(s, ctx())).toBeCloseTo(0.75, 5);
  });
});

describe("pré-2010: força estimada = overall × eraWeight", () => {
  it("música na época supera música antiga com o mesmo playcount (não domina chart antigo)", () => {
    const naEpoca = song({ songId: "epoca", overallPlaycount: 1000, singleReleaseDate: new Date("2005-01-01") });
    const antiga = song({ songId: "antiga", overallPlaycount: 1000, singleReleaseDate: new Date("1996-01-01") });
    const rows = buildRetroChart([naEpoca, antiga], ctx());
    const rEpoca = rows.find((r) => r.songId === "epoca")!;
    const rAntiga = rows.find((r) => r.songId === "antiga")!;
    expect(rEpoca.periodStrength).toBeGreaterThan(rAntiga.periodStrength);
    expect(rEpoca.scoreFinal).toBeGreaterThan(rAntiga.scoreFinal);
    expect(rEpoca.position).toBe(1);
    expect(rAntiga.position).toBe(2);
  });

  it("usa plays reais do período quando disponíveis (pós-2010)", () => {
    const s = song({ periodPlaycount: 28, overallPlaycount: 1482 });
    const rows = buildRetroChart([s], ctx());
    // com pool de 1 música, o próprio máximo → força normalizada = 1
    expect(rows[0].periodStrength).toBeCloseTo(1, 5);
  });
});

describe("peakScore — #1, Top 5, Top 10, depois de 10 em 10", () => {
  it("respeita as faixas", () => {
    expect(peakScore(null)).toBe(0);
    expect(peakScore(1)).toBe(1);
    expect(peakScore(5)).toBe(0.85);
    expect(peakScore(10)).toBe(0.7);
    expect(peakScore(11)).toBe(0.55);
    expect(peakScore(20)).toBe(0.55);
    expect(peakScore(21)).toBeCloseTo(0.4, 5);
  });
});

describe("derivePeakPotential", () => {
  it("usa #1 → Top 5 → Top 10 → de 10 em 10", () => {
    expect(derivePeakPotential(95)).toBe("1");
    expect(derivePeakPotential(85)).toBe("top5");
    expect(derivePeakPotential(75)).toBe("top10");
    expect(derivePeakPotential(65)).toBe("top20");
    expect(derivePeakPotential(55)).toBe("top30");
    expect(derivePeakPotential(45)).toBe("top40");
    expect(derivePeakPotential(8)).toBe("top100");
    expect(derivePeakPotential(0)).toBe("out");
  });

  it("normaliza legado top3 → top5", () => {
    expect(normalizePeakPotential("top3")).toBe("top5");
    expect(normalizePeakPotential("top30")).toBe("top30");
  });
});

describe("playsScore — teto absoluto de 500 scrobbles", () => {
  it("é linear até 500 e satura no teto", () => {
    expect(playsScore(0)).toBe(0);
    expect(playsScore(250)).toBeCloseTo(0.5, 5);
    expect(playsScore(500)).toBe(1);
    expect(playsScore(5000)).toBe(1); // acima de 500 não ganha mais nada
  });

  it("500 e 5000 plays empatam em importance (resto igual)", () => {
    const a = song({ songId: "a", overallPlaycount: 500 });
    const b = song({ songId: "b", overallPlaycount: 5000 });
    const rows = buildRetroChart([a, b], ctx());
    const rA = rows.find((r) => r.songId === "a")!;
    const rB = rows.find((r) => r.songId === "b")!;
    expect(rA.importance).toBeCloseTo(rB.importance, 5);
    expect(rA.scoreFinal).toBeCloseTo(rB.scoreFinal, 5);
  });
});

describe("importance", () => {
  it("cresce com o playcount total (mantendo o resto igual)", () => {
    const alto = song({ songId: "alto", overallPlaycount: 5000 });
    const baixo = song({ songId: "baixo", overallPlaycount: 50 });
    const rows = buildRetroChart([alto, baixo], ctx());
    const rAlto = rows.find((r) => r.songId === "alto")!;
    const rBaixo = rows.find((r) => r.songId === "baixo")!;
    expect(rAlto.importance).toBeGreaterThan(rBaixo.importance);
  });

  it("não recalcula quando há importance manual (valor travado)", () => {
    const s = song({ overallPlaycount: 999999, top20Weeks: 30, numberOnes: 10, manualImportance: 30, importanceLocked: true });
    const rows = buildRetroChart([s], ctx());
    expect(rows[0].importance).toBe(30);
    expect(rows[0].importanceIsManual).toBe(true);
  });
});

describe("ajuste manual afeta o score", () => {
  it("+50 pontua mais que -50", () => {
    const mais = song({ songId: "mais", manualAdjustment: 50 });
    const menos = song({ songId: "menos", manualAdjustment: -50 });
    const rows = buildRetroChart([mais, menos], ctx());
    const rMais = rows.find((r) => r.songId === "mais")!;
    const rMenos = rows.find((r) => r.songId === "menos")!;
    expect(rMais.scoreFinal).toBeGreaterThan(rMenos.scoreFinal);
  });
});

describe("buildRetroChart — posições", () => {
  it("dá posição só a elegíveis e null aos não lançados", () => {
    const ok = song({ songId: "ok", overallPlaycount: 2000, singleReleaseDate: new Date("2004-01-01") });
    const futuro = song({ songId: "futuro", singleReleaseDate: new Date("2009-01-01") });
    const rows = buildRetroChart([ok, futuro], ctx());
    const rOk = rows.find((r) => r.songId === "ok")!;
    const rFut = rows.find((r) => r.songId === "futuro")!;
    expect(rOk.position).toBe(1);
    expect(rFut.eligible).toBe(false);
    expect(rFut.eligibilityStatus).toBe("not_released");
    expect(rFut.position).toBeNull();
    expect(rFut.scoreFinal).toBe(0);
  });

  it("não passa posição além do chartSize", () => {
    const songs = Array.from({ length: 5 }, (_, i) =>
      song({ songId: `s${i}`, overallPlaycount: 1000 - i * 100 }),
    );
    const rows = buildRetroChart(songs, ctx({ chartSize: 3 }));
    const positioned = rows.filter((r) => r.position != null);
    expect(positioned).toHaveLength(3);
  });
});

describe("monthsBetween", () => {
  it("aproxima meses entre datas", () => {
    expect(monthsBetween(new Date("2005-01-01"), new Date("2005-07-01"))).toBeCloseTo(6, 0);
    expect(monthsBetween(new Date("2005-07-01"), new Date("2005-01-01"))).toBeLessThan(0);
  });
});

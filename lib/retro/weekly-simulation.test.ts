import { describe, it, expect } from "vitest";
import {
  mondayOfIsoWeek1UTC,
  powerAt,
  simulateWeeklyChart,
  weekIndexUTC,
  weekRangeUTC,
  type WeeklyDebut,
} from "./weekly-simulation";

describe("semana ISO em UTC", () => {
  it("bate com o dado real do banco: semana 1 de 2002 começa em 31/12/2001", () => {
    const monday = mondayOfIsoWeek1UTC(2002);
    expect(monday.toISOString().slice(0, 10)).toBe("2001-12-31");
    expect(weekIndexUTC(monday)).toBe(200201);
  });

  it("weekRangeUTC devolve segunda a domingo da semana", () => {
    const { start, end } = weekRangeUTC(new Date("2002-01-02T00:00:00Z")); // quarta da semana 1/2002
    expect(start.toISOString().slice(0, 10)).toBe("2001-12-31");
    expect(end.toISOString().slice(0, 10)).toBe("2002-01-06");
  });
});

describe("powerAt — curva entrada→pico→decaimento", () => {
  it("entra fraca (fração do score) e sobe até o pico antes de decair", () => {
    const score = 90;
    const entry = powerAt(score, 0);
    const peak = powerAt(score, 6); // maxPeakWeek para score alto
    const later = powerAt(score, 20);
    expect(entry).toBeLessThan(peak);
    expect(peak).toBeGreaterThan(later);
    expect(entry).toBeCloseTo(score * 0.35, 5);
  });

  it("música fraca decai mais rápido que uma forte (mesmo nº de semanas pós-pico)", () => {
    const fraca = powerAt(20, 10);
    const forte = powerAt(90, 10);
    // Comparação relativa ao próprio pico, não ao valor absoluto (scores diferentes).
    const fracaRel = fraca / 20;
    const forteRel = forte / 90;
    expect(forteRel).toBeGreaterThan(fracaRel);
  });
});

describe("simulateWeeklyChart", () => {
  function debut(songId: string, weekMonday: string, scoreFinal: number): WeeklyDebut {
    return { songId, debutDate: new Date(`${weekMonday}T00:00:00Z`), scoreFinal };
  }

  it("uma estreia fraca entra como 'new' e desaparece antes do fim do intervalo simulado", () => {
    const snapshots = simulateWeeklyChart({
      debuts: [debut("fraca", "2005-01-03", 15)],
      startYear: 2005,
      endWeekIndexExclusive: 200552, // ~51 semanas simuladas
      chartSize: 10,
    });
    const first = snapshots[0];
    expect(first.entries).toHaveLength(1);
    expect(first.entries[0]).toMatchObject({ songId: "fraca", position: 1, status: "new", weeks: 1 });

    // Como só há 1 música, semanas sem ela charting não geram snapshot —
    // se ela nunca saísse, teríamos ~51 semanas; decaindo, são bem menos.
    expect(snapshots.length).toBeLessThan(20);
  });

  it("borbulha fora do chart e sobe de posição com o momentum antes de cair", () => {
    const week1 = mondayOfIsoWeek1UTC(2005);
    const weeksLater = (n: number) => new Date(week1.getTime() + n * 7 * 24 * 60 * 60 * 1000);

    const snapshots = simulateWeeklyChart({
      debuts: [
        // 10 concorrentes fortes que já estão perto do pico quando "forte" estreia.
        ...Array.from({ length: 10 }, (_, i) => ({ songId: `c${i}`, debutDate: week1, scoreFinal: 92 })),
        // estreia mais tarde: entryFactor faz ela começar FORA do top 10 cheio de concorrentes já fortes.
        { songId: "forte", debutDate: weeksLater(4), scoreFinal: 90 },
      ],
      startYear: 2005,
      endWeekIndexExclusive: 200525,
      chartSize: 10,
    });
    const positions = snapshots.map((s) => s.entries.find((e) => e.songId === "forte")?.position ?? null);
    expect(positions[4]).toBeNull(); // na própria semana de estreia (índice 4), ainda fora do top 10
    const firstAppearance = positions.findIndex((p) => p != null);
    expect(firstAppearance).toBeGreaterThan(4); // só entra depois de subir com o momentum
  });

  it("nunca gera semana com weekIndex >= endWeekIndexExclusive", () => {
    const snapshots = simulateWeeklyChart({
      debuts: [debut("s", "2005-06-01", 80)],
      startYear: 2005,
      endWeekIndexExclusive: 200530,
      chartSize: 10,
    });
    for (const s of snapshots) expect(s.weekIndex).toBeLessThan(200530);
  });

  it("respeita o tamanho do chart (corta quem não entra no top N)", () => {
    const debuts = Array.from({ length: 15 }, (_, i) => debut(`s${i}`, "2005-01-03", 90 - i));
    const snapshots = simulateWeeklyChart({
      debuts,
      startYear: 2005,
      endWeekIndexExclusive: 200502,
      chartSize: 10,
    });
    expect(snapshots[0].entries.length).toBeLessThanOrEqual(10);
  });
});

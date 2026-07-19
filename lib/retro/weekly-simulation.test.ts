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

  it("startMonth começa na semana do dia 1 desse mês (não na semana ISO 1)", () => {
    const snapshots = simulateWeeklyChart({
      debuts: [debut("maio", "2004-05-03", 80)], // segunda da semana do 1º/mai/2004 ≈
      startYear: 2004,
      startMonth: 5,
      endWeekIndexExclusive: 200420,
      chartSize: 10,
    });
    expect(snapshots.length).toBeGreaterThan(0);
    // 1ª semana gerada deve ser em maio/2004 (não janeiro)
    const firstStart = snapshots[0].weekStartDate.toISOString().slice(0, 7);
    expect(firstStart).toBe("2004-05");
  });

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

  it("jitter quebra bloco: scores iguais não ficam todos com o mesmo delta", () => {
    const week1 = mondayOfIsoWeek1UTC(2005);
    // 30 faixas idênticas + 5 hits que estreiam, empurram o bloco e depois saem
    // (sem jitter, o bloco inteiro subiria o mesmo Δ quando os hits saíssem).
    const debuts: WeeklyDebut[] = [
      ...Array.from({ length: 30 }, (_, i) => ({
        songId: `pack-${i}`,
        debutDate: week1,
        scoreFinal: 55,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        songId: `hit-${i}`,
        debutDate: week1,
        scoreFinal: 95,
      })),
    ];
    const snapshots = simulateWeeklyChart({
      debuts,
      startYear: 2005,
      endWeekIndexExclusive: 200520,
      chartSize: 20,
    });

    // Semana em que há ups/downs entre as pack-* (depois da estreia)
    let foundDiverse = false;
    for (const snap of snapshots.slice(1)) {
      const packDeltas = snap.entries
        .filter((e) => e.songId.startsWith("pack-") && e.delta != null)
        .map((e) => e.delta as number);
      if (packDeltas.length < 4) continue;
      const unique = new Set(packDeltas);
      if (unique.size >= 2) {
        foundDiverse = true;
        break;
      }
    }
    expect(foundDiverse).toBe(true);

    // Ordem não é só lexicográfica de songId (jitter reordena)
    const mid = snapshots[3] ?? snapshots[snapshots.length - 1];
    const packOrder = mid.entries.filter((e) => e.songId.startsWith("pack-")).map((e) => e.songId);
    const lex = [...packOrder].sort((a, b) => a.localeCompare(b));
    expect(packOrder).not.toEqual(lex);
  });
});

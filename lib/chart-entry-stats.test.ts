import { describe, expect, it } from "vitest";
import { applyComputedEntryStatsToCharts } from "@/lib/chart-entry-stats";
import { movementComparePeriodIndex } from "@/lib/chart-cadence";

describe("movementComparePeriodIndex", () => {
  it("no diário usa a última parada publicada (segunda → sexta)", () => {
    expect(movementComparePeriodIndex("DAILY", 20260720, 20260717)).toBe(20260717);
  });

  it("no diário sem parada anterior retorna null", () => {
    expect(movementComparePeriodIndex("DAILY", 20260720, null)).toBeNull();
  });

  it("no semanal exige a semana imediatamente anterior", () => {
    expect(movementComparePeriodIndex("WEEKLY", 202630, 202628)).toBe(202629);
  });
});

describe("applyComputedEntryStatsToCharts (diário com gap de fim de semana)", () => {
  it("segunda compara com sexta — não marca tudo como retorno", () => {
    const friday = {
      weekIndex: 20260717,
      entries: [
        { songId: "a", position: 1 },
        { songId: "b", position: 2 },
      ],
    };
    const monday = {
      weekIndex: 20260720,
      entries: [
        { songId: "a", position: 2 },
        { songId: "b", position: 1 },
        { songId: "c", position: 3 },
      ],
    };

    const [friOut, monOut] = applyComputedEntryStatsToCharts([friday, monday]);

    expect(friOut.entries.map((e) => e.status)).toEqual(["new", "new"]);
    expect(monOut.entries.find((e) => e.songId === "a")?.status).toBe("down");
    expect(monOut.entries.find((e) => e.songId === "b")?.status).toBe("up");
    expect(monOut.entries.find((e) => e.songId === "c")?.status).toBe("new");
  });
});

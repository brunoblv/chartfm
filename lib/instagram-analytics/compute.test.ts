import { describe, expect, it } from "vitest";
import {
  buildFollowerSeries,
  chunkRange,
  computeVelocity,
  dayRange,
  insightEndTimeToDay,
  mediaKind,
  parseIgRange,
  ratePct,
  sumBreakdown,
} from "./compute";

describe("parseIgRange", () => {
  it("aceita só os ranges suportados", () => {
    expect(parseIgRange("7")).toBe(7);
    expect(parseIgRange("90")).toBe(90);
    expect(parseIgRange("15")).toBe(30);
    expect(parseIgRange(undefined)).toBe(30);
  });
});

describe("insightEndTimeToDay", () => {
  it("end_time fecha o dia anterior", () => {
    expect(insightEndTimeToDay("2026-09-24T07:00:00+0000")).toBe("2026-09-23");
  });
});

describe("buildFollowerSeries", () => {
  const days = dayRange("2026-09-01", "2026-09-05");

  it("reconstrói o total para trás e corta dias não fechados", () => {
    const net = new Map([
      ["2026-09-01", 2],
      ["2026-09-02", -1],
      ["2026-09-03", 5],
    ]);
    const s = buildFollowerSeries(days, net, 100);
    expect(s.map((p) => p.day)).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
    expect(s.map((p) => p.total)).toEqual([96, 95, 100]);
  });

  it("snapshot tem prioridade sobre a reconstrução", () => {
    const net = new Map([
      ["2026-09-01", 1],
      ["2026-09-02", 1],
    ]);
    const s = buildFollowerSeries(days, net, 100, new Map([["2026-09-01", 50]]));
    expect(s.map((p) => p.total)).toEqual([50, 100]);
  });

  it("sem nenhum dia fechado devolve vazio", () => {
    expect(buildFollowerSeries(days, new Map(), 100)).toEqual([]);
  });
});

describe("computeVelocity", () => {
  it("compara a última semana com a média das anteriores", () => {
    const net = new Map(dayRange("2026-09-01", "2026-09-14").map((d, i) => [d, i < 7 ? 1 : 10] as const));
    const series = buildFollowerSeries(dayRange("2026-09-01", "2026-09-14"), net, 200);
    const v = computeVelocity(series)!;
    // semana atual: +70 sobre 200 no fim; anterior: +7 sobre 130
    expect(v.thisWeekPct).toBeCloseTo((70 / 200) * 100);
    expect(v.priorAvgPct).toBeCloseTo((7 / 130) * 100);
    expect(v.trend).toBe("accelerating");
  });

  it("menos de 7 dias → null", () => {
    const series = buildFollowerSeries(["2026-09-01"], new Map([["2026-09-01", 1]]), 10);
    expect(computeVelocity(series)).toBeNull();
  });
});

describe("helpers", () => {
  it("mediaKind", () => {
    expect(mediaKind("VIDEO", "REELS")).toBe("REEL");
    expect(mediaKind("CAROUSEL_ALBUM", "FEED")).toBe("CAROUSEL");
    expect(mediaKind("IMAGE", "FEED")).toBe("IMAGE");
  });

  it("ratePct protege alcance zero", () => {
    expect(ratePct(10, 0)).toBeNull();
    expect(ratePct(11, 100)).toBeCloseTo(11);
  });

  it("chunkRange respeita o limite de 30 dias", () => {
    const chunks = chunkRange("2026-07-01", "2026-09-28");
    expect(chunks[0]).toEqual({ since: "2026-07-01", until: "2026-07-30" });
    expect(chunks.at(-1)!.until).toBe("2026-09-28");
    expect(chunks).toHaveLength(3);
  });

  it("sumBreakdown soma várias janelas", () => {
    const payload = (f: number, u: number) => ({
      data: [
        {
          total_value: {
            breakdowns: [
              {
                results: [
                  { dimension_values: ["FOLLOWER"], value: f },
                  { dimension_values: ["NON_FOLLOWER"], value: u },
                ],
              },
            ],
          },
        },
      ],
    });
    const m = sumBreakdown([payload(10, 2), payload(5, 1)]);
    expect(m.get("FOLLOWER")).toBe(15);
    expect(m.get("NON_FOLLOWER")).toBe(3);
  });
});

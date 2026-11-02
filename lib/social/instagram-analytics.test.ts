import { describe, expect, it } from "vitest";
import {
  audienceInsights,
  averageOnlineByHour,
  milestonePlan,
  compareAudiences,
  reachByDaypart,
  reachHeatmap,
  captionFormat,
  daypart,
  followerVelocity,
  hookStrength,
  performanceBySlot,
  postTotals,
  rankBy,
  reconstructFollowerTotals,
  reelInsights,
  reelTotals,
  type IgMediaRow,
} from "./instagram-analytics";

function row(partial: Partial<IgMediaRow>): IgMediaRow {
  return {
    id: Math.random().toString(36).slice(2),
    kind: "REEL",
    caption: "",
    permalink: null,
    thumbnailUrl: null,
    timestamp: "2026-09-01T15:00:00Z",
    reach: 100,
    views: 100,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    interactions: 10,
    follows: null,
    profileVisits: null,
    avgWatchTimeMs: null,
    totalWatchTimeMs: null,
    skipRate: null,
    ...partial,
  };
}

describe("reconstructFollowerTotals", () => {
  it("volta do total atual subtraindo os saldos posteriores", () => {
    const totals = reconstructFollowerTotals(823, [
      { date: "2026-09-03", value: 200 },
      { date: "2026-09-01", value: 10 },
      { date: "2026-09-02", value: -5 },
    ]);
    expect(totals).toEqual([
      { date: "2026-09-01", value: 628 },
      { date: "2026-09-02", value: 623 },
      { date: "2026-09-03", value: 823 },
    ]);
  });
});

describe("followerVelocity", () => {
  it("compara a última semana com a média semanal anterior", () => {
    const daily = Array.from({ length: 14 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, "0")}`, value: i < 7 ? 1 : 10 }));
    const v = followerVelocity(1000, daily);
    expect(v.thisWeekNet).toBe(70);
    expect(v.thisWeekPct).toBeCloseTo(7);
    expect(v.priorWeeksAvgPct).toBeCloseTo(0.7);
    expect(v.trend).toBe("accelerating");
  });

  it("sem histórico suficiente não inventa tendência", () => {
    const v = followerVelocity(1000, [{ date: "2026-09-01", value: 5 }]);
    expect(v.priorWeeksAvgPct).toBeNull();
    expect(v.trend).toBe("unknown");
  });
});

describe("postTotals / reelTotals", () => {
  it("conversão ignora posts sem a métrica follows (reels)", () => {
    const totals = postTotals([row({ kind: "IMAGE", reach: 1000, follows: 2 }), row({ kind: "REEL", reach: 99999, follows: null })]);
    expect(totals.totalFollows).toBe(2);
    expect(totals.followerConversion).toBeCloseTo(0.002);
    expect(totals.profileVisitRate).toBeNull();
  });

  it("converte ms em horas e calcula rewatch", () => {
    const t = reelTotals([
      row({ views: 300, reach: 200, totalWatchTimeMs: 3_600_000, avgWatchTimeMs: 5000, skipRate: 20 }),
      row({ views: 100, reach: 200, totalWatchTimeMs: 1_800_000, avgWatchTimeMs: 3000, skipRate: 40 }),
    ]);
    expect(t.totalWatchHours).toBeCloseTo(1.5);
    expect(t.topReelWatchHours).toBeCloseTo(1);
    expect(t.rewatchRatio).toBeCloseTo(1);
    expect(t.bestAvgWatchTimeMs).toBe(5000);
    expect(t.avgSkipRate).toBe(30);
  });
});

describe("rankBy", () => {
  it("descarta métricas nulas e ordena", () => {
    const a = row({ skipRate: 40 });
    const b = row({ skipRate: 10 });
    const c = row({ skipRate: null });
    expect(rankBy([a, b, c], (r) => r.skipRate, 5, "asc").map((x) => x.row)).toEqual([b, a]);
  });
});

describe("heurísticas", () => {
  it("classifica formato da legenda", () => {
    expect(captionFormat("Top 10 músicas da semana\n#chartfm")).toBe("list");
    expect(captionFormat("5 songs you missed")).toBe("list");
    expect(captionFormat("Qual é a sua favorita?")).toBe("question");
    expect(captionFormat("Como montar sua parada")).toBe("tutorial");
    expect(captionFormat("Parada global chegou")).toBe("other");
  });

  it("força do gancho por skip rate", () => {
    expect(hookStrength(null)).toBeNull();
    expect(hookStrength(19)).toBe("strong");
    expect(hookStrength(40)).toBe("moderate");
    expect(hookStrength(60)).toBe("weak");
  });

  it("período do dia no fuso de São Paulo", () => {
    expect(daypart("2026-09-01T12:00:00Z")).toBe("morning"); // 9h BRT
    expect(daypart("2026-09-01T23:00:00Z")).toBe("evening"); // 20h BRT
    expect(daypart("2026-09-01T06:00:00Z")).toBe("night"); // 3h BRT
  });

  it("só aponta padrão com 2+ reels e diferença relevante", () => {
    const rows = [
      row({ caption: "Top 5 hits", views: 1000 }),
      row({ caption: "Top 3 álbuns", views: 900 }),
      row({ caption: "bastidores", views: 100 }),
      row({ caption: "novidade", views: 120 }),
    ];
    const insights = reelInsights(rows);
    const list = insights.find((i) => i.dimension === "format" && i.key === "list");
    expect(list?.kind).toBe("win");
    expect(list?.count).toBe(2);
    // "other" é o resto não classificado, nunca vira insight
    expect(insights.find((i) => i.dimension === "format" && i.key === "other")).toBeUndefined();
  });
});

describe("timing", () => {
  it("agrupa por dia da semana no fuso local", () => {
    const slots = performanceBySlot([row({ timestamp: "2026-09-07T02:00:00Z", reach: 50 }), row({ timestamp: "2026-09-06T15:00:00Z", reach: 150 })], "weekday");
    // 07/09 02:00Z = 06/09 23:00 BRT (domingo)
    expect(slots).toEqual([{ key: 0, count: 2, avgReach: 100, avgEngagementRate: expect.closeTo(0.1333, 3) }]);
  });

  it("média de online por hora", () => {
    const avg = averageOnlineByHour([{ "0": 10, "1": 20 }, { "0": 30 }]);
    expect(avg[0]).toBe(20);
    expect(avg[1]).toBe(20);
    expect(avg[2]).toBe(0);
  });
});

describe("público", () => {
  it("compara participações entre seguidores, alcançados e engajados", () => {
    const rows = compareAudiences(
      [{ key: "18-24", value: 30 }, { key: "25-34", value: 70 }],
      [{ key: "18-24", value: 50 }, { key: "25-34", value: 50 }],
      null,
    );
    expect(rows).toEqual([
      { key: "25-34", followers: 0.7, reached: 0.5, engaged: null },
      { key: "18-24", followers: 0.3, reached: 0.5, engaged: null },
    ]);
  });

  it("gera insights só com diferenças relevantes", () => {
    const age = compareAudiences(
      [{ key: "18-24", value: 28 }, { key: "25-34", value: 37 }, { key: "45-54", value: 4 }, { key: "35-44", value: 31 }],
      [{ key: "18-24", value: 33 }, { key: "25-34", value: 34 }, { key: "45-54", value: 9 }, { key: "35-44", value: 24 }],
      [{ key: "18-24", value: 25 }, { key: "25-34", value: 42 }, { key: "45-54", value: 7 }, { key: "35-44", value: 26 }],
    );
    const city = compareAudiences(
      [{ key: "São Paulo", value: 90 }, { key: "Recife", value: 78 }, { key: "Rio", value: 832 }],
      [{ key: "São Paulo", value: 80 }, { key: "Recife", value: 70 }, { key: "Rio", value: 850 }],
      [{ key: "São Paulo", value: 104 }, { key: "Recife", value: 88 }, { key: "Rio", value: 808 }],
    );
    const kinds = audienceInsights({ age, gender: [], city }).map((i) => [i.kind, i.key]);
    expect(kinds).toContainEqual(["ageMostEngaged", "25-34"]);
    expect(kinds).toContainEqual(["ageReachNoEngage", "18-24"]);
    expect(kinds).toContainEqual(["ageNewReach", "45-54"]);
    expect(kinds).toContainEqual(["cityStronghold", "Rio"]);
    expect(kinds).toContainEqual(["cityAboveWeight", "São Paulo"]);
  });
});

describe("mapa de alcance", () => {
  it("posiciona posts por dia e hora local e tira a média", () => {
    // 2026-09-02 (quarta) 15:00 BRT
    const grid = reachHeatmap([row({ timestamp: "2026-09-02T18:00:00Z", reach: 100 }), row({ timestamp: "2026-09-02T18:30:00Z", reach: 300 })]);
    expect(grid[3][15]).toBe(200);
    expect(grid[3][14]).toBeNull();
  });

  it("alcance por período do dia inclui períodos vazios", () => {
    const parts = reachByDaypart([row({ timestamp: "2026-09-02T12:00:00Z", reach: 80 })]);
    expect(parts.find((p) => p.key === "morning")).toEqual({ key: "morning", count: 1, avgReach: 80 });
    expect(parts.find((p) => p.key === "night")?.count).toBe(0);
  });
});

describe("metas de seguidores", () => {
  const days = (values: number[], start = "2026-10-01") =>
    values.map((value, i) => ({ date: new Date(Date.parse(`${start}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10), value }));

  it("primeira meta é 10 mil com marcos de mil em mil", () => {
    const plan = milestonePlan(2_500, [], "2026-11-01");
    expect(plan.goal).toBe(10_000);
    expect(plan.milestones.map((m) => m.target)).toEqual([1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000]);
    expect(plan.milestones.filter((m) => m.reached).map((m) => m.target)).toEqual([1000, 2000]);
    expect(plan.milestones.at(-1)?.isGoal).toBe(true);
  });

  it("ao passar de 10 mil a meta vira 20 mil, e assim por diante", () => {
    expect(milestonePlan(10_000, [], "2026-11-01").goal).toBe(20_000);
    expect(milestonePlan(10_000, [], "2026-11-01").milestones[0].target).toBe(11_000);
    expect(milestonePlan(25_300, [], "2026-11-01").goal).toBe(30_000);
  });

  it("projeta datas pelo ritmo de 7 e 30 dias", () => {
    const history = days([...new Array(23).fill(10), ...new Array(7).fill(50)]);
    const plan = milestonePlan(2_900, history, "2026-11-01");
    expect(plan.rates.week.perDay).toBe(50);
    expect(plan.rates.month.perDay).toBeCloseTo(19.33, 1);
    const m3k = plan.milestones.find((m) => m.target === 3_000)!;
    expect(m3k.projections.week).toEqual({ days: 2, date: "2026-11-03" });
    expect(m3k.projections.month?.days).toBe(6);
  });

  it("sem crescimento não inventa projeção", () => {
    const plan = milestonePlan(2_900, days([0, -3, 1, -2]), "2026-11-01");
    expect(plan.milestones.find((m) => m.target === 3_000)?.projections.week).toBeNull();
  });

  it("data em que o marco foi atingido vem do histórico", () => {
    // totais reconstruídos: 1990, 2010, 2030
    const plan = milestonePlan(2_030, days([5, 20, 20]), "2026-11-01");
    expect(plan.milestones.find((m) => m.target === 2_000)?.reachedOn).toBe("2026-10-02");
    // 1000 já estava batido antes do início do histórico
    expect(plan.milestones.find((m) => m.target === 1_000)?.reachedOn).toBeNull();
  });
});

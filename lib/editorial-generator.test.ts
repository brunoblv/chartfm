import { describe, expect, it } from "vitest";
import { buildWeeklyEditorial } from "@/lib/editorial-generator";
import type { GlobalChartEntry } from "@/lib/types";

function entry(partial: Partial<GlobalChartEntry> & Pick<GlobalChartEntry, "position" | "status">): GlobalChartEntry {
  return {
    song: {
      title: partial.song?.title ?? `Song ${partial.position}`,
      artist: partial.song?.artist ?? "Artist",
      album: "",
    },
    cover: { palette: ["#000", "#fff"], seed: 0 },
    delta: null,
    prevPos: null,
    peak: partial.position,
    weeks: 1,
    points: 0,
    voters: 0,
    numberOnes: 0,
    ...partial,
  };
}

describe("buildWeeklyEditorial", () => {
  const chart: GlobalChartEntry[] = [
    entry({
      position: 1,
      status: "same",
      numberOnes: 2,
      points: 29498,
      voters: 40,
      song: { title: "hate that i made you love me", artist: "Ariana Grande", album: "" },
    }),
    entry({
      position: 53,
      status: "up",
      delta: 43,
      song: { title: "Need Your Love", artist: "OneRepublic", album: "" },
    }),
    entry({
      position: 93,
      status: "down",
      delta: -41,
      prevPos: 52,
      song: { title: "Good For The Soul", artist: "Someone", album: "" },
    }),
    entry({ position: 10, status: "new" }),
    entry({ position: 11, status: "return" }),
  ];

  it("gera o resumo em português por padrão", () => {
    const body = buildWeeklyEditorial(chart, "Semana 29, 2026", 65);
    expect(body).toContain("segue no topo pela 2ª semana");
    expect(body).toContain("29.498 pontos");
    expect(body).toContain("maior subida");
    expect(body).toContain("65 usuários publicaram paradas");
    expect(body).not.toContain("holds the top");
  });

  it("gera o resumo em inglês quando locale=en", () => {
    const body = buildWeeklyEditorial(chart, "Week 29, 2026", 65, "en");
    expect(body).toContain("holds the top for a 2nd week");
    expect(body).toContain("29,498 points");
    expect(body).toContain("biggest climber");
    expect(body).toContain("65 users published charts");
    expect(body).not.toContain("segue no topo");
    expect(body).not.toContain("paradas");
  });
});

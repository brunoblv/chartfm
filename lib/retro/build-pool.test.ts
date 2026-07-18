import { describe, it, expect } from "vitest";
import { debutRefFor, type SongRow } from "./build-pool";

function song(over: Partial<SongRow> = {}): SongRow {
  return {
    id: "s",
    title: "Song",
    artist: "Artist",
    album: null,
    coverUrl: null,
    singleReleaseDate: null,
    youtubeReleaseDate: null,
    albumReleaseDate: null,
    billboardHot100DebutDate: null,
    billboardGenreChartDebutDate: null,
    ...over,
  };
}

describe("debutRefFor — cadeia padrão", () => {
  it("hot100: prioriza single, depois álbum, depois clipe, depois Top20", () => {
    const s = song({ singleReleaseDate: new Date("2004-01-01"), albumReleaseDate: new Date("2003-01-01") });
    expect(debutRefFor("hot100", s, null, null)).toEqual({ date: new Date("2004-01-01"), source: "single" });
  });

  it("clipes: prioriza clipe sobre single", () => {
    const s = song({ singleReleaseDate: new Date("2004-01-01"), youtubeReleaseDate: new Date("2004-02-01") });
    expect(debutRefFor("clipes", s, null, null)).toEqual({ date: new Date("2004-02-01"), source: "clipe" });
  });

  it("cai para a 1ª entrada na Top20 quando não há nenhuma data cadastrada", () => {
    const s = song();
    const firstEntry = new Date("2005-03-01");
    expect(debutRefFor("hot100", s, firstEntry, null)).toEqual({ date: firstEntry, source: "top20" });
  });

  it("sem nenhuma data disponível, não há estreia", () => {
    expect(debutRefFor("hot100", song(), null, null)).toEqual({ date: null, source: null });
  });
});

describe("debutRefFor — override da Billboard Hot 100", () => {
  it("vence quando é anterior TANTO ao single QUANTO à 1ª entrada na Top20", () => {
    const s = song({ singleReleaseDate: new Date("2004-06-01") });
    const firstEntry = new Date("2004-05-01");
    const billboard = new Date("2004-01-15"); // antes das duas
    expect(debutRefFor("hot100", s, firstEntry, billboard)).toEqual({ date: billboard, source: "billboard" });
  });

  it("NÃO vence se for depois do single, mesmo sendo antes da Top20", () => {
    const s = song({ singleReleaseDate: new Date("2004-01-01") });
    const firstEntry = new Date("2004-05-01");
    const billboard = new Date("2004-02-01"); // depois do single
    expect(debutRefFor("hot100", s, firstEntry, billboard)).toEqual({ date: s.singleReleaseDate, source: "single" });
  });

  it("NÃO vence se for depois da 1ª entrada na Top20, mesmo sendo antes do single", () => {
    const s = song({ singleReleaseDate: new Date("2004-06-01") });
    const firstEntry = new Date("2004-01-01");
    const billboard = new Date("2004-03-01"); // depois da Top20
    expect(debutRefFor("hot100", s, firstEntry, billboard)).toEqual({ date: s.singleReleaseDate, source: "single" });
  });

  it("vence quando não há single cadastrado, só precisa ser antes da Top20", () => {
    const firstEntry = new Date("2004-05-01");
    const billboard = new Date("2004-01-01");
    expect(debutRefFor("hot100", song(), firstEntry, billboard)).toEqual({ date: billboard, source: "billboard" });
  });

  it("ignorada no target clipes (é especificamente da Billboard Hot 100 de singles)", () => {
    const s = song({ singleReleaseDate: new Date("2004-06-01") });
    const billboard = new Date("2004-01-01");
    expect(debutRefFor("clipes", s, null, billboard).source).not.toBe("billboard");
  });
});

describe("debutRefFor — fallback automático (Hot 100 / charts secundários importados)", () => {
  it("usa billboardHot100DebutDate da música quando não há override manual", () => {
    const s = song({
      singleReleaseDate: new Date("2004-06-01"),
      billboardHot100DebutDate: new Date("2004-01-15"),
    });
    const firstEntry = new Date("2004-05-01");
    expect(debutRefFor("hot100", s, firstEntry, null)).toEqual({ date: s.billboardHot100DebutDate, source: "billboard" });
  });

  it("usa billboardGenreChartDebutDate quando é a mais antiga entre as duas automáticas", () => {
    const s = song({
      singleReleaseDate: new Date("2004-06-01"),
      billboardHot100DebutDate: new Date("2004-02-01"),
      billboardGenreChartDebutDate: new Date("1994-05-01"),
    });
    const firstEntry = new Date("2004-05-01");
    expect(debutRefFor("hot100", s, firstEntry, null)).toEqual({
      date: s.billboardGenreChartDebutDate,
      source: "billboard",
    });
  });

  it("override manual vence sobre as datas automáticas", () => {
    const s = song({
      singleReleaseDate: new Date("2004-06-01"),
      billboardHot100DebutDate: new Date("2004-02-01"),
      billboardGenreChartDebutDate: new Date("1994-05-01"),
    });
    const firstEntry = new Date("2004-05-01");
    const manual = new Date("2004-03-01");
    expect(debutRefFor("hot100", s, firstEntry, manual)).toEqual({ date: manual, source: "billboard" });
  });

  it("automática também não vence se for depois do single ou da Top20", () => {
    const s = song({
      singleReleaseDate: new Date("2004-01-01"),
      billboardGenreChartDebutDate: new Date("2004-02-01"), // depois do single
    });
    const firstEntry = new Date("2004-05-01");
    expect(debutRefFor("hot100", s, firstEntry, null)).toEqual({ date: s.singleReleaseDate, source: "single" });
  });
});

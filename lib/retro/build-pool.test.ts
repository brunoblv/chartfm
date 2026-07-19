import { describe, it, expect } from "vitest";
import { aggregateTop20Lifetime, debutRefFor, type SongRow } from "./build-pool";

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

describe("aggregateTop20Lifetime", () => {
  it("conta semanas/pico/#1 all-time (não corta no mês da estreia)", () => {
    const points = [
      { position: 20, weekStartDate: new Date("2005-06-06") },
      { position: 5, weekStartDate: new Date("2005-06-12") },
      { position: 2, weekStartDate: new Date("2006-01-24") },
      { position: 1, weekStartDate: new Date("2006-01-30") },
      { position: 45, weekStartDate: new Date("2006-02-01") }, // fora do top20
    ];
    expect(aggregateTop20Lifetime(points)).toEqual({
      weeks: 4,
      bestPeak: 1,
      numberOnes: 1,
      firstEntryDate: new Date("2005-06-06"),
    });
  });

  it("ignora pontos sem data", () => {
    expect(
      aggregateTop20Lifetime([
        { position: 3, weekStartDate: null },
        { position: 8, weekStartDate: new Date("2005-01-01") },
      ]),
    ).toEqual({
      weeks: 1,
      bestPeak: 8,
      numberOnes: 0,
      firstEntryDate: new Date("2005-01-01"),
    });
  });
});

describe("debutRefFor — cadeia padrão", () => {
  it("hot100 sem Billboard: prioriza single, depois álbum, depois clipe, depois Top20", () => {
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

describe("debutRefFor — Billboard-first (hot100)", () => {
  it("Billboard depois do single vence no automático (corrige single cedo demais)", () => {
    const s = song({ singleReleaseDate: new Date("2004-01-01") });
    const billboard = new Date("2004-03-01");
    expect(debutRefFor("hot100", s, null, billboard)).toEqual({ date: billboard, source: "billboard" });
  });

  it("Billboard vence mesmo com Top20 posterior", () => {
    const s = song({ singleReleaseDate: new Date("2004-01-01") });
    const firstEntry = new Date("2004-05-01");
    const billboard = new Date("2004-03-01");
    expect(debutRefFor("hot100", s, firstEntry, billboard)).toEqual({ date: billboard, source: "billboard" });
  });

  it("usa billboardHot100DebutDate da Song quando não há override manual", () => {
    const s = song({
      singleReleaseDate: new Date("2004-01-01"),
      billboardHot100DebutDate: new Date("2004-03-15"),
    });
    expect(debutRefFor("hot100", s, null, null)).toEqual({
      date: s.billboardHot100DebutDate,
      source: "billboard",
    });
  });

  it("prefere Hot 100 importada ao chart de gênero (mesmo que o gênero seja mais antigo)", () => {
    const s = song({
      singleReleaseDate: new Date("2004-06-01"),
      billboardHot100DebutDate: new Date("2004-02-01"),
      billboardGenreChartDebutDate: new Date("1994-05-01"),
    });
    expect(debutRefFor("hot100", s, null, null)).toEqual({
      date: s.billboardHot100DebutDate,
      source: "billboard",
    });
  });

  it("usa genre chart só quando não há Hot 100", () => {
    const s = song({
      singleReleaseDate: new Date("2004-06-01"),
      billboardGenreChartDebutDate: new Date("2004-02-01"),
    });
    expect(debutRefFor("hot100", s, null, null)).toEqual({
      date: s.billboardGenreChartDebutDate,
      source: "billboard",
    });
  });

  it("override manual vence sobre as datas automáticas da Song", () => {
    const s = song({
      singleReleaseDate: new Date("2004-06-01"),
      billboardHot100DebutDate: new Date("2004-02-01"),
    });
    const manual = new Date("2004-04-01");
    expect(debutRefFor("hot100", s, null, manual)).toEqual({ date: manual, source: "billboard" });
  });

  it("ignorada no target clipes", () => {
    const s = song({ singleReleaseDate: new Date("2004-06-01") });
    const billboard = new Date("2004-01-01");
    expect(debutRefFor("clipes", s, null, billboard).source).not.toBe("billboard");
  });
});

describe("debutRefFor — Top20 se for a mais antiga", () => {
  it("Top20 mais antiga que single/álbum/clipe/Billboard vence", () => {
    const s = song({
      singleReleaseDate: new Date("2004-01-01"),
      albumReleaseDate: new Date("2003-12-01"),
      youtubeReleaseDate: new Date("2004-02-01"),
      billboardHot100DebutDate: new Date("2004-03-01"),
    });
    const firstEntry = new Date("2003-11-01");
    expect(debutRefFor("hot100", s, firstEntry, null)).toEqual({ date: firstEntry, source: "top20" });
  });

  it("empate com single não dá vitória à Top20 (cai na Billboard)", () => {
    const s = song({
      singleReleaseDate: new Date("2004-01-01"),
      billboardHot100DebutDate: new Date("2004-03-01"),
    });
    const firstEntry = new Date("2004-01-01");
    expect(debutRefFor("hot100", s, firstEntry, null)).toEqual({
      date: s.billboardHot100DebutDate,
      source: "billboard",
    });
  });

  it("em clipes, Top20 vence se for a mais antiga", () => {
    const s = song({
      youtubeReleaseDate: new Date("2004-02-01"),
      singleReleaseDate: new Date("2004-01-15"),
    });
    const firstEntry = new Date("2004-01-01");
    expect(debutRefFor("clipes", s, firstEntry, null)).toEqual({ date: firstEntry, source: "top20" });
  });
});

describe("debutRefFor — fonte travada (preferred)", () => {
  it("preferred single vence Billboard", () => {
    const s = song({ singleReleaseDate: new Date("2004-01-01") });
    const billboard = new Date("2004-03-01");
    expect(debutRefFor("hot100", s, null, billboard, "single")).toEqual({
      date: s.singleReleaseDate,
      source: "single",
    });
  });

  it("preferred billboard usa data da Song sem override de perfil", () => {
    const s = song({
      singleReleaseDate: new Date("2004-01-01"),
      billboardHot100DebutDate: new Date("2004-03-01"),
    });
    expect(debutRefFor("hot100", s, null, null, "billboard")).toEqual({
      date: s.billboardHot100DebutDate,
      source: "billboard",
    });
  });

  it("preferred sem data cai no automático", () => {
    const s = song({ singleReleaseDate: new Date("2004-01-01") });
    expect(debutRefFor("hot100", s, null, null, "billboard")).toEqual({
      date: s.singleReleaseDate,
      source: "single",
    });
  });
});

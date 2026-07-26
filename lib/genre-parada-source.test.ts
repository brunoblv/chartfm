import { describe, expect, it } from "vitest";
import { songHasSingleClipOrBillboardDebut } from "./genre-parada-source";

const empty = {
  singleReleaseDate: null,
  musicVideoReleaseDate: null,
  youtubeReleaseDate: null,
  billboardHot100DebutDate: null,
  billboardGenreChartDebutDate: null,
};

describe("songHasSingleClipOrBillboardDebut", () => {
  it("rejeita sem nenhuma data qualificadora", () => {
    expect(songHasSingleClipOrBillboardDebut(empty)).toBe(false);
  });

  it("aceita data de single", () => {
    expect(songHasSingleClipOrBillboardDebut({ ...empty, singleReleaseDate: new Date("2024-01-01") })).toBe(true);
  });

  it("aceita data de clipe (MV ou YouTube)", () => {
    expect(songHasSingleClipOrBillboardDebut({ ...empty, musicVideoReleaseDate: new Date("2024-02-01") })).toBe(true);
    expect(songHasSingleClipOrBillboardDebut({ ...empty, youtubeReleaseDate: new Date("2024-03-01") })).toBe(true);
  });

  it("aceita debut Billboard (Hot 100 ou gênero)", () => {
    expect(songHasSingleClipOrBillboardDebut({ ...empty, billboardHot100DebutDate: new Date("2024-04-01") })).toBe(true);
    expect(songHasSingleClipOrBillboardDebut({ ...empty, billboardGenreChartDebutDate: new Date("2024-05-01") })).toBe(
      true,
    );
  });
});

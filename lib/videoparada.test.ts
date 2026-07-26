import { describe, expect, it } from "vitest";
import {
  isValidVideoparadaChartKind,
  parseCommunitySlug,
  parseGenreSlug,
} from "@/lib/videoparada";
import { defaultDiskMtvYouTubeMeta } from "@/lib/videoparada/youtube-upload";

describe("videoparada chartKind", () => {
  it("aceita community:disk-mtv", () => {
    expect(isValidVideoparadaChartKind("community:disk-mtv")).toBe(true);
    expect(parseCommunitySlug("community:disk-mtv")).toBe("disk-mtv");
  });

  it("rejeita community desconhecida", () => {
    expect(isValidVideoparadaChartKind("community:outra")).toBe(false);
  });

  it("mantém global / genre", () => {
    expect(isValidVideoparadaChartKind("global")).toBe(true);
    expect(parseGenreSlug("genre:brasil")).toBe("brasil");
  });
});

describe("defaultDiskMtvYouTubeMeta", () => {
  it("formata título Disk MTV Top 20 - Semana x, 2026", () => {
    const meta = defaultDiskMtvYouTubeMeta({
      weekLabel: "Semana 28 - 2026",
      limit: 20,
    });
    expect(meta.title).toBe("Disk MTV Top 20 - Semana 28, 2026");
  });
});

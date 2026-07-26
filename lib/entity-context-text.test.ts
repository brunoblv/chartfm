import { describe, expect, it } from "vitest";
import { buildSongContext } from "@/lib/entity-context-text";

describe("buildSongContext", () => {
  const input = {
    title: "hate that i made you love me",
    artist: "Ariana Grande",
    album: "eternal sunshine",
    chartEntries: 40,
    uniqueUsers: 35,
    totalPoints: 29498,
    peak: 1,
    weeksTop100: 2,
    firstAppearanceRange: "Semana 28, 2026",
  };

  it("gera o contexto em português por padrão", () => {
    const body = buildSongContext(input);
    expect(body).toContain("é uma música de Ariana Grande");
    expect(body).toContain("do álbum eternal sunshine");
    expect(body).toContain("entrou em 40 paradas");
    expect(body).toContain("melhor posição no Global 100 foi #1");
    expect(body).toContain("29.498 pontos");
    expect(body).not.toContain("is a song by");
  });

  it("gera o contexto em inglês quando locale=en", () => {
    const body = buildSongContext(
      { ...input, firstAppearanceRange: "Week 28, 2026" },
      "en",
    );
    expect(body).toContain("is a song by Ariana Grande");
    expect(body).toContain("from the album eternal sunshine");
    expect(body).toContain("appeared on 40 charts");
    expect(body).toContain("best position on the Global 100 was #1");
    expect(body).toContain("29,498 points");
    expect(body).not.toContain("é uma música");
    expect(body).not.toContain("paradas");
  });
});

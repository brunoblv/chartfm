import { describe, expect, it } from "vitest";
import {
  isValidVideoparadaChartKind,
  normalizeClipConfigInput,
  normalizePlatform,
  parseGenreSlug,
} from "@/lib/videoparada";
import { VIDEOPARADA_SHORTS_SECONDS, VIDEOPARADA_YOUTUBE_SECONDS } from "@/lib/videoparada-shared";

describe("videoparada", () => {
  it("valida chartKind", () => {
    expect(isValidVideoparadaChartKind("global")).toBe(true);
    expect(isValidVideoparadaChartKind("airplay")).toBe(true);
    expect(isValidVideoparadaChartKind("genre:brasil")).toBe(true);
    expect(isValidVideoparadaChartKind("genre:nope")).toBe(false);
    expect(isValidVideoparadaChartKind("")).toBe(false);
  });

  it("parseia slug de gênero", () => {
    expect(parseGenreSlug("genre:brasil")).toBe("brasil");
    expect(parseGenreSlug("global")).toBeNull();
  });

  it("normaliza plataforma", () => {
    expect(normalizePlatform("YouTube")).toBe("youtube");
    expect(normalizePlatform("")).toBeNull();
    expect(normalizePlatform("tiktok")).toBeNull();
  });

  it("normaliza input de config e infere plataforma pela URL", () => {
    const ok = normalizeClipConfigInput({
      songId: "abc",
      position: 3,
      videoUrl: "https://www.youtube.com/watch?v=xyz",
      useAutoChorus: false,
      startSeconds: 10,
      endSeconds: 10 + VIDEOPARADA_SHORTS_SECONDS,
    });
    expect(ok).toMatchObject({
      songId: "abc",
      position: 3,
      platform: "youtube",
      useAutoChorus: false,
      startSeconds: 10,
      endSeconds: 16,
    });
  });

  it("rejeita fim <= início", () => {
    expect(
      normalizeClipConfigInput({
        songId: "abc",
        position: 1,
        startSeconds: 5,
        endSeconds: 5,
      }),
    ).toBe("Segundo final deve ser maior que o inicial");
  });

  it("expõe durações padrão do doc", () => {
    expect(VIDEOPARADA_SHORTS_SECONDS).toBe(6);
    expect(VIDEOPARADA_YOUTUBE_SECONDS).toBe(11);
  });
});

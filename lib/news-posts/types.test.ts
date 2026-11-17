import { describe, expect, it } from "vitest";
import {
  formatNewsDate,
  newsSlideCount,
  newsVisualFingerprint,
  normalizeNewsInput,
  validateNewsPost,
  type NewsPostInput,
} from "./types";

function base(over: Partial<NewsPostInput> = {}): NewsPostInput {
  return {
    format: "SINGLE",
    theme: "light",
    eyebrow: "Global 100",
    title: "Maré Alta chega ao topo",
    summary: "",
    newsDate: "2026-11-08",
    content: { slides: [], closing: { eyebrow: "", title: "Leia no site", text: "", cta: "chartfm.com.br" } },
    caption: "",
    ...over,
  };
}

describe("validateNewsPost", () => {
  it("aceita post único dentro dos limites", () => {
    expect(validateNewsPost(base())).toEqual([]);
  });

  it("conta caracteres por code point (emoji não conta dobrado)", () => {
    const title = "🎵".repeat(70);
    expect(validateNewsPost(base({ title }))).toEqual([]);
    expect(validateNewsPost(base({ title: title + "a" }))).toEqual([{ field: "title", code: "tooLong", max: 70 }]);
  });

  it("exige título", () => {
    expect(validateNewsPost(base({ title: "  " }))).toEqual([{ field: "title", code: "required" }]);
  });

  it("aplica limites diferentes por formato", () => {
    const title = "x".repeat(65);
    expect(validateNewsPost(base({ title }))).toEqual([]);
    expect(validateNewsPost(base({ format: "CAROUSEL", title }))[0]).toMatchObject({ field: "title", max: 60 });
  });

  it("valida slides do carrossel com caminho estável", () => {
    const issues = validateNewsPost(
      base({
        format: "CAROUSEL",
        content: {
          slides: [
            { kind: "content", eyebrow: "", title: "ok", body: "y".repeat(261) },
            { kind: "highlight", eyebrow: "", label: "", value: "", caption: "", stats: [{ label: "a", value: "" }] },
          ],
          closing: { eyebrow: "", title: "", text: "", cta: "chartfm.com.br" },
        },
      }),
    );
    expect(issues.map((i) => i.field)).toEqual(["slides.0.body", "slides.1.value", "slides.1.stats.0.value", "closing.title"]);
  });
});

describe("normalizeNewsInput", () => {
  it("rejeita formato desconhecido", () => {
    expect(normalizeNewsInput({ format: "REEL" })).toBeNull();
  });

  it("limita slides e estatísticas e usa fechamento padrão", () => {
    const slides = Array.from({ length: 12 }, () => ({ kind: "highlight", value: "1", stats: [{}, {}, {}] }));
    const out = normalizeNewsInput({ format: "CAROUSEL", title: "t", content: { slides } })!;
    expect(out.content.slides).toHaveLength(8);
    expect(out.content.slides[0].kind === "highlight" && out.content.slides[0].stats).toHaveLength(2);
    expect(out.content.closing.cta).toBe("chartfm.com.br");
    expect(newsSlideCount(out.format, out.content)).toBe(10);
  });

  it("descarta data inválida", () => {
    const out = normalizeNewsInput({ format: "VIDEO", title: "t", newsDate: "08/11/2026" })!;
    expect(out.newsDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("formatNewsDate", () => {
  it("formata em pt e en sem depender do fuso", () => {
    expect(formatNewsDate("2026-11-08")).toBe("08 nov 2026");
    expect(formatNewsDate("2026-11-08", "en")).toBe("Nov 08, 2026");
  });
});

describe("newsVisualFingerprint", () => {
  it("ignora a legenda (não invalida as artes)", () => {
    const { caption: _c, ...a } = base({ caption: "x" });
    const { caption: _d, ...b } = base({ caption: "y" });
    expect(newsVisualFingerprint(a)).toBe(newsVisualFingerprint(b));
    expect(newsVisualFingerprint({ ...a, title: "outro" })).not.toBe(newsVisualFingerprint(a));
  });
});

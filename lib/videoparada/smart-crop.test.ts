import { describe, expect, it } from "vitest";
import { centerCropRect } from "@/lib/videoparada/smart-crop";

describe("centerCropRect", () => {
  it("corta laterais em landscape para 9:16", () => {
    const r = centerCropRect(1280, 720, 9 / 16);
    expect(r.height).toBe(720);
    expect(r.width).toBe(Math.round(720 * (9 / 16)));
    expect(r.y).toBe(0);
    expect(r.x).toBe(Math.round((1280 - r.width) / 2));
  });

  it("corta topo/base quando fonte é mais estreita que 16:9", () => {
    // 1440×1080 = 4:3 (< 16:9) → reduz altura
    const r = centerCropRect(1440, 1080, 16 / 9);
    expect(r.width).toBe(1440);
    expect(r.height).toBe(Math.round(1440 / (16 / 9)));
  });

  it("já 9:16 → crop full frame", () => {
    const r = centerCropRect(1080, 1920, 9 / 16);
    expect(r.width).toBe(1080);
    expect(r.height).toBe(1920);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import {
  brtCalendarParts,
  dateTimeBrtToUtc,
  genreParadaPublishSlot,
  nextGenreParadaPublishAt,
  GENRE_PARADA_MIN_GAP_MS,
} from "./genre-parada-schedule";

describe("genreParadaPublishSlot", () => {
  it("cai em seg–sex entre 08:00 e 22:45 BRT", () => {
    const weekRef = new Date("2026-07-22T15:00:00.000Z"); // qua
    for (const id of ["a", "b", "c", "parada-1", "parada-22", "x".repeat(20)]) {
      const slot = genreParadaPublishSlot(id, weekRef);
      const p = brtCalendarParts(slot);
      expect(p.dow).toBeGreaterThanOrEqual(1);
      expect(p.dow).toBeLessThanOrEqual(5);
      const shifted = new Date(slot.getTime() - 3 * 60 * 60 * 1000);
      const hour = shifted.getUTCHours();
      const minute = shifted.getUTCMinutes();
      expect(hour).toBeGreaterThanOrEqual(8);
      expect(hour).toBeLessThanOrEqual(22);
      expect([0, 15, 30, 45]).toContain(minute);
    }
  });

  it("é estável para o mesmo id + semana", () => {
    const weekRef = new Date("2026-07-20T12:00:00.000Z");
    expect(genreParadaPublishSlot("abc", weekRef).toISOString()).toBe(
      genreParadaPublishSlot("abc", weekRef).toISOString(),
    );
  });

  it("espalha ids diferentes", () => {
    const weekRef = new Date("2026-07-20T12:00:00.000Z");
    const ids = Array.from({ length: 22 }, (_, i) => `cm${i.toString(36)}x${(i * 7919).toString(16)}genre`);
    const slots = new Set(ids.map((id) => genreParadaPublishSlot(id, weekRef).toISOString()));
    expect(slots.size).toBeGreaterThanOrEqual(20);
  });
});

describe("nextGenreParadaPublishAt", () => {
  it("respeita o intervalo mínimo", () => {
    const latest = dateTimeBrtToUtc(2026, 6, 20, 8, 0); // seg 20/07
    const next = nextGenreParadaPublishAt("some-parada-id", latest);
    expect(next.getTime() - latest.getTime()).toBeGreaterThanOrEqual(GENRE_PARADA_MIN_GAP_MS);
  });
});

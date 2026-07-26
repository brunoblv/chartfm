import { describe, expect, it } from "vitest";
import {
  getWeeklyPollActionInstant,
  hasWeeklyPollActionPassed,
} from "@/lib/weekly-poll-schedule";

describe("weekly-poll-schedule", () => {
  // Segunda 00:00 BRT = segunda 03:00 UTC
  const mondayMidnightBrt = { weekday: 1, time: "00:00" };
  // Quarta 07:00 BRT = quarta 10:00 UTC
  const wednesday7amBrt = { weekday: 3, time: "07:00" };

  it("não considera abertura passada no domingo à noite", () => {
    // Domingo 24/mai/2026 23:00 BRT = 25/mai 02:00 UTC
    const sundayNight = new Date("2026-05-25T02:00:00.000Z");
    expect(hasWeeklyPollActionPassed(sundayNight, mondayMidnightBrt)).toBe(false);
  });

  it("considera abertura passada na segunda 0h05", () => {
    // Segunda 25/mai/2026 00:05 BRT = 25/mai 03:05 UTC
    const mondayEarly = new Date("2026-05-25T03:05:00.000Z");
    expect(hasWeeklyPollActionPassed(mondayEarly, mondayMidnightBrt)).toBe(true);
  });

  it("não fecha antes da quarta 7h", () => {
    // Quarta 27/mai/2026 06:59 BRT = 27/mai 09:59 UTC
    const beforeClose = new Date("2026-05-27T09:59:00.000Z");
    expect(hasWeeklyPollActionPassed(beforeClose, wednesday7amBrt)).toBe(false);
  });

  it("fecha na quarta 7h", () => {
    const atClose = new Date("2026-05-27T10:00:00.000Z");
    expect(hasWeeklyPollActionPassed(atClose, wednesday7amBrt)).toBe(true);
  });

  it("getWeeklyPollActionInstant ancora na segunda após o domingo-alvo", () => {
    const wednesdayNoonBrt = new Date("2026-05-27T15:00:00.000Z"); // qua 12:00 BRT
    const openAt = getWeeklyPollActionInstant(wednesdayNoonBrt, mondayMidnightBrt);
    expect(openAt.toISOString()).toBe("2026-05-25T03:00:00.000Z");
    const closeAt = getWeeklyPollActionInstant(wednesdayNoonBrt, wednesday7amBrt);
    expect(closeAt.toISOString()).toBe("2026-05-27T10:00:00.000Z");
  });
});

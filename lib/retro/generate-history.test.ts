import { describe, expect, it } from "vitest";
import { endWeekIndexAfterMonth, weekIndexUTC, weekRangeUTC } from "@/lib/retro/weekly-simulation";

describe("endWeekIndexAfterMonth", () => {
  it("inclui a semana que contém o último dia do mês e exclui a seguinte", () => {
    // 31 mai 2005 = terça → semana começa 30 mai; próxima segunda = 6 jun
    const monthEnd = new Date(Date.UTC(2005, 5, 0));
    const { start: mondayOfLast } = weekRangeUTC(monthEnd);
    const exclusive = endWeekIndexAfterMonth(2005, 5);
    expect(weekIndexUTC(monthEnd)).toBe(weekIndexUTC(mondayOfLast));
    expect(exclusive).toBeGreaterThan(weekIndexUTC(monthEnd));

    const nextMonday = new Date(mondayOfLast);
    nextMonday.setUTCDate(mondayOfLast.getUTCDate() + 7);
    expect(exclusive).toBe(weekIndexUTC(nextMonday));
  });
});

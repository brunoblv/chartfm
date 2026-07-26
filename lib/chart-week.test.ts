import { describe, expect, it } from "vitest";
import { formatDateRangeForLocale, formatChartPeriod } from "@/lib/chart-week";

describe("formatDateRangeForLocale", () => {
  it("troca o conector a → to em inglês", () => {
    expect(formatDateRangeForLocale("22/06/2026 a 28/06/2026", "en")).toBe("22/06/2026 to 28/06/2026");
  });

  it("mantém a em português", () => {
    expect(formatDateRangeForLocale("22/06/2026 a 28/06/2026", "pt-BR")).toBe("22/06/2026 a 28/06/2026");
  });
});

describe("formatChartPeriod", () => {
  it("localiza intervalo e rótulo da semana", () => {
    expect(
      formatChartPeriod({ weekLabel: "Semana 26 - 2026", dateRange: "22/06/2026 a 28/06/2026" }, "en"),
    ).toBe("22/06/2026 to 28/06/2026 - Week 26, 2026");
  });
});

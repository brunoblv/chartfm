import { prevChartWeekIndex, buildWeekIndexFromDate, isoWeeksInYear } from "../lib/chart-week";

for (const y of [2008, 2009, 2010, 2019, 2020, 2021, 2025, 2026]) {
  console.log(y, "isoWeeksInYear:", isoWeeksInYear(y));
}

console.log("\nprevChartWeekIndex tests:");
for (const wi of [202101, 202053, 202052, 202001, 201001, 200901]) {
  console.log(wi, "->", prevChartWeekIndex(wi));
}

console.log("\nJan 4 2021 weekIndex:", buildWeekIndexFromDate(new Date(2021, 0, 4)));
console.log("Dec 28 2020 weekIndex:", buildWeekIndexFromDate(new Date(2020, 11, 28)));
console.log("202101 prev should be 202053:", prevChartWeekIndex(202101) === 202053);

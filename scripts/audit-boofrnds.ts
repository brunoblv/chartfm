/**
 * Audit script: finds missing weeks and missing chart positions for @boofrnds
 * historical charts in public/boofrnds/*.txt
 *
 * Usage:
 *   npx tsx scripts/audit-boofrnds.ts
 *   npx tsx scripts/audit-boofrnds.ts --year=2018
 *   npx tsx scripts/audit-boofrnds.ts --json
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const HANDLE = "boofrnds";
const TXT_DIR = join(process.cwd(), "public", "boofrnds");
const CHART_SIZE = 50;

const YEAR_FILTER = (() => {
  const arg = process.argv.find((a) => a.startsWith("--year="));
  if (!arg) return null;
  const y = parseInt(arg.split("=")[1], 10);
  return Number.isNaN(y) ? null : y;
})();

const JSON_OUTPUT = process.argv.includes("--json");

type ParsedWeek = {
  startDate: Date;
  endDate: Date;
  positions: number[];
  sourceFile: string;
  fileYear: number;
};

function parseDDMMYYYY(s: string): Date {
  const [dd, mm, yyyy] = s.trim().split("/").map(Number);
  return new Date(yyyy, mm - 1, dd);
}

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function fileYearFromName(name: string): number | null {
  const m = name.match(/TBHP(\d{4})\.txt$/i);
  return m ? parseInt(m[1], 10) : null;
}

function parseFile(filePath: string, sourceFile: string, fileYear: number): ParsedWeek[] {
  const weeks: ParsedWeek[] = [];
  let current: ParsedWeek | null = null;
  let inFallOffs = false;

  for (const raw of readFileSync(filePath, "utf-8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const dateM = line.match(/^\[\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})\s*\]/);
    if (dateM) {
      if (current && current.positions.length > 0) weeks.push(current);
      current = {
        startDate: parseDDMMYYYY(dateM[1]),
        endDate: parseDDMMYYYY(dateM[2]),
        positions: [],
        sourceFile,
        fileYear,
      };
      inFallOffs = false;
      continue;
    }

    if (
      line.startsWith("@ FALL OFFS") ||
      line.includes("@ FALL OFFS @") ||
      line.includes("(( FALL OFFS ))")
    ) {
      inFallOffs = true;
      continue;
    }

    if (inFallOffs || !current) continue;

    const m = line.match(/^#(\d+)\)\s+(.+),\s+"([^"]+)"\s*\[([^\]]+)\]/);
    if (!m) continue;

    current.positions.push(parseInt(m[1], 10));
  }

  if (current && current.positions.length > 0) weeks.push(current);
  return weeks;
}

function loadAllWeeks(): ParsedWeek[] {
  const files = readdirSync(TXT_DIR)
    .filter((f) => f.endsWith(".txt"))
    .sort();

  const weeks: ParsedWeek[] = [];
  for (const file of files) {
    const fileYear = fileYearFromName(file);
    if (fileYear === null) continue;
    weeks.push(...parseFile(join(TXT_DIR, file), file, fileYear));
  }

  weeks.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  return weeks;
}

type MissingWeek = {
  fileYear: number;
  startDate: string;
  endDate: string;
};

type MissingPositions = {
  fileYear: number;
  startDate: string;
  endDate: string;
  sourceFile: string;
  missingPositions: number[];
  entryCount: number;
};

function auditMissingWeeks(weeks: ParsedWeek[]): MissingWeek[] {
  const byFileYear = new Map<number, ParsedWeek[]>();

  for (const w of weeks) {
    if (!byFileYear.has(w.fileYear)) byFileYear.set(w.fileYear, []);
    byFileYear.get(w.fileYear)!.push(w);
  }

  const missing: MissingWeek[] = [];

  for (const [fileYear, fileWeeks] of [...byFileYear.entries()].sort((a, b) => a[0] - b[0])) {
    if (YEAR_FILTER !== null && fileYear !== YEAR_FILTER) continue;

    const sorted = [...fileWeeks].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];

      if (sameDay(curr.startDate, next.startDate)) continue;

      let expectedStart = addDays(curr.startDate, 7);

      while (expectedStart.getTime() < next.startDate.getTime()) {
        missing.push({
          fileYear,
          startDate: fmtDate(expectedStart),
          endDate: fmtDate(addDays(expectedStart, 6)),
        });
        expectedStart = addDays(expectedStart, 7);
      }
    }
  }

  return missing;
}

function auditMissingPositions(weeks: ParsedWeek[]): MissingPositions[] {
  const issues: MissingPositions[] = [];

  for (const w of weeks) {
    if (YEAR_FILTER !== null && w.fileYear !== YEAR_FILTER) continue;

    const present = new Set(w.positions);
    const missingPositions: number[] = [];

    for (let p = 1; p <= CHART_SIZE; p++) {
      if (!present.has(p)) missingPositions.push(p);
    }

    if (missingPositions.length > 0) {
      issues.push({
        fileYear: w.fileYear,
        startDate: fmtDate(w.startDate),
        endDate: fmtDate(w.endDate),
        sourceFile: w.sourceFile,
        missingPositions,
        entryCount: w.positions.length,
      });
    }
  }

  return issues;
}

function printReport(missingWeeks: MissingWeek[], missingPositions: MissingPositions[]) {
  console.log(`\n=== Auditoria @${HANDLE} ===\n`);

  console.log(`Semanas ausentes (${missingWeeks.length}):`);
  if (missingWeeks.length === 0) {
    console.log("  Nenhuma — sequência semanal contínua em todos os arquivos.");
  } else {
    let currentYear: number | null = null;
    for (const m of missingWeeks) {
      if (m.fileYear !== currentYear) {
        currentYear = m.fileYear;
        console.log(`\n  TBHP${currentYear}:`);
      }
      console.log(`    ${m.startDate} – ${m.endDate}`);
    }
  }

  console.log(`\nParadas com posições ausentes (${missingPositions.length}):`);
  if (missingPositions.length === 0) {
    console.log(`  Nenhuma — todas as paradas têm #01–#${String(CHART_SIZE).padStart(2, "0")}.`);
  } else {
    for (const m of missingPositions) {
      const posLabel = m.missingPositions.map((p) => `#${String(p).padStart(2, "0")}`).join(", ");
      console.log(`  ${m.startDate} – ${m.endDate}  (${m.sourceFile}, ${m.entryCount} entradas)`);
      console.log(`    Ausentes: ${posLabel}`);
    }
  }

  console.log("");
}

function main() {
  const weeks = loadAllWeeks();
  const missingWeeks = auditMissingWeeks(weeks);
  const missingPositions = auditMissingPositions(weeks);

  if (JSON_OUTPUT) {
    console.log(
      JSON.stringify(
        {
          handle: HANDLE,
          totalWeeks: weeks.length,
          chartSize: CHART_SIZE,
          yearFilter: YEAR_FILTER,
          missingWeeks,
          missingPositions,
        },
        null,
        2,
      ),
    );
    return;
  }

  printReport(missingWeeks, missingPositions);

  if (missingWeeks.length > 0 || missingPositions.length > 0) {
    process.exitCode = 1;
  }
}

main();

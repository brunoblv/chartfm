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

type ChartEntry = {
  position: number;
  artist: string;
  title: string;
  rawLine: string;
};

type ParsedWeek = {
  startDate: Date;
  endDate: Date;
  entries: ChartEntry[];
  sourceFile: string;
  fileYear: number;
};

type UnparsedLine = {
  sourceFile: string;
  weekStart: string | null;
  line: string;
  extracted: { position: number; artist: string; title: string } | null;
};

function parseDDMMYYYY(s: string): Date {
  const [dd, mm, yyyy] = s.trim().split("/").map(Number);
  return new Date(yyyy, mm - 1, dd);
}

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function fmtSong(e: ChartEntry): string {
  return `${e.artist}, "${e.title}"`;
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

function parseEntryLine(line: string): ChartEntry | null {
  // Formato padrão: #NN) Artist, "Title" [stats]
  const m = line.match(/^#(\d+)\)\s*(.+?),\s*"([^"]+)"\s*\[([^\]]+)\]/);
  if (m) {
    return {
      position: parseInt(m[1], 10),
      artist: m[2].trim(),
      title: m[3].trim(),
      rawLine: line,
    };
  }

  // Variante com vírgula colada: #NN) Artist,"Title" [stats]
  const m2 = line.match(/^#(\d+)\)\s*(.+?),\s*"([^"]+)"\s*\[/);
  if (m2) {
    return {
      position: parseInt(m2[1], 10),
      artist: m2[2].trim(),
      title: m2[3].trim(),
      rawLine: line,
    };
  }

  // Variante sem espaço após ): #NN)Artist, "Title" [stats]
  const m3 = line.match(/^#(\d+)\)(.+?),\s*"([^"]+)"\s*\[/);
  if (m3) {
    return {
      position: parseInt(m3[1], 10),
      artist: m3[2].trim(),
      title: m3[3].trim(),
      rawLine: line,
    };
  }

  return null;
}

function extractUnparsedEntry(line: string): { position: number; artist: string; title: string } | null {
  const m = line.match(/^#(\d+)\)\s*(.+?),\s*"([^"]*"?)\s*/);
  if (!m) return null;
  return {
    position: parseInt(m[1], 10),
    artist: m[2].trim(),
    title: m[3].trim().replace(/"$/, ""),
  };
}

function parseFile(
  filePath: string,
  sourceFile: string,
  fileYear: number,
  unparsed: UnparsedLine[],
): ParsedWeek[] {
  const weeks: ParsedWeek[] = [];
  let current: ParsedWeek | null = null;
  let inFallOffs = false;

  for (const raw of readFileSync(filePath, "utf-8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const dateM = line.match(/^\[\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})\s*\]/);
    if (dateM) {
      if (current && current.entries.length > 0) weeks.push(current);
      current = {
        startDate: parseDDMMYYYY(dateM[1]),
        endDate: parseDDMMYYYY(dateM[2]),
        entries: [],
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

    if (line.startsWith("#")) {
      const entry = parseEntryLine(line);
      if (entry) {
        current.entries.push(entry);
      } else {
        unparsed.push({
          sourceFile,
          weekStart: fmtDate(current.startDate),
          line,
          extracted: extractUnparsedEntry(line),
        });
      }
    }
  }

  if (current && current.entries.length > 0) weeks.push(current);
  return weeks;
}

function loadAllWeeks(): { weeks: ParsedWeek[]; unparsed: UnparsedLine[] } {
  const files = readdirSync(TXT_DIR)
    .filter((f) => f.endsWith(".txt"))
    .sort();

  const weeks: ParsedWeek[] = [];
  const unparsed: UnparsedLine[] = [];

  for (const file of files) {
    const fileYear = fileYearFromName(file);
    if (fileYear === null) continue;
    weeks.push(...parseFile(join(TXT_DIR, file), file, fileYear, unparsed));
  }

  weeks.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  return { weeks, unparsed };
}

function entryByPosition(week: ParsedWeek, pos: number): ChartEntry | undefined {
  return week.entries.find((e) => e.position === pos);
}

type MissingWeek = {
  fileYear: number;
  startDate: string;
  endDate: string;
  previousWeek: {
    startDate: string;
    endDate: string;
    topSongs: string[];
  } | null;
  nextWeek: {
    startDate: string;
    endDate: string;
    topSongs: string[];
  } | null;
};

type PositionGap = {
  position: number;
  previousSong: string | null;
  neighborBefore: string | null;
  neighborAfter: string | null;
  foundInFile: string | null;
  rawLine: string | null;
};

type DuplicatePosition = {
  position: number;
  songs: string[];
};

type OutOfRangeEntry = {
  position: number;
  song: string;
};

type MissingPositions = {
  fileYear: number;
  startDate: string;
  endDate: string;
  sourceFile: string;
  entryCount: number;
  gaps: PositionGap[];
  duplicates: DuplicatePosition[];
  outOfRange: OutOfRangeEntry[];
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
          previousWeek: {
            startDate: fmtDate(curr.startDate),
            endDate: fmtDate(curr.endDate),
            topSongs: curr.entries.slice(0, 5).map((e) => `#${String(e.position).padStart(2, "0")} ${fmtSong(e)}`),
          },
          nextWeek: {
            startDate: fmtDate(next.startDate),
            endDate: fmtDate(next.endDate),
            topSongs: next.entries.slice(0, 5).map((e) => `#${String(e.position).padStart(2, "0")} ${fmtSong(e)}`),
          },
        });
        expectedStart = addDays(expectedStart, 7);
      }
    }
  }

  return missing;
}

function findPreviousWeek(weeks: ParsedWeek[], current: ParsedWeek): ParsedWeek | null {
  let prev: ParsedWeek | null = null;
  for (const w of weeks) {
    if (w.startDate.getTime() >= current.startDate.getTime()) break;
    prev = w;
  }
  return prev;
}

function auditMissingPositions(weeks: ParsedWeek[], unparsed: UnparsedLine[]): MissingPositions[] {
  const unparsedByWeek = new Map<string, UnparsedLine[]>();
  for (const u of unparsed) {
    if (!u.weekStart) continue;
    const key = `${u.sourceFile}|${u.weekStart}`;
    if (!unparsedByWeek.has(key)) unparsedByWeek.set(key, []);
    unparsedByWeek.get(key)!.push(u);
  }

  const issues: MissingPositions[] = [];

  for (const w of weeks) {
    if (YEAR_FILTER !== null && w.fileYear !== YEAR_FILTER) continue;

    const present = new Set(w.entries.map((e) => e.position));
    const gaps: PositionGap[] = [];
    const prevWeek = findPreviousWeek(weeks, w);
    const weekKey = `${w.sourceFile}|${fmtDate(w.startDate)}`;
    const weekUnparsed = unparsedByWeek.get(weekKey) ?? [];

    for (let p = 1; p <= CHART_SIZE; p++) {
      if (present.has(p)) continue;

      const prevEntry = prevWeek ? entryByPosition(prevWeek, p) : undefined;
      const before = entryByPosition(w, p - 1);
      const after = entryByPosition(w, p + 1);

      const match = weekUnparsed.find((u) => u.extracted?.position === p);

      gaps.push({
        position: p,
        previousSong: prevEntry ? fmtSong(prevEntry) : null,
        neighborBefore: before ? `#${String(before.position).padStart(2, "0")} ${fmtSong(before)}` : null,
        neighborAfter: after ? `#${String(after.position).padStart(2, "0")} ${fmtSong(after)}` : null,
        foundInFile: match?.extracted
          ? `${match.extracted.artist}, "${match.extracted.title}"`
          : null,
        rawLine: match?.line ?? null,
      });
    }

    const byPos = new Map<number, ChartEntry[]>();
    for (const e of w.entries) {
      if (!byPos.has(e.position)) byPos.set(e.position, []);
      byPos.get(e.position)!.push(e);
    }

    const duplicates: DuplicatePosition[] = [];
    for (const [pos, entries] of [...byPos.entries()].sort((a, b) => a[0] - b[0])) {
      if (entries.length > 1) {
        duplicates.push({
          position: pos,
          songs: entries.map(fmtSong),
        });
      }
    }

    const outOfRange: OutOfRangeEntry[] = w.entries
      .filter((e) => e.position > CHART_SIZE)
      .sort((a, b) => a.position - b.position)
      .map((e) => ({ position: e.position, song: fmtSong(e) }));

    if (gaps.length > 0 || duplicates.length > 0 || outOfRange.length > 0) {
      issues.push({
        fileYear: w.fileYear,
        startDate: fmtDate(w.startDate),
        endDate: fmtDate(w.endDate),
        sourceFile: w.sourceFile,
        entryCount: w.entries.length,
        gaps,
        duplicates,
        outOfRange,
      });
    }
  }

  return issues;
}

function printReport(
  missingWeeks: MissingWeek[],
  missingPositions: MissingPositions[],
  unparsed: UnparsedLine[],
) {
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
      if (m.previousWeek) {
        console.log(`      Semana anterior (${m.previousWeek.startDate} – ${m.previousWeek.endDate}):`);
        for (const s of m.previousWeek.topSongs) console.log(`        ${s}`);
      }
      if (m.nextWeek) {
        console.log(`      Próxima semana (${m.nextWeek.startDate} – ${m.nextWeek.endDate}):`);
        for (const s of m.nextWeek.topSongs) console.log(`        ${s}`);
      }
    }
  }

  console.log(`\nParadas com posições ausentes (${missingPositions.length}):`);
  if (missingPositions.length === 0) {
    console.log(`  Nenhuma — todas as paradas têm #01–#${String(CHART_SIZE).padStart(2, "0")}.`);
  } else {
    for (const m of missingPositions) {
      console.log(`\n  ${m.startDate} – ${m.endDate}  (${m.sourceFile}, ${m.entryCount} entradas)`);

      for (const g of m.gaps) {
        const pos = `#${String(g.position).padStart(2, "0")}`;
        console.log(`    ${pos} ausente:`);
        if (g.foundInFile) {
          console.log(`      Música no arquivo (linha mal formatada): ${g.foundInFile}`);
          if (g.rawLine) console.log(`      Linha: ${g.rawLine}`);
        } else if (g.previousSong) {
          console.log(`      Semana anterior nesta posição: ${g.previousSong}`);
        }
        if (g.neighborBefore) console.log(`      Acima: ${g.neighborBefore}`);
        if (g.neighborAfter) console.log(`      Abaixo: ${g.neighborAfter}`);
      }

      for (const d of m.duplicates) {
        console.log(`    #${String(d.position).padStart(2, "0")} duplicada (${d.songs.length} músicas):`);
        for (const s of d.songs) console.log(`      · ${s}`);
      }

      for (const o of m.outOfRange) {
        console.log(`    #${String(o.position).padStart(2, "0")} fora do top ${CHART_SIZE}: ${o.song}`);
      }
    }
  }

  if (unparsed.length > 0) {
    console.log(`\nLinhas não reconhecidas (${unparsed.length}):`);
    for (const u of unparsed) {
      const week = u.weekStart ? ` [${u.weekStart}]` : "";
      console.log(`  ${u.sourceFile}${week}: ${u.line}`);
    }
  }

  console.log("");
}

function main() {
  const { weeks, unparsed } = loadAllWeeks();
  const missingWeeks = auditMissingWeeks(weeks);
  const missingPositions = auditMissingPositions(weeks, unparsed);

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
          unparsedLines: unparsed,
        },
        null,
        2,
      ),
    );
    return;
  }

  printReport(missingWeeks, missingPositions, unparsed);

  if (missingWeeks.length > 0 || missingPositions.length > 0 || unparsed.length > 0) {
    process.exitCode = 1;
  }
}

main();

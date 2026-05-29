/**
 * Audit script: lists missing songs in @boofrnds chart weeks from public/boofrnds/*.txt
 *
 * Each week is treated as top 50 or top 100 depending on its entries (position > 50 → top 100).
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
  weekStart: string;
  line: string;
  extracted: { position: number; artist: string; title: string } | null;
};

type MissingSong = {
  position: number;
  song: string | null;
  reason: "malformed" | "previous_week" | "unknown";
  rawLine: string | null;
};

type WeekReport = {
  fileYear: number;
  startDate: string;
  endDate: string;
  sourceFile: string;
  chartSize: number;
  entryCount: number;
  missing: MissingSong[];
};

function parseDDMMYYYY(s: string): Date {
  const [dd, mm, yyyy] = s.trim().split("/").map(Number);
  return new Date(yyyy, mm - 1, dd);
}

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function fmtSong(artist: string, title: string): string {
  return `${artist}, "${title}"`;
}

function fileYearFromName(name: string): number | null {
  const m = name.match(/TBHP(\d{4})\.txt$/i);
  return m ? parseInt(m[1], 10) : null;
}

function parseEntryLine(line: string): ChartEntry | null {
  const m = line.match(/^#(\d+)\)\s*(.+?),\s*"([^"]+)"\s*\[([^\]]+)\]/);
  if (m) {
    return { position: parseInt(m[1], 10), artist: m[2].trim(), title: m[3].trim(), rawLine: line };
  }

  const m2 = line.match(/^#(\d+)\)\s*(.+?),\s*"([^"]+)"\s*\[/);
  if (m2) {
    return { position: parseInt(m2[1], 10), artist: m2[2].trim(), title: m2[3].trim(), rawLine: line };
  }

  const m3 = line.match(/^#(\d+)\)(.+?),\s*"([^"]+)"\s*\[/);
  if (m3) {
    return { position: parseInt(m3[1], 10), artist: m3[2].trim(), title: m3[3].trim(), rawLine: line };
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

    const dateM = line.match(/^\[\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
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
  const weeks: ParsedWeek[] = [];
  const unparsed: UnparsedLine[] = [];

  for (const file of readdirSync(TXT_DIR).filter((f) => f.endsWith(".txt")).sort()) {
    const fileYear = fileYearFromName(file);
    if (fileYear === null) continue;
    weeks.push(...parseFile(join(TXT_DIR, file), file, fileYear, unparsed));
  }

  weeks.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  return { weeks, unparsed };
}

function chartSizeForWeek(week: ParsedWeek): number {
  const maxPos = week.entries.reduce((max, e) => Math.max(max, e.position), 0);
  return maxPos > 50 ? 100 : 50;
}

function entryByPosition(week: ParsedWeek, pos: number): ChartEntry | undefined {
  return week.entries.find((e) => e.position === pos);
}

function findPreviousWeek(weeks: ParsedWeek[], current: ParsedWeek): ParsedWeek | null {
  let prev: ParsedWeek | null = null;
  for (const w of weeks) {
    if (w.startDate.getTime() >= current.startDate.getTime()) break;
    prev = w;
  }
  return prev;
}

function auditMissingSongs(weeks: ParsedWeek[], unparsed: UnparsedLine[]): WeekReport[] {
  const unparsedByWeek = new Map<string, UnparsedLine[]>();
  for (const u of unparsed) {
    const key = `${u.sourceFile}|${u.weekStart}`;
    if (!unparsedByWeek.has(key)) unparsedByWeek.set(key, []);
    unparsedByWeek.get(key)!.push(u);
  }

  const reports: WeekReport[] = [];

  for (const w of weeks) {
    if (YEAR_FILTER !== null && w.fileYear !== YEAR_FILTER) continue;

    const chartSize = chartSizeForWeek(w);
    const present = new Set(w.entries.map((e) => e.position));
    const weekKey = `${w.sourceFile}|${fmtDate(w.startDate)}`;
    const weekUnparsed = unparsedByWeek.get(weekKey) ?? [];
    const prevWeek = findPreviousWeek(weeks, w);
    const missing: MissingSong[] = [];

    for (let p = 1; p <= chartSize; p++) {
      if (present.has(p)) continue;

      const malformed = weekUnparsed.find((u) => u.extracted?.position === p);
      if (malformed?.extracted) {
        missing.push({
          position: p,
          song: fmtSong(malformed.extracted.artist, malformed.extracted.title),
          reason: "malformed",
          rawLine: malformed.line,
        });
        continue;
      }

      const prevEntry = prevWeek ? entryByPosition(prevWeek, p) : undefined;
      if (prevEntry) {
        missing.push({
          position: p,
          song: fmtSong(prevEntry.artist, prevEntry.title),
          reason: "previous_week",
          rawLine: null,
        });
        continue;
      }

      missing.push({ position: p, song: null, reason: "unknown", rawLine: null });
    }

    if (missing.length > 0) {
      reports.push({
        fileYear: w.fileYear,
        startDate: fmtDate(w.startDate),
        endDate: fmtDate(w.endDate),
        sourceFile: w.sourceFile,
        chartSize,
        entryCount: w.entries.length,
        missing,
      });
    }
  }

  return reports;
}

function printReport(reports: WeekReport[]) {
  console.log(`\n=== Músicas faltando @${HANDLE} ===\n`);

  if (reports.length === 0) {
    console.log("Nenhuma música faltando — todas as paradas estão completas.");
    console.log("");
    return;
  }

  console.log(`Paradas incompletas: ${reports.length}\n`);

  for (const r of reports) {
    console.log(`${r.startDate} – ${r.endDate}  (${r.sourceFile}, top ${r.chartSize}, ${r.entryCount} entradas)`);

    for (const m of r.missing) {
      const pos = `#${String(m.position).padStart(2, "0")}`;
      if (m.reason === "malformed" && m.song) {
        console.log(`  ${pos}  ${m.song}  (linha mal formatada)`);
        if (m.rawLine) console.log(`        ${m.rawLine}`);
      } else if (m.reason === "previous_week" && m.song) {
        console.log(`  ${pos}  ${m.song}  (estava nesta posição na semana anterior)`);
      } else {
        console.log(`  ${pos}  posição vazia`);
      }
    }

    console.log("");
  }
}

function main() {
  const { weeks, unparsed } = loadAllWeeks();
  const reports = auditMissingSongs(weeks, unparsed);

  if (JSON_OUTPUT) {
    console.log(
      JSON.stringify(
        {
          handle: HANDLE,
          totalWeeks: weeks.length,
          yearFilter: YEAR_FILTER,
          incompleteWeeks: reports,
        },
        null,
        2,
      ),
    );
    return;
  }

  printReport(reports);

  if (reports.length > 0) {
    process.exitCode = 1;
  }
}

main();

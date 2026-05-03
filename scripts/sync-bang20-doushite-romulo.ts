/**
 * BANG20 oficial (abas 2008, 2009): paradas de romulolima22 — posições da Doushite
 * alinhadas com a Song canónica «Doushite kimi wo suki ni natte shimattandarou?» / «TVXQ!».
 *
 * Uso:
 *   npx tsx scripts/sync-bang20-doushite-romulo.ts --year 2008 --dry-run
 *   npx tsx scripts/sync-bang20-doushite-romulo.ts --year 2009 --apply
 *   (se omitir --year, usa 2008)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HANDLE = "romulolima22";

const SHEET_TITLE = "Doushite kimi wo suki ni natte shimattandarou?";
const SHEET_ARTIST = "TVXQ!";

/** Aba 2008 — lidas do BANG20oficial.xlsx (`scripts/_bang20_scan_doushite_year.py 2008`). */
const EXPECTED_2008: readonly [weekIndex: number, position: number][] = [
  [200829, 1],
  [200830, 1],
  [200831, 1],
  [200832, 2],
  [200833, 1],
  [200834, 1],
  [200835, 1],
  [200836, 1],
  [200837, 1],
  [200838, 2],
  [200839, 2],
  [200840, 2],
  [200841, 2],
  [200842, 3],
  [200843, 2],
  [200844, 10],
  [200845, 3],
  [200846, 3],
  [200847, 3],
  [200848, 5],
  [200849, 7],
  [200850, 10],
  [200851, 10],
  [200852, 10],
];

/** Aba 2009 */
const EXPECTED_2009: readonly [weekIndex: number, position: number][] = [
  [200901, 15],
  [200902, 16],
  [200903, 17],
  [200904, 18],
  [200905, 20],
  [200906, 18],
];

const BY_CALENDAR_YEAR: Record<number, readonly [number, number][]> = {
  2008: EXPECTED_2008,
  2009: EXPECTED_2009,
};

function parseCalendarYear(): number {
  const i = process.argv.indexOf("--year");
  if (i >= 0 && process.argv[i + 1]) {
    const y = parseInt(process.argv[i + 1], 10);
    if (!Number.isNaN(y) && BY_CALENDAR_YEAR[y]) return y;
    if (!Number.isNaN(y)) {
      console.error(`Ano não suportado: ${y}. Use: ${Object.keys(BY_CALENDAR_YEAR).join(", ")}`);
      process.exit(1);
    }
  }
  return 2008;
}

async function main() {
  const year = parseCalendarYear();
  const expected = BY_CALENDAR_YEAR[year];

  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");
  if ((!dryRun && !apply) || (dryRun && apply)) {
    console.error("Use exatamente um de: --dry-run | --apply");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { handle: HANDLE },
    select: { id: true },
  });
  if (!user) {
    console.error(`User não encontrado: ${HANDLE}`);
    process.exit(1);
  }

  const canonical = await prisma.song.findUnique({
    where: { title_artist: { title: SHEET_TITLE, artist: SHEET_ARTIST } },
    select: { id: true, title: true, artist: true, spotifyId: true },
  });
  if (!canonical) {
    console.error(`Song canónica em falta: "${SHEET_TITLE}" — ${SHEET_ARTIST}`);
    process.exit(1);
  }

  type Row = {
    weekIndex: number;
    position: number;
    chartId: string;
    entryId: string;
    prevSongId: string;
    prevTitle: string;
    prevArtist: string;
    action: "ok" | "fix" | "missing_chart" | "missing_slot";
  };
  const rows: Row[] = [];

  for (const [weekIndex, position] of expected) {
    const chart = await prisma.chart.findFirst({
      where: { userId: user.id, weekIndex },
      select: { id: true },
    });
    if (!chart) {
      rows.push({
        weekIndex,
        position,
        chartId: "",
        entryId: "",
        prevSongId: "",
        prevTitle: "",
        prevArtist: "",
        action: "missing_chart",
      });
      continue;
    }

    const entry = await prisma.chartEntry.findFirst({
      where: { chartId: chart.id, position },
      select: {
        id: true,
        song: { select: { id: true, title: true, artist: true } },
      },
    });
    if (!entry) {
      rows.push({
        weekIndex,
        position,
        chartId: chart.id,
        entryId: "",
        prevSongId: "",
        prevTitle: "",
        prevArtist: "",
        action: "missing_slot",
      });
      continue;
    }

    const ok = entry.song.id === canonical.id;
    rows.push({
      weekIndex,
      position,
      chartId: chart.id,
      entryId: entry.id,
      prevSongId: entry.song.id,
      prevTitle: entry.song.title,
      prevArtist: entry.song.artist,
      action: ok ? "ok" : "fix",
    });
  }

  const toFix = rows.filter((r) => r.action === "fix");

  console.log(
    JSON.stringify(
      {
        bang20SheetYear: year,
        canonicalId: canonical.id,
        canonical: { title: canonical.title, artist: canonical.artist, spotifyId: canonical.spotifyId },
        counts: {
          ok: rows.filter((r) => r.action === "ok").length,
          fix: toFix.length,
          missing_chart: rows.filter((r) => r.action === "missing_chart").length,
          missing_slot: rows.filter((r) => r.action === "missing_slot").length,
        },
        fixes_preview: toFix.map((r) => ({
          weekIndex: r.weekIndex,
          position: r.position,
          entryId: r.entryId,
          was: { id: r.prevSongId, title: r.prevTitle, artist: r.prevArtist },
        })),
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    console.log("dry-run: não alteramos o banco.");
    return;
  }

  let updated = 0;
  for (const r of toFix) {
    if (!r.entryId) continue;
    await prisma.chartEntry.update({
      where: { id: r.entryId },
      data: {
        songId: canonical.id,
        songSpotifyId: canonical.spotifyId ?? null,
        albumSpotifyId: null,
      },
    });
    updated += 1;
  }

  console.log(JSON.stringify({ ok: true, chartEntries_updated: updated }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

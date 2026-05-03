/**
 * BANG20 oficial 2008, abas conforme `_scan_bang20_doushite.py`:
 * garante nas paradas de romulolima22 que a faixa nos (weekIndex, posição) esperados
 * aponta para a Song canónica «Doushite kimi wo suki ni natte shimattandarou?» / «TVXQ!».
 *
 * Uso:
 *   npx tsx scripts/sync-bang20-doushite-romulo.ts --dry-run
 *   npx tsx scripts/sync-bang20-doushite-romulo.ts --apply
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HANDLE = "romulolima22";

const SHEET_TITLE = "Doushite kimi wo suki ni natte shimattandarou?";
const SHEET_ARTIST = "TVXQ!";

/** Linhas lidas do BANG20oficial.xlsx aba 2008 (ISO da semana de referência B col ≈ Domingo implícito no import). */
const EXPECTED: readonly [weekIndex: number, position: number][] = [
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

async function main() {
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

  for (const [weekIndex, position] of EXPECTED) {
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

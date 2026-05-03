/**
 * Reverte a fusão errada entre duas faixas distintas do 2AM:
 * - "I was wrong" (canónica com Spotify) — mantém-se.
 * - "I wonder if you hurt like me" — volta a ser `Song` própria e as entradas
 *   nas semanas certas de 2012 (BANG20) deixam de apontar para "I was wrong".
 *
 * Fonte das 17 semanas: BANG20oficial.xlsx aba 2012 (weekIndex ISO + posição).
 *
 * Uso: npx tsx scripts/fix-2am-i-wonder-vs-i-was-wrong.ts --dry-run
 *      npx tsx scripts/fix-2am-i-wonder-vs-i-was-wrong.ts --apply
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";

const HANDLE = "romulolima22";
/** `Song` "I was wrong" / 2AM (com Spotify) — não alterar título/artista. */
const I_WAS_WRONG_SONG_ID = "b79468b71cdf4c718b3b5cd2ea06feaf";

/** Pares (weekIndex, position) onde a planilha 2012 tinha "I wonder if you hurt like me". */
const I_WONDER_CHART_SLOTS: Array<[number, number]> = [
  [201211, 4],
  [201212, 1],
  [201213, 4],
  [201214, 2],
  [201215, 3],
  [201216, 5],
  [201217, 5],
  [201218, 4],
  [201219, 6],
  [201220, 7],
  [201221, 9],
  [201222, 10],
  [201223, 13],
  [201224, 16],
  [201225, 18],
  [201226, 19],
  [201227, 15],
];

function loadEnvFile() {
  const p = path.join(process.cwd(), ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile();

async function main() {
  const apply = process.argv.includes("--apply") && !process.argv.includes("--dry-run");

  const user = await prisma.user.findUnique({ where: { handle: HANDLE }, select: { id: true } });
  if (!user) {
    console.error("User não encontrado:", HANDLE);
    process.exit(1);
  }

  const canon = await prisma.song.findUnique({
    where: { id: I_WAS_WRONG_SONG_ID },
    select: { id: true, title: true, artist: true, spotifyId: true },
  });
  if (!canon) {
    console.error("Song canónica I was wrong não encontrada:", I_WAS_WRONG_SONG_ID);
    process.exit(1);
  }

  let existingWonder = await prisma.song.findUnique({
    where: { title_artist: { title: "I wonder if you hurt like me", artist: "2AM" } },
    select: { id: true },
  });

  const preview: unknown[] = [];
  for (const [weekIndex, position] of I_WONDER_CHART_SLOTS) {
    const chart = await prisma.chart.findUnique({
      where: { userId_weekIndex: { userId: user.id, weekIndex } },
      select: { id: true, weekLabel: true },
    });
    if (!chart) {
      preview.push({ weekIndex, position, error: "chart_missing" });
      continue;
    }
    const entry = await prisma.chartEntry.findUnique({
      where: { chartId_position: { chartId: chart.id, position } },
      select: { id: true, songId: true, songSpotifyId: true },
    });
    if (!entry) {
      preview.push({ weekIndex, position, error: "entry_missing" });
      continue;
    }
    if (entry.songId !== canon.id) {
      preview.push({
        weekIndex,
        position,
        warn: "entry_song_not_canon_skip",
        songId: entry.songId,
      });
      continue;
    }
    preview.push({ weekIndex, position, chartId: chart.id, entryId: entry.id, ok: true });
  }

  console.log(JSON.stringify({ apply, canon, preview_count: preview.length, preview }, null, 2));

  const okSlots = preview.filter((p) => typeof p === "object" && p && (p as { ok?: boolean }).ok) as Array<{
    weekIndex: number;
    position: number;
    chartId: string;
    entryId: string;
  }>;

  if (!apply) {
    console.log("dry_run_done", okSlots.length, "updates would run");
    return;
  }

  if (!existingWonder) {
    existingWonder = await prisma.song.create({
      data: {
        title: "I wonder if you hurt like me",
        artist: "2AM",
      },
      select: { id: true },
    });
  }

  const wonderId = existingWonder.id;

  for (const row of okSlots) {
    await prisma.chartEntry.update({
      where: { id: row.entryId },
      data: {
        songId: wonderId,
        songSpotifyId: null,
        albumSpotifyId: null,
      },
    });
  }

  console.log(JSON.stringify({ ok: true, wonderSongId: wonderId, entries_updated: okSlots.length }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

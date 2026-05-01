/**
 * Unifica "Stay Together for the Kids" / blink-182: remapeia ChartEntry da duplicata
 * para a música canónica e apaga a linha `Song` duplicada.
 *
 * duplicata: fd7cbf82dbd54e6982dee1688c3bc0fe
 * correta:  cmomdlxb6006tg7u0j53zyd1a
 *
 * Uso: npx tsx scripts/fix-stay-together-kids-blink182-dedup.ts [--dry-run]
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";

const CANON = "cmomdlxb6006tg7u0j53zyd1a";
const DUP = "fd7cbf82dbd54e6982dee1688c3bc0fe";

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
  const dryRun = process.argv.includes("--dry-run");

  const canon = await prisma.song.findUnique({
    where: { id: CANON },
    select: { id: true, title: true, artist: true, spotifyId: true, albumSpotifyId: true },
  });
  const dup = await prisma.song.findUnique({
    where: { id: DUP },
    select: { id: true, title: true, artist: true, spotifyId: true, albumSpotifyId: true },
  });

  if (!canon) {
    console.error("Song canónica não encontrada:", CANON);
    process.exit(1);
  }
  if (!dup) {
    console.log("Duplicata já ausente ou nunca existiu:", DUP);
    process.exit(0);
  }

  const n = await prisma.chartEntry.count({ where: { songId: DUP } });
  console.log(JSON.stringify({ dryRun, canon, dup: dup.title, entries_from_dup: n }));

  const songSpotifyId = canon.spotifyId?.trim() || dup.spotifyId?.trim() || null;
  const albumSpotifyId = canon.albumSpotifyId?.trim() || dup.albumSpotifyId?.trim() || null;

  if (!dryRun) {
    await prisma.chartEntry.updateMany({
      where: { songId: DUP },
      data: {
        songId: CANON,
        songSpotifyId,
        albumSpotifyId,
      },
    });
    if ((await prisma.chartEntry.count({ where: { songId: DUP } })) === 0) {
      await prisma.song.delete({ where: { id: DUP } });
      console.log("deleted_dup", DUP);
    }
  }

  console.log(dryRun ? "dry_ok" : "ok", CANON);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

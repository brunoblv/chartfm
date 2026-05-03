/**
 * Alinha `ChartEntry` com a `Song` canônica: copia `spotifyId` e `albumSpotifyId`
 * para todas as paradas que usam essa música (`songId`).
 *
 * Opcional: `--from-entry-spotify=<trackId>` — atualiza linhas cuja `songSpotifyId`
 * ainda é a antiga (ex.: troca de faixa no Spotify), apontando `songId` para a song
 * informada e espelhando os ids atuais da song.
 *
 * Uso:
 *   npx tsx scripts/sync-chart-entries-from-song.ts --song-id=<cuid> [--dry-run]
 *   npx tsx scripts/sync-chart-entries-from-song.ts --song-id=<cuid> --from-entry-spotify=6uqRAsd93IzpS2tLR2s9mg [--dry-run]
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";

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

function argValue(prefix: string): string | null {
  const raw = process.argv.find((a) => a.startsWith(prefix));
  if (!raw) return null;
  const v = raw.slice(prefix.length).trim();
  return v || null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const songId = argValue("--song-id=");
  const fromEntrySpotify = argValue("--from-entry-spotify=");

  if (!songId) {
    console.error("Obrigatório: --song-id=<id da Song no Prisma>");
    process.exit(1);
  }

  const song = await prisma.song.findUnique({
    where: { id: songId },
    select: { id: true, title: true, artist: true, spotifyId: true, albumSpotifyId: true },
  });
  if (!song) {
    console.error("Song não encontrada:", songId);
    process.exit(1);
  }
  if (!song.spotifyId?.trim()) {
    console.error("Song sem spotifyId; nada a espelhar nas entradas.");
    process.exit(1);
  }

  const tid = song.spotifyId.trim();
  const aid = song.albumSpotifyId?.trim() ?? null;

  if (fromEntrySpotify) {
    const old = fromEntrySpotify.trim();
    const n = await prisma.chartEntry.count({ where: { songSpotifyId: old } });
    console.log(`entradas com songSpotifyId antigo (${old}):`, n);
    if (!dryRun && n > 0) {
      const r = await prisma.chartEntry.updateMany({
        where: { songSpotifyId: old },
        data: {
          songId: song.id,
          songSpotifyId: tid,
          albumSpotifyId: aid,
        },
      });
      console.log("updateMany (reapontar por spotify antigo na entrada):", r.count);
    }
  }

  const bySong = await prisma.chartEntry.count({ where: { songId: song.id } });
  console.log("entradas com songId:", bySong);

  if (!dryRun && bySong > 0) {
    const r2 = await prisma.chartEntry.updateMany({
      where: { songId: song.id },
      data: { songSpotifyId: tid, albumSpotifyId: aid },
    });
    console.log("updateMany (espelhar Song nas paradas):", r2.count);
  } else if (dryRun) {
    console.log("dry-run: não gravou alterações");
  } else {
    console.log("nenhuma ChartEntry com esse songId");
  }

  console.log("ok", song.title, "-", song.artist, tid);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

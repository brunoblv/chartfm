/**
 * Corrige artistas errados em importações:
 * - "Me Beija Com Raiva" (João Gomes → Jão)
 * - "Seu Direito" (David Guetta → Davi Sabbag)
 *
 * Atualiza `Song`, metadados Spotify e remapeia `ChartEntry`.
 *
 * Uso:
 *   npx tsx scripts/fix-me-beija-seu-direito.ts --dry-run
 *   npx tsx scripts/fix-me-beija-seu-direito.ts
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { getSpotifyTrackMetadataById, spotifyConfigured } from "../lib/spotify-server";

function loadEnvFile() {
  const p = path.join(process.cwd(), ".env");
  if (!existsSync(p)) return;
  const txt = readFileSync(p, "utf8");
  for (const line of txt.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile();

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type FixCase = {
  key: string;
  correctTrackSpotifyId: string;
  titleNeedle: string;
  wrongArtistNeedle: string;
  expectedArtistNeedle: string;
};

const CASES: FixCase[] = [
  {
    key: "me_beija_com_raiva",
    correctTrackSpotifyId: "7kRhodBTcAQXGoZdTEw8fZ",
    titleNeedle: "me beija com raiva",
    /** ILIKE não ignora acentos: cobrir joão / joao */
    wrongArtistNeedle: "gomes",
    expectedArtistNeedle: "jao",
  },
  {
    key: "seu_direito",
    correctTrackSpotifyId: "7xqOrMrc8BJSR5tZHa6UDL",
    titleNeedle: "seu direito",
    wrongArtistNeedle: "david guetta",
    expectedArtistNeedle: "davi",
  },
];

async function fixOne(c: FixCase, dryRun: boolean) {
  const meta = await getSpotifyTrackMetadataById(c.correctTrackSpotifyId, "BR");
  if (!meta?.primaryArtist?.name) {
    console.error(`[${c.key}] Falha ao obter metadados Spotify.`);
    return false;
  }
  const nTitle = normalize(meta.title);
  const nArtist = normalize(meta.primaryArtist.name);
  if (!nTitle.includes(normalize(c.titleNeedle))) {
    console.error(`[${c.key}] Título inesperado: ${meta.title}`);
    return false;
  }
  if (!nArtist.includes(c.expectedArtistNeedle)) {
    console.error(`[${c.key}] Artista inesperado: ${meta.primaryArtist.name}`);
    return false;
  }

  const canonical = await prisma.song.findUnique({
    where: { spotifyId: c.correctTrackSpotifyId },
    select: { id: true, title: true, artist: true, spotifyId: true },
  });

  let wrongRows = await prisma.song.findMany({
    where: {
      title: { contains: c.titleNeedle, mode: "insensitive" },
      artist: { contains: c.wrongArtistNeedle, mode: "insensitive" },
    },
    select: { id: true, title: true, artist: true, spotifyId: true },
    orderBy: { id: "asc" },
  });

  if (c.key === "me_beija_com_raiva") {
    wrongRows = wrongRows.filter((s) => {
      const a = normalize(s.artist);
      return a.includes("joao") && a.includes("gomes");
    });
  }

  let target = canonical ?? wrongRows[0] ?? null;

  if (!target) {
    if (dryRun) {
      console.log(`[${c.key}] DRY criaria Song`, { title: meta.title, artist: meta.primaryArtist.name });
      return true;
    }
    target = await prisma.song.create({
      data: {
        title: meta.title,
        artist: meta.primaryArtist.name,
        album: meta.album.title ?? null,
      },
      select: { id: true, title: true, artist: true, spotifyId: true },
    });
  }

  console.log(`[${c.key}] target_before`, target);
  console.log(`[${c.key}] wrong_rows`, wrongRows.length);

  const applied = await applySpotifyMetadataToSong(target.id, meta, dryRun);
  if (!applied.ok) {
    console.error(`[${c.key}] Falha ao aplicar metadados:`, applied.reason);
    return false;
  }

  if (!dryRun) {
    await prisma.song.update({
      where: { id: target.id },
      data: {
        title: meta.title,
        artist: meta.primaryArtist.name,
        album: meta.album.title ?? undefined,
      },
    });
  }

  const sourceIds = wrongRows.map((s) => s.id).filter((id) => id !== target.id);
  for (const sourceId of sourceIds) {
    if (dryRun) {
      const count = await prisma.chartEntry.count({ where: { songId: sourceId } });
      console.log(`[${c.key}] DRY remap`, { fromSongId: sourceId, toSongId: target.id, entries: count });
      continue;
    }
    const moved = await prisma.chartEntry.updateMany({
      where: { songId: sourceId },
      data: {
        songId: target.id,
        songSpotifyId: meta.spotifyId,
        albumSpotifyId: meta.album.spotifyId ?? null,
      },
    });
    console.log(`[${c.key}] remapped_entries`, { fromSongId: sourceId, toSongId: target.id, count: moved.count });
    const refs = await prisma.chartEntry.count({ where: { songId: sourceId } });
    if (refs === 0) {
      await prisma.song.delete({ where: { id: sourceId } });
      console.log(`[${c.key}] deleted_duplicate_song`, sourceId);
    }
  }

  console.log(dryRun ? `[${c.key}] dry_run_ok` : `[${c.key}] updated_ok`, {
    songId: target.id,
    spotifyId: meta.spotifyId,
    title: meta.title,
    artist: meta.primaryArtist.name,
  });
  return true;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }
  for (const c of CASES) {
    const ok = await fixOne(c, dryRun);
    if (!ok) process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

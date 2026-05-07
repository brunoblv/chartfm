/**
 * Corrige a faixa "Dripping Tears" (Spotify antigo equivocado) para o track oficial
 * 눈물이 주르륵 (`3c0IvTM0FU4cwQJwvDvr8G`). Mantém o mesmo `songId` interno
 * (`8fe8b2d3f26f4c219bb2bcf794518838`) para URLs `12354_...`.
 *
 * Uso: npx tsx scripts/fix-son-dambi-dripping-tears-correct-spotify-track.ts [--dry-run]
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { getSpotifyTrackMetadataById, spotifyConfigured } from "../lib/spotify-server";

const SONG_ID = "8fe8b2d3f26f4c219bb2bcf794518838";
const OLD_SPOTIFY_EXPECTED = "1zRaoBGOYYuqOEz7VTvdKE";
const NEW_SPOTIFY = "3c0IvTM0FU4cwQJwvDvr8G";

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile();

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\uac00-\ud7af]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function patchSnapshotSpotify(
  value: unknown,
  oldSid: string,
  newSid: string,
  internalSongId: string,
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (value === `song_spotify:${oldSid}`) return `song_spotify:${newSid}`;
    return value;
  }
  if (Array.isArray(value)) return value.map((x) => patchSnapshotSpotify(x, oldSid, newSid, internalSongId));
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      const nk = k === `song_spotify:${oldSid}` ? `song_spotify:${newSid}` : k;
      out[nk] = patchSnapshotSpotify(v, oldSid, newSid, internalSongId);
    }
    if (typeof out.song === "object" && out.song !== null) {
      const s = out.song as Record<string, unknown>;
      if (typeof s.id === "string" && s.id === internalSongId && typeof s.spotifyId === "string") {
        if (s.spotifyId === oldSid) s.spotifyId = newSid;
      }
    }
    return out;
  }
  return value;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  const row = await prisma.song.findUnique({
    where: { id: SONG_ID },
    select: { id: true, title: true, artist: true, spotifyId: true, albumSpotifyId: true },
  });
  if (!row) {
    console.error("Song não encontrada:", SONG_ID);
    process.exit(1);
  }
  if (row.spotifyId !== OLD_SPOTIFY_EXPECTED) {
    console.error("spotifyId na BD não bate com o esperado (abortar).", row.spotifyId, "!=", OLD_SPOTIFY_EXPECTED);
    process.exit(1);
  }
  if (!norm(row.title).includes("dripping") || !norm(row.artist).includes("son")) {
    console.error("Título/artista na BD inesperados (abortar).", row);
    process.exit(1);
  }

  const meta = await getSpotifyTrackMetadataById(NEW_SPOTIFY, "BR");
  if (!meta?.title) {
    console.error("Metadados Spotify vazios");
    process.exit(1);
  }
  const artistNorm = norm(meta.primaryArtist?.name ?? "");
  if (!artistNorm.includes("dam") && !artistNorm.includes("son") && !artistNorm.includes("dambi")) {
    console.error("Artista Spotify inesperado:", meta.primaryArtist?.name);
    process.exit(1);
  }

  const nEntries = await prisma.chartEntry.count({ where: { songId: SONG_ID } });

  console.log(
    JSON.stringify(
      {
        dryRun,
        before: row,
        spotifyTitle: meta.title,
        spotifyArtist: meta.primaryArtist?.name,
        chartEntries: nEntries,
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    console.log("dry_ok (nada gravado)");
    return;
  }

  const applied = await applySpotifyMetadataToSong(SONG_ID, meta, false);
  if (!applied.ok) {
    console.error("applySpotifyMetadataToSong:", applied.reason);
    process.exit(1);
  }

  await prisma.song.update({
    where: { id: SONG_ID },
    data: {
      title: meta.title,
      artist: meta.primaryArtist.name,
      album: meta.album.title ?? undefined,
    },
  });

  const snapshots = await prisma.globalSnapshot.findMany({
    select: { id: true, weeklySongs: true, overallSongs: true },
  });
  let snapPatched = 0;
  for (const s of snapshots) {
    const nextW = patchSnapshotSpotify(s.weeklySongs, OLD_SPOTIFY_EXPECTED, NEW_SPOTIFY, SONG_ID);
    const nextO = patchSnapshotSpotify(s.overallSongs, OLD_SPOTIFY_EXPECTED, NEW_SPOTIFY, SONG_ID);
    if (JSON.stringify(nextW) !== JSON.stringify(s.weeklySongs) || JSON.stringify(nextO) !== JSON.stringify(s.overallSongs)) {
      await prisma.globalSnapshot.update({
        where: { id: s.id },
        data: { weeklySongs: nextW as object, overallSongs: nextO as object },
      });
      snapPatched++;
    }
  }

  const after = await prisma.song.findUnique({
    where: { id: SONG_ID },
    select: { id: true, title: true, artist: true, spotifyId: true, albumSpotifyId: true },
  });
  const stale = await prisma.chartEntry.count({
    where: { songId: SONG_ID, songSpotifyId: { not: NEW_SPOTIFY } },
  });
  if (after?.spotifyId !== NEW_SPOTIFY || stale > 0) {
    console.error("Verificação falhou", { after, staleEntries: stale });
    process.exit(1);
  }

  console.log("ok", { songId: SONG_ID, spotifyId: NEW_SPOTIFY, globalSnapshotsPatched: snapPatched, chartEntries: nEntries });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

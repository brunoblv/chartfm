/**
 * Corrige "Attention" — Charlie Puth para a faixa oficial do Spotify:
 * https://open.spotify.com/track/5cF0dROlMOK5uNZtivgu50
 *
 * Também sincroniza entradas das paradas (ChartEntry) e snapshots globais.
 *
 * Uso: npx tsx scripts/fix-attention-charlie-puth-spotify.ts [--dry-run]
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { getSpotifyTrackMetadataById, spotifyConfigured } from "../lib/spotify-server";

const LOCAL_SONG_ID = "677322a98b71434facae78a98a82bdcf";
const TARGET_TRACK_ID = "5cF0dROlMOK5uNZtivgu50";

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile();

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function patchSnapshotJson(value: unknown, fromSongId: string, toSongId: string, oldSid: string | null, newSid: string): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (oldSid && value === `song_spotify:${oldSid}`) return `song_spotify:${newSid}`;
    return value;
  }
  if (Array.isArray(value)) return value.map((x) => patchSnapshotJson(x, fromSongId, toSongId, oldSid, newSid));
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      const nk = oldSid && k === `song_spotify:${oldSid}` ? `song_spotify:${newSid}` : k;
      out[nk] = patchSnapshotJson(v, fromSongId, toSongId, oldSid, newSid);
    }
    if (typeof out.song === "object" && out.song !== null) {
      const s = out.song as Record<string, unknown>;
      if (typeof s.id === "string" && s.id === fromSongId) s.id = toSongId;
      if (oldSid && typeof s.spotifyId === "string" && s.spotifyId === oldSid) s.spotifyId = newSid;
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

  const [source, targetMeta, existingWithTargetSpotify] = await Promise.all([
    prisma.song.findUnique({
      where: { id: LOCAL_SONG_ID },
      select: { id: true, title: true, artist: true, album: true, spotifyId: true, albumSpotifyId: true },
    }),
    getSpotifyTrackMetadataById(TARGET_TRACK_ID, "BR"),
    prisma.song.findFirst({
      where: { spotifyId: TARGET_TRACK_ID },
      select: { id: true, title: true, artist: true, spotifyId: true },
    }),
  ]);

  if (!source) {
    console.error("Song local não encontrada:", LOCAL_SONG_ID);
    process.exit(1);
  }
  if (!targetMeta) {
    console.error("Falha ao carregar metadados do Spotify:", TARGET_TRACK_ID);
    process.exit(1);
  }

  const metaTitle = norm(targetMeta.title ?? "");
  const metaArtist = norm(targetMeta.primaryArtist?.name ?? "");
  if (!metaTitle.includes("attention")) {
    console.error("Título inesperado no Spotify:", targetMeta.title);
    process.exit(1);
  }
  if (!metaArtist.includes("charlie puth")) {
    console.error("Artista inesperado no Spotify:", targetMeta.primaryArtist?.name);
    process.exit(1);
  }

  const canonicalSongId = existingWithTargetSpotify?.id ?? source.id;
  const oldSpotifyId = source.spotifyId ?? null;
  const oldSongId = source.id;

  const entriesByOldSong = await prisma.chartEntry.count({ where: { songId: oldSongId } });
  const entriesByOldSpotify = oldSpotifyId
    ? await prisma.chartEntry.count({ where: { songSpotifyId: oldSpotifyId } })
    : 0;

  console.log(
    JSON.stringify(
      {
        dryRun,
        source,
        target: {
          spotifyId: targetMeta.spotifyId,
          title: targetMeta.title,
          artist: targetMeta.primaryArtist?.name ?? null,
          albumSpotifyId: targetMeta.album.spotifyId ?? null,
        },
        canonicalSongId,
        entriesByOldSong,
        entriesByOldSpotify,
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    console.log("dry_ok (nada gravado)");
    return;
  }

  if (canonicalSongId === source.id) {
    const applied = await applySpotifyMetadataToSong(source.id, targetMeta, false);
    if (!applied.ok) {
      console.error("Falha ao aplicar metadados:", applied.reason);
      process.exit(1);
    }
    await prisma.song.update({
      where: { id: source.id },
      data: {
        title: targetMeta.title,
        artist: targetMeta.primaryArtist?.name ?? source.artist,
        album: targetMeta.album.title ?? source.album,
      },
    });
  } else {
    await prisma.chartEntry.updateMany({
      where: { songId: source.id },
      data: {
        songId: canonicalSongId,
        songSpotifyId: TARGET_TRACK_ID,
        albumSpotifyId: targetMeta.album.spotifyId ?? null,
      },
    });
  }

  if (oldSpotifyId && oldSpotifyId !== TARGET_TRACK_ID) {
    await prisma.chartEntry.updateMany({
      where: { songSpotifyId: oldSpotifyId },
      data: {
        songId: canonicalSongId,
        songSpotifyId: TARGET_TRACK_ID,
        albumSpotifyId: targetMeta.album.spotifyId ?? null,
      },
    });
  }

  const snapshots = await prisma.globalSnapshot.findMany({
    select: { id: true, weeklySongs: true, overallSongs: true },
  });
  let snapPatched = 0;
  for (const row of snapshots) {
    const nextW = patchSnapshotJson(row.weeklySongs, oldSongId, canonicalSongId, oldSpotifyId, TARGET_TRACK_ID);
    const nextO = patchSnapshotJson(row.overallSongs, oldSongId, canonicalSongId, oldSpotifyId, TARGET_TRACK_ID);
    if (
      JSON.stringify(nextW) !== JSON.stringify(row.weeklySongs) ||
      JSON.stringify(nextO) !== JSON.stringify(row.overallSongs)
    ) {
      await prisma.globalSnapshot.update({
        where: { id: row.id },
        data: { weeklySongs: nextW as object, overallSongs: nextO as object },
      });
      snapPatched++;
    }
  }

  const afterEntries = await prisma.chartEntry.count({ where: { songId: canonicalSongId, songSpotifyId: TARGET_TRACK_ID } });
  const leftoversByOldSpotify = oldSpotifyId
    ? await prisma.chartEntry.count({ where: { songSpotifyId: oldSpotifyId } })
    : 0;

  console.log("ok", {
    canonicalSongId,
    trackId: TARGET_TRACK_ID,
    chartEntriesWithCanonical: afterEntries,
    leftoverEntriesOldSpotify: leftoversByOldSpotify,
    snapshotsPatched: snapPatched,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

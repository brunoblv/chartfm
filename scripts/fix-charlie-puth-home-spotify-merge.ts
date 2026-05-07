/**
 * Unifica "Home (feat. Hikaru Utada)" — Charlie Puth: track duplicada 4V9fJ12KcWd78OSAqYNO9r → canônica 4J94SiPF6wkqBBUFWCSD8w
 * (álbum Whatever's Clever!). Atualiza ChartEntry, SongFeat, snapshots globais e remove Song duplicada.
 *
 * Uso: npx tsx scripts/fix-charlie-puth-home-spotify-merge.ts [--dry-run]
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma";

type PrismaDb = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { getSpotifyTrackMetadataById, spotifyConfigured } from "../lib/spotify-server";

const CANON_SPOTIFY = "4J94SiPF6wkqBBUFWCSD8w";
const DUP_SPOTIFY = "4V9fJ12KcWd78OSAqYNO9r";

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
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function patchSnapshotJson(
  value: unknown,
  dupSongId: string | null,
  canonSongId: string,
  oldSid: string,
  newSid: string,
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (value === `song_spotify:${oldSid}`) return `song_spotify:${newSid}`;
    return value;
  }
  if (Array.isArray(value)) return value.map((x) => patchSnapshotJson(x, dupSongId, canonSongId, oldSid, newSid));
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      const nk = k === `song_spotify:${oldSid}` ? `song_spotify:${newSid}` : k;
      out[nk] = patchSnapshotJson(v, dupSongId, canonSongId, oldSid, newSid);
    }
    if (typeof out.song === "object" && out.song !== null) {
      const s = out.song as Record<string, unknown>;
      if (dupSongId && typeof s.id === "string" && s.id === dupSongId) s.id = canonSongId;
      if (typeof s.spotifyId === "string" && s.spotifyId === oldSid) s.spotifyId = newSid;
    }
    return out;
  }
  return value;
}

async function migrateSongFeats(tx: PrismaDb, fromSid: string, toSid: string) {
  const feats = await tx.songFeat.findMany({
    where: { songSpotifyId: fromSid },
    select: { artistSpotifyId: true },
  });
  for (const feat of feats) {
    await tx.songFeat.upsert({
      where: {
        songSpotifyId_artistSpotifyId: {
          songSpotifyId: toSid,
          artistSpotifyId: feat.artistSpotifyId,
        },
      },
      update: {},
      create: { songSpotifyId: toSid, artistSpotifyId: feat.artistSpotifyId },
    });
  }
  await tx.songFeat.deleteMany({ where: { songSpotifyId: fromSid } });
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  const meta = await getSpotifyTrackMetadataById(CANON_SPOTIFY, "BR");
  if (!meta?.primaryArtist?.name || !norm(meta.title).includes("home")) {
    console.error("Metadados inválidos para track canônica", meta?.title, meta?.primaryArtist?.name);
    process.exit(1);
  }
  if (!norm(meta.primaryArtist.name).includes("charlie") || !norm(meta.primaryArtist.name).includes("puth")) {
    console.error("Artista esperado Charlie Puth", meta.primaryArtist.name);
    process.exit(1);
  }

  const [canonSong, dupSong] = await Promise.all([
    prisma.song.findUnique({
      where: { spotifyId: CANON_SPOTIFY },
      select: { id: true, title: true, artist: true, spotifyId: true, albumSpotifyId: true },
    }),
    prisma.song.findUnique({
      where: { spotifyId: DUP_SPOTIFY },
      select: { id: true, title: true, artist: true, spotifyId: true, albumSpotifyId: true },
    }),
  ]);

  const entriesOldSid = await prisma.chartEntry.count({ where: { songSpotifyId: DUP_SPOTIFY } });

  console.log(
    JSON.stringify(
      {
        dryRun,
        canonSong,
        dupSong,
        chart_entries_with_dup_spotify_id: entriesOldSid,
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    console.log("dry_ok (nada gravado)");
    return;
  }

  const albumSpotifyId = meta.album.spotifyId ?? null;

  if (canonSong && dupSong && canonSong.id !== dupSong.id) {
    await prisma.$transaction(async (tx) => {
      await tx.chartEntry.updateMany({
        where: { songId: dupSong.id },
        data: { songId: canonSong.id, songSpotifyId: CANON_SPOTIFY, albumSpotifyId },
      });
      await tx.chartEntry.updateMany({
        where: { songSpotifyId: DUP_SPOTIFY },
        data: { songSpotifyId: CANON_SPOTIFY, albumSpotifyId },
      });
      await migrateSongFeats(tx, DUP_SPOTIFY, CANON_SPOTIFY);
      await tx.song.delete({ where: { id: dupSong.id } });
    });
    const applied = await applySpotifyMetadataToSong(canonSong.id, meta, false);
    if (!applied.ok) {
      console.error("applySpotifyMetadataToSong:", applied.reason);
      process.exit(1);
    }
    await prisma.song.update({
      where: { id: canonSong.id },
      data: {
        title: meta.title,
        artist: meta.primaryArtist.name,
        album: meta.album.title ?? undefined,
      },
    });
  } else if (!canonSong && dupSong) {
    const applied = await applySpotifyMetadataToSong(dupSong.id, meta, false);
    if (!applied.ok) {
      console.error("applySpotifyMetadataToSong:", applied.reason);
      process.exit(1);
    }
    await prisma.chartEntry.updateMany({
      where: { songSpotifyId: DUP_SPOTIFY },
      data: { songSpotifyId: CANON_SPOTIFY, albumSpotifyId },
    });
    await prisma.song.update({
      where: { id: dupSong.id },
      data: {
        title: meta.title,
        artist: meta.primaryArtist.name,
        album: meta.album.title ?? undefined,
      },
    });
  } else if (canonSong && !dupSong) {
    await prisma.chartEntry.updateMany({
      where: { songSpotifyId: DUP_SPOTIFY },
      data: { songSpotifyId: CANON_SPOTIFY, albumSpotifyId },
    });
    await migrateSongFeats(prisma, DUP_SPOTIFY, CANON_SPOTIFY);
    const applied = await applySpotifyMetadataToSong(canonSong.id, meta, false);
    if (!applied.ok) {
      console.error("applySpotifyMetadataToSong:", applied.reason);
      process.exit(1);
    }
    await prisma.song.update({
      where: { id: canonSong.id },
      data: {
        title: meta.title,
        artist: meta.primaryArtist.name,
        album: meta.album.title ?? undefined,
      },
    });
  } else {
    console.error("Nenhuma Song duplicada encontrada ou já unificado.");
    process.exit(1);
  }

  const dupIdForSnapshot = dupSong?.id ?? null;
  const keepId = canonSong?.id ?? dupSong!.id;
  const snapshots = await prisma.globalSnapshot.findMany({
    select: { id: true, weeklySongs: true, overallSongs: true },
  });
  for (const row of snapshots) {
    const nextW = patchSnapshotJson(row.weeklySongs, dupIdForSnapshot, keepId, DUP_SPOTIFY, CANON_SPOTIFY);
    const nextO = patchSnapshotJson(row.overallSongs, dupIdForSnapshot, keepId, DUP_SPOTIFY, CANON_SPOTIFY);
    if (
      JSON.stringify(nextW) !== JSON.stringify(row.weeklySongs) ||
      JSON.stringify(nextO) !== JSON.stringify(row.overallSongs)
    ) {
      await prisma.globalSnapshot.update({
        where: { id: row.id },
        data: { weeklySongs: nextW as object, overallSongs: nextO as object },
      });
    }
  }

  const leftoverDupSong = await prisma.song.findUnique({
    where: { spotifyId: DUP_SPOTIFY },
    select: { id: true },
  });
  const leftoverEntries = await prisma.chartEntry.count({ where: { songSpotifyId: DUP_SPOTIFY } });
  if (leftoverDupSong || leftoverEntries > 0) {
    console.error("Ainda há referências ao id Spotify antigo", { leftoverDupSong, leftoverEntries });
    process.exit(1);
  }

  const totalEntries = await prisma.chartEntry.count({
    where: { OR: [{ songId: keepId }, { songSpotifyId: CANON_SPOTIFY }] },
  });
  console.log("ok", { keepSongId: keepId, spotifyId: CANON_SPOTIFY, chartEntriesCanon: totalEntries });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

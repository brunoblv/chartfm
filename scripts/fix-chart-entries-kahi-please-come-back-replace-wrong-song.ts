/**
 * Reaponta ChartEntry (e JSON em GlobalSnapshot) da faixa errada para a correta:
 * de "Ba Ba Bad Remix" / Kybba (`0ca4afa26fe7449cb5eb3215bfd7c46f`) para
 * "Please come back" / Kahi (Spotify `2nei7PzO2Ml7Y7RMHdxHAu`).
 *
 * Uso: npx tsx scripts/fix-chart-entries-kahi-please-come-back-replace-wrong-song.ts [--dry-run]
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { getSpotifyTrackMetadataById, spotifyConfigured } from "../lib/spotify-server";

const FROM_SONG_ID = "0ca4afa26fe7449cb5eb3215bfd7c46f";
const CANON_SPOTIFY = "2nei7PzO2Ml7Y7RMHdxHAu";

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
  fromSongId: string,
  toSongId: string,
  oldSid: string,
  newSid: string,
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (value === `song_spotify:${oldSid}`) return `song_spotify:${newSid}`;
    return value;
  }
  if (Array.isArray(value)) return value.map((x) => patchSnapshotJson(x, fromSongId, toSongId, oldSid, newSid));
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      const nk = k === `song_spotify:${oldSid}` ? `song_spotify:${newSid}` : k;
      out[nk] = patchSnapshotJson(v, fromSongId, toSongId, oldSid, newSid);
    }
    if (typeof out.song === "object" && out.song !== null) {
      const s = out.song as Record<string, unknown>;
      if (typeof s.id === "string" && s.id === fromSongId) s.id = toSongId;
      if (typeof s.spotifyId === "string" && s.spotifyId === oldSid) s.spotifyId = newSid;
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

  const [fromSong, canonSong, meta] = await Promise.all([
    prisma.song.findUnique({
      where: { id: FROM_SONG_ID },
      select: { id: true, title: true, artist: true, spotifyId: true, albumSpotifyId: true },
    }),
    prisma.song.findUnique({
      where: { spotifyId: CANON_SPOTIFY },
      select: { id: true, title: true, artist: true, spotifyId: true, albumSpotifyId: true },
    }),
    getSpotifyTrackMetadataById(CANON_SPOTIFY, "BR"),
  ]);

  if (!fromSong?.spotifyId) {
    console.error("Song de origem não encontrada ou sem spotifyId:", FROM_SONG_ID);
    process.exit(1);
  }
  if (!canonSong) {
    console.error("Song canônica não encontrada para spotifyId:", CANON_SPOTIFY);
    process.exit(1);
  }
  if (!meta?.title || !norm(meta.title).includes("please") || !norm(meta.title).includes("come")) {
    console.error("Spotify: título inesperado para faixa canônica", meta?.title);
    process.exit(1);
  }
  if (!meta.primaryArtist?.name || !norm(meta.primaryArtist.name).includes("kahi")) {
    console.error("Spotify: artista esperado Kahi", meta?.primaryArtist?.name);
    process.exit(1);
  }
  if (!norm(fromSong.title).includes("ba ba bad") || !norm(fromSong.artist).includes("kybba")) {
    console.error("BD: faixa de origem não é Kybba / Ba Ba Bad (abortar).", fromSong);
    process.exit(1);
  }

  const oldSid = fromSong.spotifyId;
  const newSid = canonSong.spotifyId!;
  const albumSpotifyId = meta.album.spotifyId ?? canonSong.albumSpotifyId ?? null;

  const nBySongId = await prisma.chartEntry.count({ where: { songId: FROM_SONG_ID } });
  const nByOldSpotify = await prisma.chartEntry.count({
    where: { songSpotifyId: oldSid, NOT: { songId: FROM_SONG_ID } },
  });

  console.log(
    JSON.stringify(
      {
        dryRun,
        fromSong,
        canonSong,
        albumSpotifyId,
        chart_entries_by_from_song_id: nBySongId,
        chart_entries_old_spotify_other_song_id: nByOldSpotify,
      },
      null,
      2,
    ),
  );

  if (nByOldSpotify > 0) {
    console.error("Há entradas com songSpotifyId antigo e outro songId; resolva manualmente.", nByOldSpotify);
    process.exit(1);
  }

  if (dryRun) {
    console.log("dry_ok (nada gravado)");
    return;
  }

  const updated = await prisma.chartEntry.updateMany({
    where: { songId: FROM_SONG_ID },
    data: {
      songId: canonSong.id,
      songSpotifyId: newSid,
      albumSpotifyId,
    },
  });

  const snapshots = await prisma.globalSnapshot.findMany({
    select: { id: true, weeklySongs: true, overallSongs: true },
  });
  let snapPatched = 0;
  for (const row of snapshots) {
    const nextW = patchSnapshotJson(row.weeklySongs, FROM_SONG_ID, canonSong.id, oldSid, newSid);
    const nextO = patchSnapshotJson(row.overallSongs, FROM_SONG_ID, canonSong.id, oldSid, newSid);
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

  const leftover = await prisma.chartEntry.count({ where: { songId: FROM_SONG_ID } });
  if (leftover > 0) {
    console.error("Ainda há ChartEntry apontando para songId de origem:", leftover);
    process.exit(1);
  }

  console.log("ok", { chartEntriesUpdated: updated.count, globalSnapshotsPatched: snapPatched, canonSongId: canonSong.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

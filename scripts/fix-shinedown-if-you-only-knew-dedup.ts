/**
 * Unifica "If Only She Knew" (errado) → "If You Only Knew" — Shinedown / Sound of Madness.
 * Remapeia ChartEntry, corrige vínculos `Song` ao artista/álbum, remove a faixa duplicada
 * e ajusta `global_snapshots` se ainda guardarem `song.id` da duplicata.
 *
 * Uso: npx tsx scripts/fix-shinedown-if-you-only-knew-dedup.ts [--dry-run]
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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile();

const CANON_TITLE = "If You Only Knew";
const DUP_TITLE = "If Only She Knew";
const ARTIST_NAME = "Shinedown";

function patchSongIdsInJson(value: unknown, dupId: string, canonId: string): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((x) => patchSongIdsInJson(x, dupId, canonId));
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      out[k] = patchSongIdsInJson(v, dupId, canonId);
    }
    if (typeof out.song === "object" && out.song !== null) {
      const s = out.song as Record<string, unknown>;
      if (typeof s.id === "string" && s.id === dupId) {
        s.id = canonId;
      }
      if (typeof s.title === "string" && (s.title as string).toLowerCase() === DUP_TITLE.toLowerCase()) {
        s.title = CANON_TITLE;
      }
    }
    return out;
  }
  return value;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const artistRow = await prisma.artist.findFirst({
    where: { name: { equals: ARTIST_NAME, mode: "insensitive" } },
    select: { spotifyId: true, name: true },
  });
  if (!artistRow?.spotifyId) {
    console.error(`Artista "${ARTIST_NAME}" não encontrado em artists`);
    process.exit(1);
  }

  const canonCandidates = await prisma.song.findMany({
    where: {
      artist: { equals: ARTIST_NAME, mode: "insensitive" },
      title: { equals: CANON_TITLE, mode: "insensitive" },
    },
    select: {
      id: true,
      title: true,
      artist: true,
      spotifyId: true,
      album: true,
      albumSpotifyId: true,
      artistSpotifyId: true,
    },
  });
  const dupCandidates = await prisma.song.findMany({
    where: {
      artist: { equals: ARTIST_NAME, mode: "insensitive" },
      title: { equals: DUP_TITLE, mode: "insensitive" },
    },
    select: {
      id: true,
      title: true,
      artist: true,
      spotifyId: true,
      album: true,
      albumSpotifyId: true,
      artistSpotifyId: true,
    },
  });

  if (canonCandidates.length > 1) {
    console.error("Mais de uma música canónica; resolva manualmente:", canonCandidates.map((s) => s.id));
    process.exit(1);
  }
  if (dupCandidates.length > 1) {
    console.error("Mais de uma duplicata; resolva manualmente:", dupCandidates.map((s) => s.id));
    process.exit(1);
  }

  const dup = dupCandidates[0];
  let canon = canonCandidates[0];

  if (!dup && !canon) {
    console.error("Nenhuma faixa encontrada com esses títulos.");
    process.exit(1);
  }

  if (!dup && canon) {
    console.log("Sem duplicata; só canónica presente. Aplicando só vínculos ao artista/álbum se faltar.");
    const albums = await prisma.album.findMany({
      where: {
        artistSpotifyId: artistRow.spotifyId,
        title: { contains: "Sound of Madness", mode: "insensitive" },
      },
      select: { spotifyId: true, title: true },
      orderBy: { id: "asc" },
    });
    if (albums.length === 0) {
      console.error("Álbum Sound of Madness não encontrado para este artista.");
      process.exit(1);
    }
    const albumPrefer = canon.albumSpotifyId ? albums.find((a) => a.spotifyId === canon.albumSpotifyId) : null;
    const albumChosen = albumPrefer ?? albums[0]!;
    const patch = {
      artistSpotifyId: artistRow.spotifyId,
      albumSpotifyId: albumChosen.spotifyId,
      album: canon.album?.trim() || "Sound of Madness",
    };
    console.log(JSON.stringify({ dryRun, only_patch_canon: true, canon: canon.id, patch }, null, 2));
    if (!dryRun) {
      await prisma.song.update({ where: { id: canon.id }, data: patch });
    }
    console.log(dryRun ? "dry_ok" : "ok_patch_only");
    return;
  }

  if (dup && !canon) {
    console.log("Canónica ausente: renomeia duplicata → título correto e liga ao álbum.");
    const albums = await prisma.album.findMany({
      where: {
        artistSpotifyId: artistRow.spotifyId,
        title: { contains: "Sound of Madness", mode: "insensitive" },
      },
      select: { spotifyId: true, title: true },
      orderBy: { id: "asc" },
    });
    if (albums.length === 0) {
      console.error("Álbum Sound of Madness não encontrado.");
      process.exit(1);
    }
    const albumChosen = dup.albumSpotifyId ? albums.find((a) => a.spotifyId === dup.albumSpotifyId) ?? albums[0]! : albums[0]!;
    const clash = await prisma.song.findFirst({
      where: {
        title: { equals: CANON_TITLE, mode: "insensitive" },
        artist: { equals: ARTIST_NAME, mode: "insensitive" },
        NOT: { id: dup.id },
      },
      select: { id: true },
    });
    if (clash) {
      console.error("Conflito @@unique([title, artist]) após renomeação:", clash.id);
      process.exit(1);
    }
    const body = {
      title: CANON_TITLE,
      artistSpotifyId: artistRow.spotifyId,
      albumSpotifyId: albumChosen.spotifyId,
      album: dup.album?.trim() || "Sound of Madness",
    };
    console.log(JSON.stringify({ dryRun, rename_dup_only: dup.id, body }, null, 2));
    if (!dryRun) await prisma.song.update({ where: { id: dup.id }, data: body });
    console.log(dryRun ? "dry_ok" : "ok_renamed_dup");
    return;
  }

  canon = canon!;

  const albums = await prisma.album.findMany({
    where: {
      artistSpotifyId: artistRow.spotifyId,
      title: { contains: "Sound of Madness", mode: "insensitive" },
    },
    select: { id: true, spotifyId: true, title: true },
    orderBy: { id: "asc" },
  });

  if (albums.length === 0) {
    console.error("Álbum Sound of Madness não encontrado.");
    process.exit(1);
  }

  const scoreAlbum = (a: (typeof albums)[0]) => {
    let n = 0;
    if (canon.albumSpotifyId === a.spotifyId) n += 100;
    if (dup!.albumSpotifyId === a.spotifyId) n += 10;
    return n;
  };
  const albumPrimary = [...albums].sort((a, b) => scoreAlbum(b) - scoreAlbum(a))[0]!;

  const nEntries = await prisma.chartEntry.count({ where: { songId: dup!.id } });
  const songSpotifyId = canon.spotifyId?.trim() || dup!.spotifyId?.trim() || null;
  const albumSpotifyId = albumPrimary.spotifyId;

  console.log(
    JSON.stringify(
      {
        dryRun,
        artist: artistRow.spotifyId,
        canon: { id: canon.id, title: canon.title, spotifyId: canon.spotifyId },
        dup: { id: dup!.id, title: dup!.title, spotifyId: dup!.spotifyId },
        entries_from_dup: nEntries,
        albums_found: albums.length,
        album_primary_spotify_id: albumPrimary.spotifyId,
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    console.log("dry_ok");
    return;
  }

  await prisma.chartEntry.updateMany({
    where: { songId: dup!.id },
    data: {
      songId: canon.id,
      songSpotifyId,
      albumSpotifyId,
    },
  });

  if (songSpotifyId && dup!.spotifyId === songSpotifyId) {
    await prisma.song.update({ where: { id: dup!.id }, data: { spotifyId: null } });
  }

  await prisma.song.update({
    where: { id: canon.id },
    data: {
      artistSpotifyId: artistRow.spotifyId,
      albumSpotifyId,
      album: canon.album?.trim() || dup!.album?.trim() || albumPrimary.title,
      spotifyId: songSpotifyId,
    },
  });

  if ((await prisma.chartEntry.count({ where: { songId: dup!.id } })) === 0) {
    await prisma.song.delete({ where: { id: dup!.id } });
    console.log("deleted_dup", dup!.id);
  } else {
    console.error("Ainda há entradas com songId dup; não apaguei a duplicata.");
    process.exit(1);
  }

  const snapshots = await prisma.globalSnapshot.findMany({ select: { id: true, weeklySongs: true, overallSongs: true } });
  for (const row of snapshots) {
    const nextW = patchSongIdsInJson(row.weeklySongs, dup!.id, canon.id);
    const nextO = patchSongIdsInJson(row.overallSongs, dup!.id, canon.id);
    if (JSON.stringify(nextW) !== JSON.stringify(row.weeklySongs) || JSON.stringify(nextO) !== JSON.stringify(row.overallSongs)) {
      await prisma.globalSnapshot.update({
        where: { id: row.id },
        data: { weeklySongs: nextW as object, overallSongs: nextO as object },
      });
    }
  }

  if (albums.length > 1) {
    const orphanAlbums = albums.filter((a) => a.spotifyId !== albumPrimary.spotifyId);
    for (const orphan of orphanAlbums) {
      await prisma.song.updateMany({
        where: { albumSpotifyId: orphan.spotifyId },
        data: { albumSpotifyId: albumPrimary.spotifyId },
      });
      await prisma.chartEntry.updateMany({
        where: { albumSpotifyId: orphan.spotifyId },
        data: { albumSpotifyId: albumPrimary.spotifyId },
      });
      const stillSongs = await prisma.song.count({ where: { albumSpotifyId: orphan.spotifyId } });
      const stillEntries = await prisma.chartEntry.count({ where: { albumSpotifyId: orphan.spotifyId } });
      if (stillSongs === 0 && stillEntries === 0) {
        await prisma.album.delete({ where: { id: orphan.id } });
        console.log("deleted_orphan_album_row", orphan.id, orphan.spotifyId);
      } else {
        console.error("orphan_album_still_referenced", orphan.id, { stillSongs, stillEntries });
        process.exit(1);
      }
    }
  }

  console.log("ok", canon.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

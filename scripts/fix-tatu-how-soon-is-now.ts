/**
 * Corrige "How Soon Is Now?" para a versão oficial de álbum da t.A.T.u.
 * e remapeia todas as entradas de paradas para a música canônica.
 *
 * Uso:
 *   npx tsx scripts/fix-tatu-how-soon-is-now.ts --dry-run
 *   npx tsx scripts/fix-tatu-how-soon-is-now.ts
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { getSpotifyTrackMetadataById, spotifyConfigured } from "../lib/spotify-server";

/**
 * Candidatos de Spotify para "How Soon Is Now?" da t.A.T.u.
 * O script escolhe automaticamente a melhor versão de álbum (evita best/deluxe/single/remix).
 */
const TARGET_TRACK_SPOTIFY_IDS = [
  "5QTyPmVpAZOWgBLhIBUbuJ",
  "0EzxyAj4zXXX0v7vNGHdIz",
  "1wS3gRK4Yryz0Vcvegifaj",
  "3n2YWlaNJCqe4B9VM1NJf9",
] as const;

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

function titleLooksLikeHowSoonIsNow(title: string): boolean {
  const t = normalize(title);
  return t.includes("how soon is now");
}

function artistLooksLikeTatu(artist: string): boolean {
  const a = normalize(artist);
  return a.includes("t a t u") || a.includes("tatu");
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  const metas = [];
  for (const sid of TARGET_TRACK_SPOTIFY_IDS) {
    const m = await getSpotifyTrackMetadataById(sid, "US");
    if (m) metas.push(m);
  }
  const meta =
    metas.find((m) => {
      const album = normalize(m.album.title ?? "");
      return (
        titleLooksLikeHowSoonIsNow(m.title) &&
        artistLooksLikeTatu(m.primaryArtist?.name ?? "") &&
        !album.includes("best") &&
        !album.includes("deluxe") &&
        !album.includes("single") &&
        !album.includes("remix") &&
        !album.includes("remaster")
      );
    }) ?? metas.find((m) => titleLooksLikeHowSoonIsNow(m.title) && artistLooksLikeTatu(m.primaryArtist?.name ?? ""));
  if (!meta?.primaryArtist?.name) {
    console.error("Falha ao obter metadados do Spotify para a faixa alvo.");
    process.exit(1);
  }
  if (!titleLooksLikeHowSoonIsNow(meta.title)) {
    console.error(`A faixa alvo não parece ser 'How Soon Is Now?': ${meta.title}`);
    process.exit(1);
  }
  if (!artistLooksLikeTatu(meta.primaryArtist.name)) {
    console.error(`A faixa alvo não parece ser da t.A.T.u.: ${meta.primaryArtist.name}`);
    process.exit(1);
  }

  const songs = await prisma.song.findMany({
    where: {
      OR: [
        { title: { contains: "How Soon Is Now", mode: "insensitive" } },
        { title: { contains: "How Soon Is Now?", mode: "insensitive" } },
        { spotifyId: { in: [...TARGET_TRACK_SPOTIFY_IDS] } },
      ],
    },
    select: { id: true, title: true, artist: true, spotifyId: true },
    orderBy: { id: "asc" },
  });

  if (!songs.length) {
    console.error("Nenhuma música candidata encontrada para 'How Soon Is Now?'.");
    process.exit(1);
  }

  const canonical =
    songs.find((s) => s.spotifyId === meta.spotifyId) ??
    songs.find((s) => titleLooksLikeHowSoonIsNow(s.title) && artistLooksLikeTatu(s.artist)) ??
    songs[0];

  console.log("canonical_before", canonical);
  console.log("candidates_total", songs.length, "dry_run", dryRun);

  const applied = await applySpotifyMetadataToSong(canonical.id, meta, dryRun);
  if (!applied.ok) {
    console.error("Falha ao aplicar metadados:", applied.reason);
    process.exit(1);
  }

  if (!dryRun) {
    await prisma.song.update({
      where: { id: canonical.id },
      data: {
        title: meta.title,
        artist: meta.primaryArtist.name,
        album: meta.album.title ?? undefined,
      },
    });
  }

  const sourceIds = songs.map((s) => s.id).filter((id) => id !== canonical.id);
  for (const sourceId of sourceIds) {
    if (dryRun) {
      const count = await prisma.chartEntry.count({ where: { songId: sourceId } });
      console.log("DRY remap", { fromSongId: sourceId, toSongId: canonical.id, entries: count });
      continue;
    }

    const moved = await prisma.chartEntry.updateMany({
      where: { songId: sourceId },
      data: {
        songId: canonical.id,
        songSpotifyId: meta.spotifyId,
        albumSpotifyId: meta.album.spotifyId ?? null,
      },
    });
    console.log("remapped_entries", { fromSongId: sourceId, toSongId: canonical.id, count: moved.count });

    const refs = await prisma.chartEntry.count({ where: { songId: sourceId } });
    if (refs === 0) {
      await prisma.song.delete({ where: { id: sourceId } });
      console.log("deleted_duplicate_song", sourceId);
    }
  }

  console.log(dryRun ? "dry_run_ok" : "updated_ok", {
    songId: canonical.id,
    spotifyId: meta.spotifyId,
    albumSpotifyId: meta.album.spotifyId,
    title: meta.title,
    artist: meta.primaryArtist.name,
    album: meta.album.title,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());


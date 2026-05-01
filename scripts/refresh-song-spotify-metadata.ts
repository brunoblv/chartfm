/**
 * Atualiza na tabela `Song` tudo o que a Web API do Spotify pode preencher quando a linha
 * tem `spotify_id` e ainda há colunas opcionais vazias (null ou string vazia).
 *
 * Colunas consideradas: `album`, `cover_image_url`, `artist_spotify_id`, `album_spotify_id`,
 * `duration_ms`, `spotify_url`, `track_number` e, opcionalmente, `preview_url` (ver abaixo).
 * `exhibition_name` não existe na resposta de faixa do Spotify — não é preenchida aqui.
 *
 * Para músicas **sem** `spotify_id`, use:
 *   npx tsx scripts/backfill-song-spotify.ts
 *
 * Uso (na raiz do projeto):
 *   npx tsx scripts/refresh-song-spotify-metadata.ts --dry-run
 *   npx tsx scripts/refresh-song-spotify-metadata.ts --limit=20
 *   npx tsx scripts/refresh-song-spotify-metadata.ts --delay-ms=200 --market=BR
 *   npx tsx scripts/refresh-song-spotify-metadata.ts --include-preview   # também fila `preview_url` vazia
 *   npx tsx scripts/refresh-song-spotify-metadata.ts --force
 *
 * Requer .env: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, DATABASE_URL.
 */

import type { Prisma } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { prisma } from "../lib/prisma";
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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const force = argv.includes("--force");
  const limitArg = argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Math.max(1, parseInt(limitArg.split("=")[1] ?? "100", 10) || 100) : 500;
  const offsetArg = argv.find((a) => a.startsWith("--offset="));
  const offset = offsetArg ? Math.max(0, parseInt(offsetArg.split("=")[1] ?? "0", 10) || 0) : 0;
  const delayArg = argv.find((a) => a.startsWith("--delay-ms="));
  const delayMs = delayArg ? Math.max(0, parseInt(delayArg.split("=")[1] ?? "120", 10) || 120) : 120;
  const marketArg = argv.find((a) => a.startsWith("--market="));
  const market = (marketArg?.split("=")[1] ?? "BR").trim().toUpperCase() || "BR";
  const includePreview = argv.includes("--include-preview");
  return { dryRun, force, limit, offset, delayMs, market, includePreview };
}

/** Qualquer coluna opcional preenchível pelo Spotify vazia (null ou ""). */
function incompleteWhere(force: boolean, includePreview: boolean): Prisma.SongWhereInput {
  if (force) {
    return { spotifyId: { not: null } };
  }
  const previewOr: Prisma.SongWhereInput[] = includePreview
    ? [{ previewUrl: null }, { previewUrl: "" }]
    : [];
  return {
    spotifyId: { not: null },
    OR: [
      { album: null },
      { album: "" },
      { coverImageUrl: null },
      { coverImageUrl: "" },
      { artistSpotifyId: null },
      { albumSpotifyId: null },
      { durationMs: null },
      { spotifyUrl: null },
      { trackNumber: null },
      ...previewOr,
    ],
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const { dryRun, force, limit, offset, delayMs, market, includePreview } = parseArgs(argv);

  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  const songs = await prisma.song.findMany({
    where: incompleteWhere(force, includePreview),
    select: {
      id: true,
      title: true,
      artist: true,
      album: true,
      spotifyId: true,
      coverImageUrl: true,
      artistSpotifyId: true,
      albumSpotifyId: true,
      durationMs: true,
      previewUrl: true,
      spotifyUrl: true,
      trackNumber: true,
    },
    orderBy: { id: "asc" },
    skip: offset,
    take: limit,
  });

  const candidates = songs.filter((s) => (s.spotifyId ?? "").trim().length > 0);

  console.log(
    JSON.stringify({
      candidatas: candidates.length,
      offset,
      limit,
      delay_ms: delayMs,
      market,
      dry_run: dryRun,
      force,
      include_preview: includePreview,
    }),
  );

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const s of candidates) {
    const trackId = s.spotifyId!.trim();
    const meta = await getSpotifyTrackMetadataById(trackId, market);
    if (!meta) {
      console.log(`SKIP no_meta ${trackId} "${s.title}" — ${s.artist}`);
      skip += 1;
      await sleep(delayMs);
      continue;
    }

    const res = await applySpotifyMetadataToSong(s.id, meta, dryRun);
    if (!res.ok) {
      console.log(`FAIL "${s.title}" — ${s.artist} :: ${"reason" in res ? res.reason : ""}`);
      fail += 1;
    } else if (res.reason === "dry_run") {
      console.log(`DRY  "${s.title}" — ${s.artist} <- ${meta.spotifyId}`);
      ok += 1;
    } else {
      console.log(`OK   "${s.title}" — ${s.artist} <- ${meta.spotifyId}`);
      ok += 1;
    }

    await sleep(delayMs);
  }

  console.log(JSON.stringify({ ok, skip, fail, dryRun }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

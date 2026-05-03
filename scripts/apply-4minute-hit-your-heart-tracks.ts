/**
 * Atualiza músicas locais da 4Minute usando as faixas oficiais do álbum Spotify
 * "Hit Your Heart" (album id 3R6w17dhza37WcyMnVXAgH).
 *
 * Por defeito: "Huh" e "I My Me Mine".
 *
 * Uso:
 *   npx tsx scripts/apply-4minute-hit-your-heart-tracks.ts --dry-run
 *   npx tsx scripts/apply-4minute-hit-your-heart-tracks.ts --apply
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { applySpotifyMetadataToSong } from "../lib/apply-spotify-metadata-to-song";
import { prisma } from "../lib/prisma";
import { getSpotifyTrackMetadataById, listSpotifyAlbumTracks, spotifyConfigured } from "../lib/spotify-server";

const ALBUM_SPOTIFY_ID = "3R6w17dhza37WcyMnVXAgH";
/** Títulos no Spotify (lista do álbum) — case-insensitive bate contra a API. */
const DEFAULT_SPOTIFY_TITLES = ["Huh", "I My Me Mine"];
const MARKET = "KR";
const DELAY_MS = 700;

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

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function normTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function artistWhere4Minute(): Prisma.SongWhereInput {
  return {
    OR: [
      { artist: { contains: "4minute", mode: Prisma.QueryMode.insensitive } },
      { artist: { equals: "4Minute", mode: Prisma.QueryMode.insensitive } },
      { artist: { startsWith: "4Minute", mode: Prisma.QueryMode.insensitive } },
    ],
  };
}

async function findLocalSongForSpotifyTrack(spotifyTrackTitle: string) {
  const n = normTitle(spotifyTrackTitle);
  const candidates = await prisma.song.findMany({
    where: {
      AND: [artistWhere4Minute()],
    },
    select: {
      id: true,
      title: true,
      artist: true,
      spotifyId: true,
    },
  });

  const exact = candidates.filter((s) => normTitle(s.title) === n);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return exact.sort((a, b) => a.id.localeCompare(b.id))[0];

  let best = null as (typeof candidates)[0] | null;
  let bestScore = -1;
  for (const s of candidates) {
    const nt = normTitle(s.title);
    let sc = 0;
    if (nt.includes(n) || n.includes(nt)) sc = 50;
    if (Math.abs(nt.length - n.length) <= 2 && (nt.startsWith(n.slice(0, 4)) || n.startsWith(nt.slice(0, 4))))
      sc += 20;
    if (sc > bestScore) {
      bestScore = sc;
      best = s;
    }
  }
  if (bestScore >= 50) return best;
  return null;
}

function parseTitlesArg(): string[] {
  const a = process.argv.find((x) => x.startsWith("--titles="));
  if (!a) return DEFAULT_SPOTIFY_TITLES;
  const raw = a.slice("--titles=".length).trim();
  if (!raw) return DEFAULT_SPOTIFY_TITLES;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");
  if ((!dryRun && !apply) || (dryRun && apply)) {
    console.error("Use exatamente um de: --dry-run | --apply");
    process.exit(1);
  }

  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  const wantTitles = parseTitlesArg();
  const albumTracks = await listSpotifyAlbumTracks(ALBUM_SPOTIFY_ID, MARKET);
  await sleep(DELAY_MS);

  const byNorm = new Map<string, { spotifyId: string; title: string }>();
  for (const t of albumTracks) {
    byNorm.set(normTitle(t.title), t);
  }

  const paired: { spotify: { spotifyId: string; title: string }; local: { id: string; title: string; artist: string } | null }[] =
    [];

  for (const want of wantTitles) {
    const key = normTitle(want);
    const sp = byNorm.get(key);
    if (!sp) {
      console.error(`Faixa não encontrada no álbum Spotify: "${want}". Faixas:`, albumTracks.map((x) => x.title));
      process.exit(1);
    }
    const local = await findLocalSongForSpotifyTrack(sp.title);
    paired.push({ spotify: sp, local });
  }

  console.log(JSON.stringify({ album: ALBUM_SPOTIFY_ID, paired, dryRun }, null, 2));

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const { spotify: sp, local } of paired) {
    if (!local) {
      console.log(`SKIP sem_song_local spotify="${sp.title}" (${sp.spotifyId})`);
      skip += 1;
      continue;
    }

    const meta = await getSpotifyTrackMetadataById(sp.spotifyId, MARKET);
    await sleep(DELAY_MS);
    if (!meta) {
      console.log(`FAIL no_meta tid=${sp.spotifyId} local="${local.title}"`);
      fail += 1;
      continue;
    }

    const res = await applySpotifyMetadataToSong(local.id, meta, dryRun);
    if (!res.ok) {
      console.log(`FAIL "${local.title}" :: ${res.reason}`);
      fail += 1;
    } else {
      console.log(
        dryRun
          ? `DRY  "${local.title}" (${local.artist}) -> ${meta.spotifyId} (${meta.title})`
          : `OK   "${local.title}" (${local.artist}) -> ${meta.spotifyId}`,
      );
      ok += 1;
    }
    await sleep(DELAY_MS);
  }

  console.log(JSON.stringify({ ok, skip, fail, dryRun }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

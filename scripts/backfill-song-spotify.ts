/**
 * Preenche Spotify (track id, artist id, album id, URLs, etc.) em músicas sem spotify_id.
 *
 * Uso (na raiz do chartify):
 *   npx tsx scripts/backfill-song-spotify.ts
 *   npx tsx scripts/backfill-song-spotify.ts --dry-run
 *   npx tsx scripts/backfill-song-spotify.ts --limit=30
 *
 * Requer .env com SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET e DATABASE_URL.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import {
  getSpotifyArtistById,
  getSpotifyTrackMetadataById,
  searchSpotifyTracks,
  spotifyConfigured,
  type SpotifyTrackMetadata,
} from "../lib/spotify-server";

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

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeQueryPart(s: string): string {
  return s.replace(/"/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function pickBestTrackId(
  wantTitle: string,
  wantArtist: string,
  hits: { spotifyId: string; title: string; artist: string }[],
): string | null {
  if (!hits.length) return null;
  const wt = normalizeKey(wantTitle);
  const wa = normalizeKey(wantArtist.split(",")[0] ?? wantArtist).split(" feat ")[0] ?? "";
  let bestId: string | null = null;
  let bestScore = -1;
  for (const h of hits) {
    const ct = normalizeKey(h.title);
    const ca = normalizeKey(h.artist.split(",")[0] ?? h.artist);
    let s = 0;
    if (ct === wt) s += 100;
    else if (ct.includes(wt) || wt.includes(ct)) s += 55;
    if (ca === wa) s += 90;
    else if (ca.includes(wa) || wa.includes(ca)) s += 45;
    if (s > bestScore) {
      bestScore = s;
      bestId = h.spotifyId;
    }
  }
  if (bestScore < 35) return hits[0]?.spotifyId ?? null;
  return bestId;
}

async function searchTrackCandidates(title: string, artist: string, markets: string[]) {
  const mainArtist = artist.split(",")[0]?.trim().split(/\s+feat\.?\s+/i)[0]?.trim() ?? artist;
  const queries = [
    `track:"${sanitizeQueryPart(title)}" artist:"${sanitizeQueryPart(mainArtist)}"`,
    `${sanitizeQueryPart(title)} ${sanitizeQueryPart(mainArtist)}`,
    `${sanitizeQueryPart(title)} ${sanitizeQueryPart(artist)}`,
  ];
  for (const market of markets) {
    for (const q of queries) {
      const hits = await searchSpotifyTracks(q, 8, market);
      if (hits.length) return { hits, market } as const;
    }
  }
  return { hits: [] as { spotifyId: string; title: string; artist: string }[], market: "BR" } as const;
}

async function applyMetadata(localSongId: string, meta: SpotifyTrackMetadata, dryRun: boolean) {
  const primaryArtist = meta.primaryArtist;
  const albumSpotifyId = meta.album.spotifyId;

  const owner = await prisma.song.findUnique({
    where: { id: localSongId },
    select: { id: true, title: true, artist: true, album: true },
  });
  if (!owner) return { ok: false as const, reason: "song_missing" };

  const taken = await prisma.song.findFirst({
    where: { spotifyId: meta.spotifyId, NOT: { id: localSongId } },
    select: { id: true },
  });
  if (taken) return { ok: false as const, reason: `spotify_id_conflict:${taken.id}` };

  if (dryRun) return { ok: true as const, reason: "dry_run" };

  async function upsertArtist(spotifyId: string, fallbackName: string) {
    const profile = await getSpotifyArtistById(spotifyId);
    await prisma.artist.upsert({
      where: { spotifyId },
      update: {
        name: profile?.name ?? fallbackName,
        genres: profile?.genres ?? [],
        spotifyUrl: profile?.spotifyUrl ?? undefined,
        ...(profile?.imageUrl ? { imageUrl: profile.imageUrl } : {}),
      },
      create: {
        spotifyId,
        name: profile?.name ?? fallbackName,
        genres: profile?.genres ?? [],
        spotifyUrl: profile?.spotifyUrl ?? null,
        imageUrl: profile?.imageUrl ?? null,
      },
    });
  }

  if (primaryArtist) await upsertArtist(primaryArtist.spotifyId, primaryArtist.name);

  if (primaryArtist && albumSpotifyId) {
    await prisma.album.upsert({
      where: { spotifyId: albumSpotifyId },
      update: {
        title: meta.album.title ?? undefined,
        artistSpotifyId: primaryArtist.spotifyId,
        albumType: meta.album.albumType ?? undefined,
        releaseDate: meta.album.releaseDate ?? undefined,
        coverUrl: meta.album.coverUrl ?? undefined,
        spotifyUrl: meta.album.spotifyUrl ?? undefined,
        totalTracks: meta.album.totalTracks ?? undefined,
      },
      create: {
        spotifyId: albumSpotifyId,
        title: meta.album.title ?? "Álbum",
        artistSpotifyId: primaryArtist.spotifyId,
        albumType: meta.album.albumType ?? undefined,
        releaseDate: meta.album.releaseDate ?? null,
        coverUrl: meta.album.coverUrl ?? null,
        spotifyUrl: meta.album.spotifyUrl ?? null,
        totalTracks: meta.album.totalTracks ?? null,
      },
    });
  }

  await prisma.song.update({
    where: { id: localSongId },
    data: {
      spotifyId: meta.spotifyId,
      artistSpotifyId: primaryArtist?.spotifyId ?? null,
      albumSpotifyId: albumSpotifyId ?? null,
      album: owner.album ?? meta.album.title ?? undefined,
      durationMs: meta.durationMs ?? undefined,
      previewUrl: meta.previewUrl ?? undefined,
      spotifyUrl: meta.spotifyUrl ?? undefined,
      trackNumber: meta.trackNumber ?? undefined,
    },
  });

  await prisma.chartEntry.updateMany({
    where: { songId: localSongId },
    data: {
      songSpotifyId: meta.spotifyId,
      albumSpotifyId: albumSpotifyId ?? null,
    },
  });

  if (meta.spotifyId) {
    const featured = meta.featuredArtists ?? [];
    const featIds = new Set<string>();
    for (const feat of featured) {
      featIds.add(feat.spotifyId);
      await upsertArtist(feat.spotifyId, feat.name);
      await prisma.songFeat.upsert({
        where: {
          songSpotifyId_artistSpotifyId: {
            songSpotifyId: meta.spotifyId,
            artistSpotifyId: feat.spotifyId,
          },
        },
        update: {},
        create: {
          songSpotifyId: meta.spotifyId,
          artistSpotifyId: feat.spotifyId,
        },
      });
    }
    await prisma.songFeat.deleteMany({
      where: {
        songSpotifyId: meta.spotifyId,
        ...(featIds.size ? { artistSpotifyId: { notIn: [...featIds] } } : {}),
      },
    });
  }

  return { ok: true as const, reason: "updated" };
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const limitArg = argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Math.max(1, parseInt(limitArg.split("=")[1] ?? "50", 10) || 50) : 500;

  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  const songs = await prisma.song.findMany({
    where: { spotifyId: null },
    select: { id: true, title: true, artist: true, album: true },
    orderBy: { id: "asc" },
    take: limit,
  });

  console.log(`candidatas=${songs.length} dry_run=${dryRun}`);
  let ok = 0;
  let skip = 0;
  let fail = 0;

  const markets = ["BR", "JP"];

  for (const s of songs) {
    const { hits, market } = await searchTrackCandidates(s.title, s.artist, markets);
    const trackId = pickBestTrackId(s.title, s.artist, hits);
    if (!trackId) {
      console.log(`SKIP no_hit "${s.title}" — ${s.artist}`);
      skip += 1;
      await sleep(120);
      continue;
    }

    const meta = await getSpotifyTrackMetadataById(trackId, market);
    if (!meta) {
      console.log(`SKIP no_meta ${trackId} "${s.title}"`);
      skip += 1;
      await sleep(120);
      continue;
    }

    const res = await applyMetadata(s.id, meta, dryRun);
    if (!res.ok) {
      console.log(`FAIL "${s.title}" — ${s.artist} :: ${"reason" in res ? res.reason : ""}`);
      fail += 1;
    } else if (res.reason === "dry_run") {
      console.log(`DRY  "${s.title}" — ${s.artist} -> ${meta.spotifyId} (${meta.title})`);
      ok += 1;
    } else {
      console.log(`OK   "${s.title}" — ${s.artist} -> ${meta.spotifyId}`);
      ok += 1;
    }
    await sleep(180);
  }

  console.log(JSON.stringify({ ok, skip, fail, dryRun }));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

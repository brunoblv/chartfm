/**
 * Lista faixas do Spotify para um artista (álbuns + top tracks), com pausa entre
 * chamadas à API (mesmo padrão de `backfill-oh-my-girl-albums-from-spotify.ts`).
 *
 * Uso:
 *   npx tsx scripts/list-spotify-artist-tracks.ts --artist-id=73RRzEpK7IQexOhC0CuTRZ
 *   npx tsx scripts/list-spotify-artist-tracks.ts --artist-id=... --delay-ms=900 --market=KR --out=scripts/_artist_tracks.json
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  getSpotifyArtistById,
  getSpotifyArtistTopTracks,
  listSpotifyAlbumTracks,
  listSpotifyArtistAlbums,
  mapTrackToResult,
  spotifyConfigured,
} from "../lib/spotify-server";

const DEFAULT_ARTIST_ID = "73RRzEpK7IQexOhC0CuTRZ"; // Jun Hyo Seong (Hyoseong)
const DEFAULT_DELAY_MS = 900;
const DEFAULT_MARKET = "KR";

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

function parseArg(flag: string, def: string | null): string | null {
  const nf = flag.replace(/^--/, "");
  const a = process.argv.find((x) => x.startsWith(`--${nf}=`));
  if (!a) return def;
  const eq = a.indexOf("=");
  return eq > 0 ? a.slice(eq + 1).trim() || def : def;
}

function parseIntArg(flag: string, def: number): number {
  const v = parseArg(flag, String(def));
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : def;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function afterSpotify(delayMs: number) {
  await sleep(delayMs);
}

type TrackRow = ReturnType<typeof mapTrackToResult> & {
  source: "top" | "album";
  albumRef?: { spotifyId: string; name: string; albumType: string | null; releaseDate: string | null };
};

async function main() {
  const artistId = parseArg("artist-id", DEFAULT_ARTIST_ID)?.trim() || DEFAULT_ARTIST_ID;
  const delayMs = parseIntArg("delay-ms", DEFAULT_DELAY_MS);
  const market = parseArg("market", DEFAULT_MARKET)?.trim() || DEFAULT_MARKET;
  const outPath = parseArg("out", null);

  if (!spotifyConfigured()) {
    console.error("Defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env");
    process.exit(1);
  }

  const profile = await getSpotifyArtistById(artistId);
  await afterSpotify(delayMs);
  if (!profile) {
    console.error("Artista não encontrado:", artistId);
    process.exit(1);
  }

  console.log("Artista:", profile.name, `(${profile.spotifyId})`);

  const byTrackId = new Map<string, TrackRow>();

  const topMarkets = [market, "US", "BR"].filter((m, i, a) => a.indexOf(m) === i);
  for (const m of topMarkets) {
    const rawTop = await getSpotifyArtistTopTracks(artistId, m);
    await afterSpotify(delayMs);
    for (const t of rawTop) {
      const row: TrackRow = { ...mapTrackToResult(t), source: "top" };
      if (!byTrackId.has(t.id)) byTrackId.set(t.id, row);
    }
  }

  const albums = await listSpotifyArtistAlbums(artistId, market);
  await afterSpotify(delayMs);

  const seenAlbumIds = new Set<string>();
  for (const al of albums) {
    if (seenAlbumIds.has(al.spotifyId)) continue;
    seenAlbumIds.add(al.spotifyId);

    const tracks = await listSpotifyAlbumTracks(al.spotifyId, market);
    await afterSpotify(delayMs);

    for (const tr of tracks) {
      const existing = byTrackId.get(tr.spotifyId);
      if (existing) {
        if (!existing.albumRef) {
          existing.albumRef = {
            spotifyId: al.spotifyId,
            name: al.name,
            albumType: al.albumType,
            releaseDate: al.releaseDate,
          };
        }
        continue;
      }
      byTrackId.set(tr.spotifyId, {
        spotifyId: tr.spotifyId,
        title: tr.title,
        artist: profile.name,
        album: al.name,
        imageUrl: null,
        previewUrl: null,
        externalUrl: `https://open.spotify.com/track/${tr.spotifyId}`,
        source: "album",
        albumRef: {
          spotifyId: al.spotifyId,
          name: al.name,
          albumType: al.albumType,
          releaseDate: al.releaseDate,
        },
      });
    }
  }

  const tracks = [...byTrackId.values()].sort((a, b) =>
    a.title.localeCompare(b.title, "en", { sensitivity: "base" }),
  );

  const payload = {
    artist: profile,
    market,
    delayMs,
    trackCount: tracks.length,
    tracks,
  };

  console.log("Total de faixas (deduplicadas por spotifyId):", tracks.length);
  if (outPath) {
    writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
    console.log("Gravado:", outPath);
  } else {
    console.log(JSON.stringify(payload, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

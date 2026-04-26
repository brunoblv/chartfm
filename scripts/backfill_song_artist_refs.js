const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const AUTH_URL = "https://accounts.spotify.com/api/token";
const SEARCH_URL = "https://api.spotify.com/v1/search";
const ARTIST_URL = "https://api.spotify.com/v1/artists";

let tokenState = { token: null, expiresAt: 0 };

async function getSpotifyToken() {
  if (tokenState.token && Date.now() < tokenState.expiresAt) return tokenState.token;
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) return null;
  const json = await res.json();
  tokenState = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in - 60) * 1000,
  };
  return tokenState.token;
}

async function spotifySearchArtist(name) {
  const token = await getSpotifyToken();
  if (!token) return null;
  const u = new URL(SEARCH_URL);
  u.searchParams.set("q", name.trim());
  u.searchParams.set("type", "artist");
  u.searchParams.set("limit", "1");
  u.searchParams.set("market", "BR");
  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const a = json?.artists?.items?.[0];
  if (!a?.id || !a?.name) return null;
  const image = Array.isArray(a.images) && a.images.length ? a.images[0].url : null;
  return {
    spotifyId: a.id,
    name: a.name,
    imageUrl: image,
    spotifyUrl: a.external_urls?.spotify ?? null,
  };
}

async function spotifyArtistById(spotifyId) {
  const token = await getSpotifyToken();
  if (!token) return null;
  const res = await fetch(`${ARTIST_URL}/${encodeURIComponent(spotifyId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const a = await res.json();
  const image = Array.isArray(a.images) && a.images.length ? a.images[0].url : null;
  return {
    spotifyId: a.id,
    name: a.name,
    imageUrl: image,
    spotifyUrl: a.external_urls?.spotify ?? null,
  };
}

async function main() {
  loadEnvFile();
  const prisma = new PrismaClient();

  const stats = {
    songArtistsMissingRef: 0,
    songArtistsLinked: 0,
    artistRowsUpserted: 0,
    artistRowsRecoveredById: 0,
    artistRowsRecoveredFromFeats: 0,
    artistsSearchMiss: 0,
  };

  const searchCache = new Map();
  const seenUpserts = new Set();

  try {
    const distinctArtists = await prisma.song.findMany({
      where: { artistSpotifyId: null },
      select: { artist: true },
      distinct: ["artist"],
      orderBy: { artist: "asc" },
    });
    stats.songArtistsMissingRef = distinctArtists.length;

    for (const row of distinctArtists) {
      const artistName = row.artist?.trim();
      if (!artistName) continue;
      const cacheKey = artistName.toLowerCase();
      let result = searchCache.get(cacheKey);
      if (result === undefined) {
        result = await spotifySearchArtist(artistName);
        searchCache.set(cacheKey, result ?? null);
      }
      if (!result) {
        stats.artistsSearchMiss += 1;
        continue;
      }
      if (!seenUpserts.has(result.spotifyId)) {
        await prisma.artist.upsert({
          where: { spotifyId: result.spotifyId },
          update: {
            name: result.name,
            spotifyUrl: result.spotifyUrl ?? undefined,
            ...(result.imageUrl ? { imageUrl: result.imageUrl } : {}),
          },
          create: {
            spotifyId: result.spotifyId,
            name: result.name,
            spotifyUrl: result.spotifyUrl,
            imageUrl: result.imageUrl,
          },
        });
        seenUpserts.add(result.spotifyId);
        stats.artistRowsUpserted += 1;
      }
      const update = await prisma.song.updateMany({
        where: { artist: artistName, artistSpotifyId: null },
        data: { artistSpotifyId: result.spotifyId },
      });
      stats.songArtistsLinked += update.count;
    }

    const [songArtistSids, featArtistSids, existingArtists] = await Promise.all([
      prisma.song.findMany({
        where: { artistSpotifyId: { not: null } },
        select: { artistSpotifyId: true },
        distinct: ["artistSpotifyId"],
      }),
      prisma.songFeat.findMany({
        select: { artistSpotifyId: true },
        distinct: ["artistSpotifyId"],
      }),
      prisma.artist.findMany({ select: { spotifyId: true } }),
    ]);

    const existingSet = new Set(existingArtists.map((a) => a.spotifyId));
    const allReferenced = new Set([
      ...songArtistSids.map((r) => r.artistSpotifyId).filter(Boolean),
      ...featArtistSids.map((r) => r.artistSpotifyId).filter(Boolean),
    ]);

    for (const sid of allReferenced) {
      if (existingSet.has(sid)) continue;
      const profile = await spotifyArtistById(sid);
      if (!profile) continue;
      await prisma.artist.upsert({
        where: { spotifyId: profile.spotifyId },
        update: {
          name: profile.name,
          spotifyUrl: profile.spotifyUrl ?? undefined,
          ...(profile.imageUrl ? { imageUrl: profile.imageUrl } : {}),
        },
        create: {
          spotifyId: profile.spotifyId,
          name: profile.name,
          spotifyUrl: profile.spotifyUrl,
          imageUrl: profile.imageUrl,
        },
      });
      existingSet.add(profile.spotifyId);
      stats.artistRowsRecoveredById += 1;
    }

    const featOnlyRows = await prisma.songFeat.findMany({
      include: { artist: { select: { spotifyId: true } } },
    });
    stats.artistRowsRecoveredFromFeats = new Set(featOnlyRows.map((r) => r.artist.spotifyId)).size;

    const [finalArtists, songsWithRef] = await Promise.all([
      prisma.artist.count(),
      prisma.song.count({ where: { artistSpotifyId: { not: null } } }),
    ]);

    console.log(
      JSON.stringify(
        {
          ok: true,
          stats,
          finalArtists,
          songsWithArtistReference: songsWithRef,
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

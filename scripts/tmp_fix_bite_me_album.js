const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const TRACK_TITLE = "Bite Me";
const ARTIST_NAME = "Avril Lavigne";
const TARGET_ALBUM = "Love Sux";

async function spotifyToken() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("SPOTIFY_CLIENT_ID/SECRET ausentes");
  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Token Spotify falhou: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function spotifyTrackMeta(trackId) {
  const token = await spotifyToken();
  const res = await fetch(`https://api.spotify.com/v1/tracks/${encodeURIComponent(trackId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Track Spotify falhou: ${res.status}`);
  const data = await res.json();
  const primary = Array.isArray(data.artists) && data.artists[0] ? data.artists[0] : null;
  return {
    albumId: data?.album?.id || null,
    albumTitle: data?.album?.name || TARGET_ALBUM,
    albumCover:
      Array.isArray(data?.album?.images) && data.album.images[0]
        ? data.album.images[0].url || null
        : null,
    artistSpotifyId: primary?.id || null,
  };
}

async function spotifySearchTrack(title, artist) {
  const token = await spotifyToken();
  const q = encodeURIComponent(`track:${title} artist:${artist}`);
  const res = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=track&limit=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const items = data?.tracks?.items ?? [];
  const hit = items[0];
  if (!hit) return null;
  const primary = Array.isArray(hit.artists) && hit.artists[0] ? hit.artists[0] : null;
  return {
    trackId: hit.id ?? null,
    albumId: hit.album?.id ?? null,
    albumCover:
      Array.isArray(hit.album?.images) && hit.album.images[0]
        ? hit.album.images[0].url || null
        : null,
    artistSpotifyId: primary?.id || null,
  };
}

async function main() {
  const songs = await prisma.song.findMany({
    where: {
      title: { equals: TRACK_TITLE, mode: "insensitive" },
      artist: { contains: ARTIST_NAME, mode: "insensitive" },
    },
    select: {
      id: true,
      title: true,
      artist: true,
      spotifyId: true,
      artistSpotifyId: true,
      albumSpotifyId: true,
    },
  });
  if (!songs.length) throw new Error("Música não encontrada.");

  const base = songs[0];
  let albumSpotifyId = base.albumSpotifyId ?? null;
  let artistSpotifyId = base.artistSpotifyId ?? null;
  let albumCover = null;

  if (base.spotifyId) {
    const meta = await spotifyTrackMeta(base.spotifyId);
    albumSpotifyId = albumSpotifyId ?? meta.albumId;
    artistSpotifyId = artistSpotifyId ?? meta.artistSpotifyId;
    albumCover = meta.albumCover;
  }

  if (!albumSpotifyId || !artistSpotifyId) {
    const fallback = await spotifySearchTrack(TRACK_TITLE, ARTIST_NAME);
    albumSpotifyId = albumSpotifyId ?? fallback?.albumId ?? null;
    artistSpotifyId = artistSpotifyId ?? fallback?.artistSpotifyId ?? null;
    albumCover = albumCover ?? fallback?.albumCover ?? null;
  }

  if (!albumSpotifyId || !artistSpotifyId) {
    const dbAlbum = await prisma.album.findFirst({
      where: { title: { contains: "Love Sux", mode: "insensitive" } },
      select: { spotifyId: true, artistSpotifyId: true, coverUrl: true },
    });
    albumSpotifyId = albumSpotifyId ?? dbAlbum?.spotifyId ?? null;
    artistSpotifyId = artistSpotifyId ?? dbAlbum?.artistSpotifyId ?? null;
    albumCover = albumCover ?? dbAlbum?.coverUrl ?? null;
  }

  if (!albumSpotifyId || !artistSpotifyId) {
    throw new Error("Não foi possível resolver albumSpotifyId/artistSpotifyId.");
  }

  await prisma.artist.upsert({
    where: { spotifyId: artistSpotifyId },
    update: { name: ARTIST_NAME },
    create: { spotifyId: artistSpotifyId, name: ARTIST_NAME },
  });

  const album = await prisma.album.upsert({
    where: { spotifyId: albumSpotifyId },
    update: {
      title: TARGET_ALBUM,
      artistSpotifyId,
      ...(albumCover ? { coverUrl: albumCover } : {}),
    },
    create: {
      spotifyId: albumSpotifyId,
      title: TARGET_ALBUM,
      artistSpotifyId,
      coverUrl: albumCover,
    },
    select: { id: true, title: true, spotifyId: true, coverUrl: true },
  });

  const ids = songs.map((s) => s.id);
  await prisma.song.updateMany({
    where: { id: { in: ids } },
    data: {
      album: TARGET_ALBUM,
      albumSpotifyId,
      artistSpotifyId,
    },
  });

  const updatedSongs = await prisma.song.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      title: true,
      artist: true,
      album: true,
      albumSpotifyId: true,
      albumRef: { select: { id: true, title: true, spotifyId: true, coverUrl: true } },
    },
  });

  console.log(JSON.stringify({ album, updatedSongs }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

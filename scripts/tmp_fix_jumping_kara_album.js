const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const CURRENT_TITLE = "Jumping";
const ARTIST_NAME = "Kara";
const SPOTIFY_ALBUM_ID = "2qBs9GPXk8C28SXX2FOzh1";

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
  return (await res.json()).access_token;
}

async function fetchAlbumMeta(albumId) {
  const token = await spotifyToken();
  const res = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Album Spotify falhou: ${res.status}`);
  const data = await res.json();
  const primary = data.artists?.[0] ?? null;
  return {
    title: data.name,
    artistSpotifyId: primary?.id ?? null,
    artistName: primary?.name ?? ARTIST_NAME,
    coverUrl: data.images?.[0]?.url ?? null,
    releaseDate: data.release_date ? new Date(data.release_date) : null,
    albumType: data.album_type?.toUpperCase() ?? null,
    totalTracks: data.total_tracks ?? null,
    spotifyUrl: data.external_urls?.spotify ?? null,
  };
}

async function main() {
  const meta = await fetchAlbumMeta(SPOTIFY_ALBUM_ID);
  console.log("Metadata do Spotify:", meta);

  if (!meta.artistSpotifyId) throw new Error("Artista não encontrado no Spotify.");

  await prisma.artist.upsert({
    where: { spotifyId: meta.artistSpotifyId },
    update: { name: meta.artistName },
    create: { spotifyId: meta.artistSpotifyId, name: meta.artistName },
  });

  // Busca o álbum atual (pelo título e artista, podendo ter spotifyId manual)
  const existing = await prisma.album.findFirst({
    where: {
      title: { contains: CURRENT_TITLE, mode: "insensitive" },
      artist: { name: { contains: ARTIST_NAME, mode: "insensitive" } },
    },
    select: { id: true, spotifyId: true },
  });

  let album;

  if (existing) {
    // Se o spotifyId atual é diferente do novo, precisamos trocar (spotifyId é unique)
    if (existing.spotifyId !== SPOTIFY_ALBUM_ID) {
      // Atualiza songs que apontam para o antigo spotifyId
      await prisma.song.updateMany({
        where: { albumSpotifyId: existing.spotifyId },
        data: { albumSpotifyId: SPOTIFY_ALBUM_ID },
      });

      album = await prisma.album.update({
        where: { id: existing.id },
        data: {
          spotifyId: SPOTIFY_ALBUM_ID,
          title: meta.title,
          artistSpotifyId: meta.artistSpotifyId,
          coverUrl: meta.coverUrl,
          releaseDate: meta.releaseDate,
          albumType: meta.albumType,
          totalTracks: meta.totalTracks,
          spotifyUrl: meta.spotifyUrl,
        },
        select: { id: true, title: true, spotifyId: true, coverUrl: true },
      });
    } else {
      album = await prisma.album.update({
        where: { id: existing.id },
        data: {
          title: meta.title,
          artistSpotifyId: meta.artistSpotifyId,
          coverUrl: meta.coverUrl,
          releaseDate: meta.releaseDate,
          albumType: meta.albumType,
          totalTracks: meta.totalTracks,
          spotifyUrl: meta.spotifyUrl,
        },
        select: { id: true, title: true, spotifyId: true, coverUrl: true },
      });
    }
  } else {
    album = await prisma.album.upsert({
      where: { spotifyId: SPOTIFY_ALBUM_ID },
      update: {
        title: meta.title,
        artistSpotifyId: meta.artistSpotifyId,
        coverUrl: meta.coverUrl,
        releaseDate: meta.releaseDate,
        albumType: meta.albumType,
        totalTracks: meta.totalTracks,
        spotifyUrl: meta.spotifyUrl,
      },
      create: {
        spotifyId: SPOTIFY_ALBUM_ID,
        title: meta.title,
        artistSpotifyId: meta.artistSpotifyId,
        coverUrl: meta.coverUrl,
        releaseDate: meta.releaseDate,
        albumType: meta.albumType,
        totalTracks: meta.totalTracks,
        spotifyUrl: meta.spotifyUrl,
      },
      select: { id: true, title: true, spotifyId: true, coverUrl: true },
    });
  }

  // Atualiza songs vinculadas ao novo spotifyId
  await prisma.song.updateMany({
    where: { albumSpotifyId: SPOTIFY_ALBUM_ID },
    data: { album: meta.title, artistSpotifyId: meta.artistSpotifyId },
  });

  console.log(JSON.stringify({ album }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

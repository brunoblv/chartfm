const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const CORRECT_SPOTIFY_ID = "7aZ221EQfonNG2lO9Hh192";
const ARTIST_NAME = "KARA";

async function main() {
  const all = await prisma.artist.findMany({
    where: { name: { equals: ARTIST_NAME, mode: "insensitive" } },
    select: {
      id: true,
      spotifyId: true,
      name: true,
      _count: { select: { albums: true, songs: true, feats: true } },
    },
  });

  console.log("Artistas encontrados:", JSON.stringify(all, null, 2));

  const correct = all.find((a) => a.spotifyId === CORRECT_SPOTIFY_ID);
  if (!correct) throw new Error(`Artista correto (${CORRECT_SPOTIFY_ID}) não encontrado no banco.`);

  const duplicates = all.filter((a) => a.spotifyId !== CORRECT_SPOTIFY_ID);
  if (!duplicates.length) {
    console.log("Nenhum duplicado encontrado. Nada a fazer.");
    return;
  }

  const dupIds = duplicates.map((a) => a.spotifyId);

  // Reatribuir albums
  const albumsUpdated = await prisma.album.updateMany({
    where: { artistSpotifyId: { in: dupIds } },
    data: { artistSpotifyId: CORRECT_SPOTIFY_ID },
  });
  console.log(`Albums reatribuídos: ${albumsUpdated.count}`);

  // Reatribuir songs (artistSpotifyId)
  const songsUpdated = await prisma.song.updateMany({
    where: { artistSpotifyId: { in: dupIds } },
    data: { artistSpotifyId: CORRECT_SPOTIFY_ID },
  });
  console.log(`Songs reatribuídas: ${songsUpdated.count}`);

  // Reatribuir feats
  for (const dup of duplicates) {
    const feats = await prisma.songFeat.findMany({
      where: { artistSpotifyId: dup.spotifyId },
      select: { id: true, songId: true, artistSpotifyId: true },
    });

    for (const feat of feats) {
      // Evitar duplicata se já existe feat do artista correto nessa song
      const exists = await prisma.songFeat.findFirst({
        where: { songId: feat.songId, artistSpotifyId: CORRECT_SPOTIFY_ID },
      });
      if (exists) {
        await prisma.songFeat.delete({ where: { id: feat.id } });
      } else {
        await prisma.songFeat.update({
          where: { id: feat.id },
          data: { artistSpotifyId: CORRECT_SPOTIFY_ID },
        });
      }
    }
    console.log(`Feats do artista ${dup.spotifyId} migrados: ${feats.length}`);
  }

  // Deletar duplicados
  const deleted = await prisma.artist.deleteMany({
    where: { spotifyId: { in: dupIds } },
  });
  console.log(`Artistas deletados: ${deleted.count}`);
  console.log("Artista correto mantido:", correct);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { prisma } from "../lib/prisma";

const IDS = ["989bdf38e9e64464a668c5087bfdc783", "b38b3c65f82043ca8602abfbe1c8b2a2"];

async function main() {
  for (const id of IDS) {
    const s = await prisma.song.findUnique({
      where: { id },
      select: { title: true, artist: true, spotifyId: true, artistSpotifyId: true, spotifyUrl: true },
    });
    const n = await prisma.chartEntry.count({ where: { songId: id } });
    const ce = await prisma.chartEntry.findFirst({
      where: { songId: id },
      select: { songSpotifyId: true, albumSpotifyId: true },
    });
    console.log(JSON.stringify({ id, song: s, chartEntries: n, sampleEntry: ce }, null, 2));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

import { prisma } from "@/lib/prisma";
import { computeGlobalSnapshotData } from "@/lib/global-snapshot";

async function main() {
  const snapshots = await prisma.globalSnapshot.findMany({
    select: { id: true, weekIndex: true, weekLabel: true, dateRange: true },
    orderBy: { weekIndex: "asc" },
  });

  console.log(`Regenerando ${snapshots.length} snapshot(s)...`);

  for (const snap of snapshots) {
    console.log(`  → semana ${snap.weekLabel} (${snap.weekIndex})`);
    await prisma.$connect();
    const payload = await computeGlobalSnapshotData(snap.weekIndex);
    await prisma.globalSnapshot.update({
      where: { id: snap.id },
      data: {
        weeklySongs: payload.weeklySongs as unknown as object,
        weeklyArtists: payload.weeklyArtists as unknown as object,
        overallSongs: payload.overallSongs as unknown as object,
        overallArtists: payload.overallArtists as unknown as object,
      },
    });
    console.log(`    ✓ atualizado`);
  }

  console.log("Concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

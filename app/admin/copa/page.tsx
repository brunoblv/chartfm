import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { CopaAdminClient } from "./CopaAdminClient";

export const dynamic = "force-dynamic";

export default async function CopaAdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "ADMIN" && user?.role !== "DEV") redirect("/");

  const editions = await prisma.copaEdition.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      participants: {
        include: { user: { select: { id: true, name: true, handle: true, avatarColor: true } } },
      },
      _count: { select: { copaArtists: true, fixtures: true } },
    },
  });

  // For each active copa, get live/upcoming fixture counts
  const activeEdition = editions.find((e) => e.status !== "FINISHED");
  let fixturesByStatus: { UPCOMING: number; LIVE: number; DONE: number } | null = null;
  if (activeEdition) {
    const [upcoming, live, done] = await Promise.all([
      prisma.copaFixture.count({ where: { copaId: activeEdition.id, status: "UPCOMING" } }),
      prisma.copaFixture.count({ where: { copaId: activeEdition.id, status: "LIVE" } }),
      prisma.copaFixture.count({ where: { copaId: activeEdition.id, status: "DONE" } }),
    ]);
    fixturesByStatus = { UPCOMING: upcoming, LIVE: live, DONE: done };
  }

  // Active copa fixtures list for admin controls
  const activeFixtures = activeEdition
    ? await prisma.copaFixture.findMany({
        where: { copaId: activeEdition.id },
        include: {
          votes: true,
          artistA: { select: { id: true, artistName: true, artistInitials: true, artistColor: true, artistImage: true } },
          artistB: { select: { id: true, artistName: true, artistInitials: true, artistColor: true, artistImage: true } },
        },
        orderBy: [{ phase: "asc" }, { groupLetter: "asc" }, { round: "asc" }, { matchIndex: "asc" }],
        take: 100,
      })
    : [];

  return (
    <Shell title="Copa ChartFM" subtitle="Gerencie edições, fases e jogos">
      <CopaAdminClient
      editions={editions.map((e) => ({
        id: e.id,
        name: e.name,
        year: e.year,
        status: e.status as string,
        artistCount: e._count.copaArtists,
        fixtureCount: e._count.fixtures,
        participants: e.participants.map((p) => ({
          userId: p.userId,
          name: p.user.name,
          handle: p.user.handle,
          avatarColor: p.user.avatarColor,
        })),
      }))}
      activeEditionId={activeEdition?.id ?? null}
      fixturesByStatus={fixturesByStatus}
      activeFixtures={activeFixtures.map((f) => ({
        id: f.id,
        phase: f.phase as string,
        groupLetter: f.groupLetter,
        round: f.round,
        matchIndex: f.matchIndex,
        status: f.status as string,
        votesA: f.votes.filter((v) => v.side === "A").length,
        votesB: f.votes.filter((v) => v.side === "B").length,
        artistA: { artistName: f.artistA.artistName, artistInitials: f.artistA.artistInitials, artistColor: f.artistA.artistColor, artistImage: f.artistA.artistImage },
        artistB: { artistName: f.artistB.artistName, artistInitials: f.artistB.artistInitials, artistColor: f.artistB.artistColor, artistImage: f.artistB.artistImage },
      }))}
      />
    </Shell>
  );
}

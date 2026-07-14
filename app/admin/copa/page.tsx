import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { fixtureBatchOrder } from "@/lib/copa";
import { COPA_MANUAL_VOTE_HANDLES } from "@/lib/copa-manual-vote-users";
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
  let knockoutControls: { r32Complete: boolean; hasR16: boolean } | null = null;
  if (activeEdition) {
    const [r32Total, r32Done, r16Count] = await Promise.all([
      prisma.copaFixture.count({ where: { copaId: activeEdition.id, phase: "R32" } }),
      prisma.copaFixture.count({ where: { copaId: activeEdition.id, phase: "R32", status: "DONE" } }),
      prisma.copaFixture.count({ where: { copaId: activeEdition.id, phase: "R16" } }),
    ]);
    knockoutControls = {
      r32Complete: r32Total >= 16 && r32Done >= r32Total,
      hasR16: r16Count > 0,
    };
  }

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

  // Aba de votos manuais (só @bruno): os 22 usuários de estilo + disputas Ao vivo.
  const isBruno = (session.user.handle ?? "").toLowerCase() === "bruno";
  let manualVote: {
    users: { userId: string; name: string; handle: string; avatarColor: string }[];
    fixtures: {
      id: string;
      phase: string;
      groupLetter: string | null;
      round: number | null;
      day: number;
      artistA: { artistName: string; artistInitials: string; artistColor: string; artistImage: string | null };
      artistB: { artistName: string; artistInitials: string; artistColor: string; artistImage: string | null };
    }[];
    existingVotes: Record<string, Record<string, "A" | "B">>;
  } | null = null;

  if (isBruno && activeEdition) {
    const [manualUsers, liveFixtures] = await Promise.all([
      prisma.user.findMany({
        where: { handle: { in: COPA_MANUAL_VOTE_HANDLES } },
        select: { id: true, name: true, handle: true, avatarColor: true },
      }),
      prisma.copaFixture.findMany({
        where: { copaId: activeEdition.id, status: "LIVE" },
        include: {
          artistA: { select: { artistName: true, artistInitials: true, artistColor: true, artistImage: true } },
          artistB: { select: { artistName: true, artistInitials: true, artistColor: true, artistImage: true } },
        },
        orderBy: [{ phase: "asc" }, { groupLetter: "asc" }, { round: "asc" }, { matchIndex: "asc" }],
      }),
    ]);

    const userIds = manualUsers.map((u) => u.id);
    const fixtureIds = liveFixtures.map((f) => f.id);
    const existing =
      userIds.length && fixtureIds.length
        ? await prisma.copaVote.findMany({
            where: { userId: { in: userIds }, fixtureId: { in: fixtureIds } },
            select: { userId: true, fixtureId: true, side: true },
          })
        : [];
    const existingVotes: Record<string, Record<string, "A" | "B">> = {};
    for (const v of existing) {
      (existingVotes[v.userId] ??= {})[v.fixtureId] = v.side as "A" | "B";
    }

    // Ordena os usuários na ordem dos handles configurados.
    const orderByHandle = new Map(COPA_MANUAL_VOTE_HANDLES.map((h, i) => [h.toLowerCase(), i]));
    manualVote = {
      users: manualUsers
        .map((u) => ({ userId: u.id, name: u.name, handle: u.handle, avatarColor: u.avatarColor }))
        .sort((a, b) => (orderByHandle.get(a.handle.toLowerCase()) ?? 99) - (orderByHandle.get(b.handle.toLowerCase()) ?? 99)),
      fixtures: liveFixtures.map((f) => ({
        id: f.id,
        phase: f.phase as string,
        groupLetter: f.groupLetter,
        round: f.round,
        day: fixtureBatchOrder(f) + 1,
        artistA: { artistName: f.artistA.artistName, artistInitials: f.artistA.artistInitials, artistColor: f.artistA.artistColor, artistImage: f.artistA.artistImage },
        artistB: { artistName: f.artistB.artistName, artistInitials: f.artistB.artistInitials, artistColor: f.artistB.artistColor, artistImage: f.artistB.artistImage },
      })),
      existingVotes,
    };
  }

  return (
    <Shell title="Copa ChartFM" subtitle="Gerencie edições, fases e jogos">
      <CopaAdminClient
      viewerHandle={session.user.handle ?? null}
      manualVote={manualVote}
      editions={editions.map((e) => ({
        id: e.id,
        name: e.name,
        year: e.year,
        status: e.status as string,
        type: e.type as string,
        startsAt: e.startsAt ? e.startsAt.toISOString() : null,
        votesPerGoal: e.votesPerGoal,
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
      activeVotesPerGoal={activeEdition?.votesPerGoal ?? 2}
      fixturesByStatus={fixturesByStatus}
      knockoutControls={knockoutControls}
      activeFixtures={activeFixtures.map((f) => ({
        id: f.id,
        phase: f.phase as string,
        groupLetter: f.groupLetter,
        round: f.round,
        matchIndex: f.matchIndex,
        day: fixtureBatchOrder(f) + 1,
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

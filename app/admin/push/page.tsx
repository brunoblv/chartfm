import { Shell } from "@/components/layout/Shell";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import PushAdminClient from "./PushAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPushPage() {
  const auth = await requirePrivilegedSession();
  if (!auth) {
    return (
      <Shell title="Admin · Push" subtitle="Gerenciar rodadas do Push">
        <div style={{ color: "var(--text-muted)" }}>Acesso negado. Apenas ADMIN e DEV.</div>
      </Shell>
    );
  }

  const rounds = await prisma.pushRound.findMany({
    orderBy: { number: "desc" },
    include: { submissions: { select: { id: true } } },
  });

  const serialized = rounds.map((r) => ({
    id: r.id,
    number: r.number,
    title: r.title,
    phase: r.phase,
    season: r.season,
    submissionEndsAt: r.submissionEndsAt.toISOString(),
    listeningEndsAt: r.listeningEndsAt.toISOString(),
    rankingEndsAt: r.rankingEndsAt.toISOString(),
    spotifyPlaylistId: r.spotifyPlaylistId,
    createdAt: r.createdAt.toISOString(),
    submissionCount: r.submissions.length,
  }));

  return (
    <Shell title="Push" subtitle="Gerencie as rodadas do jogo Push">
      <PushAdminClient initialRounds={serialized} />
    </Shell>
  );
}

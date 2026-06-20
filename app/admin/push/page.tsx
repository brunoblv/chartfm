import { Shell } from "@/components/layout/Shell";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { MYTRL_OWNER_HANDLE } from "@/lib/mytrl-access";
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

  const [rounds, owner] = await Promise.all([
    prisma.pushRound.findMany({
      orderBy: { number: "desc" },
      include: { submissions: { select: { id: true } } },
    }),
    prisma.user.findUnique({
      where: { handle: MYTRL_OWNER_HANDLE },
      select: {
        spotifyRefreshToken: true,
        youtubeRefreshToken: true,
        youtubeChannelHandle: true,
      },
    }),
  ]);

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
    youtubePlaylistId: r.youtubePlaylistId,
    createdAt: r.createdAt.toISOString(),
    submissionCount: r.submissions.length,
  }));

  const integrations = {
    spotifyConnected: !!owner?.spotifyRefreshToken,
    youtubeConnected: !!owner?.youtubeRefreshToken,
    youtubeChannelHandle: owner?.youtubeChannelHandle ?? null,
  };

  return (
    <Shell title="Push" subtitle="Gerencie as rodadas do jogo Push">
      <PushAdminClient initialRounds={serialized} integrations={integrations} />
    </Shell>
  );
}

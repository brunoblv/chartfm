import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import type { PushPhase } from "@prisma/client";
import { advancePushRoundPhase, normalizePushPhase } from "@/lib/push-advance";
import { announcePushPhaseChange } from "@/lib/game-announcements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ roundId: string }> },
) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { roundId } = await params;
  const body = (await req.json()) as {
    advancePhase?: boolean;
    phase?: PushPhase;
    title?: string;
    season?: number;
    submissionEndsAt?: string;
    listeningEndsAt?: string;
    rankingEndsAt?: string;
    spotifyPlaylistId?: string;
    youtubePlaylistId?: string;
  };

  const round = await prisma.pushRound.findUnique({ where: { id: roundId } });
  if (!round) return NextResponse.json({ error: "Rodada não encontrada" }, { status: 404 });

  if (body.advancePhase) {
    // Inscrições não podem ser encerradas antes do prazo (mesma regra da
    // validação de datas abaixo, onde listeningEndsAt vira "agora").
    if (normalizePushPhase(round.phase) === "SUBMISSION" && new Date() < round.submissionEndsAt) {
      return NextResponse.json(
        { error: "A escuta deve começar após o fim das inscrições" },
        { status: 400 },
      );
    }

    const result = await advancePushRoundPhase(round);
    if (!result) return NextResponse.json({ ...round, playlistSync: null });
    return NextResponse.json({ ...result.updated, playlistSync: result.playlistSync });
  }

  const updates: Partial<{
    phase: PushPhase;
    title: string | null;
    season: number;
    submissionEndsAt: Date;
    listeningEndsAt: Date;
    rankingEndsAt: Date;
    spotifyPlaylistId: string | null;
    youtubePlaylistId: string | null;
  }> = {};

  if (body.phase) {
    updates.phase = body.phase;
  }

  if (body.title !== undefined) updates.title = body.title || null;
  if (body.season !== undefined) updates.season = body.season;
  if (body.submissionEndsAt) updates.submissionEndsAt = new Date(body.submissionEndsAt);
  if (body.listeningEndsAt) updates.listeningEndsAt = new Date(body.listeningEndsAt);
  if (body.rankingEndsAt) updates.rankingEndsAt = new Date(body.rankingEndsAt);
  if (body.spotifyPlaylistId !== undefined) updates.spotifyPlaylistId = body.spotifyPlaylistId || null;
  if (body.youtubePlaylistId !== undefined) updates.youtubePlaylistId = body.youtubePlaylistId || null;

  const submissionEndsAt = updates.submissionEndsAt ?? round.submissionEndsAt;
  const listeningEndsAt = updates.listeningEndsAt ?? round.listeningEndsAt;
  const rankingEndsAt = updates.rankingEndsAt ?? round.rankingEndsAt;

  if (listeningEndsAt < submissionEndsAt) {
    return NextResponse.json({ error: "A escuta deve começar após o fim das inscrições" }, { status: 400 });
  }
  if (rankingEndsAt <= listeningEndsAt) {
    return NextResponse.json({ error: "O fim da escuta deve ser após o início" }, { status: 400 });
  }

  const updated = await prisma.pushRound.update({
    where: { id: roundId },
    data: updates,
  });

  if (updates.phase && updates.phase !== round.phase) {
    await announcePushPhaseChange(updated);
  }

  return NextResponse.json({ ...updated, playlistSync: null });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ roundId: string }> },
) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { roundId } = await params;
  await prisma.pushRound.delete({ where: { id: roundId } });
  return NextResponse.json({ ok: true });
}

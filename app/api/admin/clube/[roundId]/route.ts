import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { completeClubeRound, openClubePollNow, updateClubeRound, type ClubeRoundSchedulePatch } from "@/lib/clube-album";
import type { AlbumClubPhase } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roundId: string }> },
) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { roundId } = await params;
  const body = (await req.json()) as {
    theme?: string;
    wednesdayDate?: string;
    applyWednesdayTemplate?: boolean;
    schedule?: ClubeRoundSchedulePatch;
    phase?: AlbumClubPhase | "AUTO";
    action?: string;
  };

  if (body.action === "complete") {
    const result = await completeClubeRound(roundId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "openPollNow") {
    const result = await openClubePollNow(roundId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const result = await updateClubeRound(roundId, {
    theme: body.theme,
    wednesdayDate: body.wednesdayDate,
    applyWednesdayTemplate: body.applyWednesdayTemplate,
    schedule: body.schedule,
    phase: body.phase,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

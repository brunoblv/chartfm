import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { completeClubeRound, updateClubeRound } from "@/lib/clube-album";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roundId: string }> },
) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { roundId } = await params;
  const body = (await req.json()) as { theme?: string; wednesdayDate?: string; action?: string };

  if (body.action === "complete") {
    const result = await completeClubeRound(roundId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const result = await updateClubeRound(roundId, {
    theme: body.theme,
    wednesdayDate: body.wednesdayDate,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { requireMyTrlSession } from "@/lib/mytrl-access";
import { recomputeAllMyTrlSnapshots } from "@/lib/mytrl-recompute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/mytrl/recompute — recalcula dias, pico, movimentação e #1s de todas as edições
export async function POST() {
  const session = await requireMyTrlSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await recomputeAllMyTrlSnapshots();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import {
  GLOBAL_ADMIN_ACTIONS,
  GLOBAL_DATE_KINDS,
  getGlobalWeekStatus,
  listAdminGlobalWeekOptions,
  runGlobalAdminAction,
  updateGlobalSnapshotDates,
  type GlobalAdminAction,
  type GlobalDateKind,
} from "@/lib/admin-global-ops";
import { getRankingWeekReference } from "@/lib/chart-week";
import { getGlobalPublishSlot } from "@/lib/global-publish-schedule";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function isAction(v: unknown): v is GlobalAdminAction {
  return typeof v === "string" && (GLOBAL_ADMIN_ACTIONS as string[]).includes(v);
}

function isDateKind(v: unknown): v is GlobalDateKind {
  return typeof v === "string" && (GLOBAL_DATE_KINDS as string[]).includes(v);
}

/** GET — status da semana + lista de semanas para o seletor. */
export async function GET(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const slot = await getGlobalPublishSlot();
  const current = getRankingWeekReference(new Date(), slot);
  const rawWeek = req.nextUrl.searchParams.get("weekIndex");
  const weekIndex = rawWeek ? Number(rawWeek) : current.weekIndex;

  const [status, weeks] = await Promise.all([
    getGlobalWeekStatus(weekIndex),
    listAdminGlobalWeekOptions(24),
  ]);

  return NextResponse.json({ ok: true, currentWeekIndex: current.weekIndex, weeks, status });
}

/**
 * POST — executa ação manual (publicar, recalcular, playlists, posts, etc.)
 * ou atualiza a data exibida de um snapshot.
 * Body ação: { action, weekIndex? }
 * Body data:  { kind: "set-dates", dateKind, weekDate, weekIndex? }
 */
export async function POST(req: NextRequest) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    action?: unknown;
    kind?: unknown;
    dateKind?: unknown;
    weekDate?: unknown;
    weekIndex?: unknown;
  };

  const slot = await getGlobalPublishSlot();
  const current = getRankingWeekReference(new Date(), slot);
  const weekIndex =
    body.weekIndex != null && body.weekIndex !== ""
      ? Number(body.weekIndex)
      : current.weekIndex;

  if (!Number.isFinite(weekIndex)) {
    return NextResponse.json({ error: "weekIndex inválido" }, { status: 400 });
  }

  if (body.kind === "set-dates") {
    if (!isDateKind(body.dateKind)) {
      return NextResponse.json(
        { error: `dateKind inválido. Use: ${GLOBAL_DATE_KINDS.join(", ")}` },
        { status: 400 },
      );
    }
    if (typeof body.weekDate !== "string" || !body.weekDate.trim()) {
      return NextResponse.json({ error: "weekDate obrigatório (AAAA-MM-DD)." }, { status: 400 });
    }
    try {
      const result = await updateGlobalSnapshotDates(weekIndex, body.dateKind, body.weekDate.trim());
      const status = await getGlobalWeekStatus(weekIndex);
      return NextResponse.json({ ok: true, result, status });
    } catch (err) {
      console.error("[admin/parada-global/actions] set-dates", err);
      return NextResponse.json({ ok: false, error: String(err) }, { status: 400 });
    }
  }

  if (!isAction(body.action)) {
    return NextResponse.json(
      { error: `action inválida. Use: ${GLOBAL_ADMIN_ACTIONS.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const result = await runGlobalAdminAction(body.action, weekIndex);
    const status = await getGlobalWeekStatus(weekIndex);
    return NextResponse.json({ ok: true, result, status });
  } catch (err) {
    console.error("[admin/parada-global/actions]", body.action, err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

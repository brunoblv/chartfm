import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import { isVideoparadaModuleEnabled } from "@/lib/videoparada-dev-only";
import {
  getVideoparadaAdminPayload,
  isValidVideoparadaChartKind,
  listVideoparadaCharts,
  listVideoparadaWeeks,
  normalizeClipConfigInput,
  resolveDefaultVideoparadaWeek,
  upsertVideoparadaConfigs,
  type VideoparadaClipConfigInput,
} from "@/lib/videoparada";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isVideoparadaModuleEnabled()) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const chartKind = req.nextUrl.searchParams.get("chartKind")?.trim() || "global";
  if (!isValidVideoparadaChartKind(chartKind)) {
    return NextResponse.json({ error: "chart_kind inválido" }, { status: 400 });
  }

  const weeks = await listVideoparadaWeeks(chartKind);
  const weekParam = req.nextUrl.searchParams.get("weekIndex");
  const weekIndex = weekParam
    ? Number(weekParam)
    : ((await resolveDefaultVideoparadaWeek(chartKind)) ?? weeks[0]?.weekIndex ?? null);

  if (weekIndex === null || !Number.isInteger(weekIndex)) {
    return NextResponse.json({
      charts: listVideoparadaCharts(),
      chartKind,
      weeks,
      weekIndex: null,
      weekLabel: null,
      dateRange: null,
      entries: [],
      message: "Nenhum snapshot disponível para esta parada.",
    });
  }

  const payload = await getVideoparadaAdminPayload(chartKind, weekIndex);
  if ("error" in payload) {
    return NextResponse.json(
      {
        charts: listVideoparadaCharts(),
        chartKind,
        weeks,
        weekIndex,
        error: payload.error,
        entries: [],
      },
      { status: payload.error?.includes("Snapshot") ? 404 : 400 },
    );
  }

  return NextResponse.json({
    charts: listVideoparadaCharts(),
    weeks,
    ...payload,
  });
}

export async function PUT(req: NextRequest) {
  if (!isVideoparadaModuleEnabled()) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    chartKind?: string;
    weekIndex?: number;
    entries?: Partial<VideoparadaClipConfigInput>[];
  };

  const chartKind = typeof body.chartKind === "string" ? body.chartKind.trim() : "";
  if (!isValidVideoparadaChartKind(chartKind)) {
    return NextResponse.json({ error: "chart_kind inválido" }, { status: 400 });
  }

  const weekIndex = Number(body.weekIndex);
  if (!Number.isInteger(weekIndex) || weekIndex < 1) {
    return NextResponse.json({ error: "weekIndex inválido" }, { status: 400 });
  }

  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    return NextResponse.json({ error: "entries obrigatório" }, { status: 400 });
  }

  const normalized: VideoparadaClipConfigInput[] = [];
  for (const raw of body.entries) {
    const item = normalizeClipConfigInput(raw);
    if (typeof item === "string") {
      return NextResponse.json({ error: item, songId: raw.songId }, { status: 400 });
    }
    normalized.push(item);
  }

  const results = await upsertVideoparadaConfigs(chartKind, weekIndex, normalized);
  const payload = await getVideoparadaAdminPayload(chartKind, weekIndex);
  if ("error" in payload) {
    return NextResponse.json({ results, error: payload.error }, { status: 200 });
  }

  return NextResponse.json({ results, ...payload });
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { toApiCadence } from "@/lib/chart-cadence";
import { ensureUserParadas } from "@/lib/paradas";
import { filterParadasForViewer } from "@/lib/mytrl-access";
import { maxParadasForUser } from "@/lib/mytrl-access";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, context: { params: Promise<{ handle: string }> }) {
  try {
    const { handle: raw } = await context.params;
    const handle = decodeURIComponent(raw ?? "").trim();
    if (!handle) {
      return NextResponse.json({ error: "invalid_handle" }, { status: 400 });
    }

    const [session, dbUser] = await Promise.all([
      getServerSession(authOptions),
      prisma.user.findUnique({
        where: { handle },
        select: { id: true, handle: true },
      }),
    ]);

    if (!dbUser) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const viewerHandle = session?.user?.handle ?? null;
    const allParadas = await ensureUserParadas(prisma, dbUser.id);
    const paradas = filterParadasForViewer(allParadas, viewerHandle);
    const isOwn = session?.user?.id === dbUser.id;
    const maxParadas = maxParadasForUser(dbUser.handle);
    const canCreate = isOwn && paradas.length < maxParadas;

    const cards = await Promise.all(
      paradas.map(async (p) => {
        const [weeks, songs, numberOneGroups, latest] = await Promise.all([
          prisma.chart.count({ where: { paradaId: p.id } }),
          prisma.chartEntry.count({ where: { chart: { paradaId: p.id } } }),
          prisma.chartEntry.groupBy({
            by: ["songId"],
            where: { position: 1, chart: { paradaId: p.id } },
          }),
          prisma.chart.findFirst({
            where: { paradaId: p.id },
            orderBy: { weekIndex: "desc" },
            select: { weekLabel: true, dateRange: true },
          }),
        ]);

        return {
          id: p.id,
          name: p.name,
          logo: p.logo,
          genres: p.genres,
          isPrimary: p.isPrimary,
          sortOrder: p.sortOrder,
          chartSize: p.chartSize,
          cadence: toApiCadence(p.cadence),
          stats: {
            weeks,
            numberOnes: numberOneGroups.length,
            songs,
          },
          lastWeekLabel: latest?.weekLabel ?? null,
          lastDateRange: latest?.dateRange ?? null,
        };
      }),
    );

    return NextResponse.json({
      handle: dbUser.handle,
      paradas: cards,
      canCreate,
      maxParadas,
      isOwn,
    });
  } catch (err) {
    console.error("[GET /api/profile/[handle]/paradas]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

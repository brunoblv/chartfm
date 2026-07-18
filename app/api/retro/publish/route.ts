import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBruno } from "@/lib/require-bruno";
import { paletteFor } from "@/lib/mytrl-weekly-chart";
import { pointsForChartPosition, scoringTierFromPrimary } from "@/lib/parada-points";
import { generateRetroHistory, TARGET_PARADA } from "@/lib/retro/generate-history";
import type { RetroTarget } from "@/lib/retro/build-pool";

const MIN_YEAR = 1990;
/** Nº máximo de semanas gravadas por chamada — evita uma request gigante/lenta.
 *  Backfills grandes: chame de novo (é idempotente, retoma de onde parou). */
const MAX_WEEKS_PER_CALL = 300;

function parseTarget(raw: unknown): RetroTarget | null {
  return raw === "hot100" || raw === "clipes" ? raw : null;
}

/**
 * POST /api/retro/publish
 * Body: { target: "hot100" | "clipes", startYear: number, dryRun?: boolean, fetchRealPeriodPlays?: boolean }
 *
 * Gera o histórico semanal (estreia + carry-over) a partir de `startYear` e,
 * se `dryRun` for false, grava como `Chart`/`ChartEntry` reais na parada-alvo.
 * NUNCA sobrescreve uma semana que já existe (idempotente — pode rodar de novo
 * pra continuar um backfill grande em pedaços de até `MAX_WEEKS_PER_CALL`).
 * Restrito ao @bruno.
 */
export async function POST(req: NextRequest) {
  const userId = await requireBruno();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const target = parseTarget(body?.target);
  if (!target) return NextResponse.json({ error: "invalid_target" }, { status: 400 });

  const startYear = Number(body?.startYear);
  const nowYear = new Date().getUTCFullYear();
  if (!Number.isInteger(startYear) || startYear < MIN_YEAR || startYear > nowYear) {
    return NextResponse.json({ error: "invalid_start_year" }, { status: 400 });
  }

  const dryRun = body?.dryRun !== false; // padrão: dry-run (só quem manda dryRun:false grava)
  const fetchRealPeriodPlays = body?.fetchRealPeriodPlays === true;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { lastfmUser: true } });
  if (!user?.lastfmUser) {
    return NextResponse.json({ error: "no_lastfm_user" }, { status: 400 });
  }

  // Parada de destino: por padrão a parada fixa de `target` (ver TARGET_PARADA), mas o
  // usuário pode escolher qualquer parada dele — precisa pertencer a ele.
  const requestedParadaId = typeof body?.paradaId === "string" ? body.paradaId.trim() : "";
  let customParada: { id: string; chartSize: number | null; isPrimary: boolean } | null = null;
  if (requestedParadaId) {
    customParada = await prisma.parada.findFirst({
      where: { id: requestedParadaId, userId, deletedAt: null },
      select: { id: true, chartSize: true, isPrimary: true },
    });
    if (!customParada) {
      return NextResponse.json({ error: "parada_not_found" }, { status: 404 });
    }
  }

  const result = await generateRetroHistory({
    userId,
    lastfmUser: user.lastfmUser,
    target,
    startYear,
    fetchRealPeriodPlays,
    paradaId: customParada?.id,
    chartSize: customParada?.chartSize ?? undefined,
  });
  const { paradaId, chartSize, weeks } = result;
  const isPrimary = customParada?.isPrimary ?? TARGET_PARADA[target].isPrimary;

  if (dryRun) {
    const firstWeek = weeks[0] ?? null;
    const lastWeek = weeks[weeks.length - 1] ?? null;
    const titleById = new Map(result.debuts.map((d) => [d.songId, d]));
    const sample = (w: typeof firstWeek) =>
      w && {
        weekIndex: w.weekIndex,
        weekLabel: w.weekLabel,
        dateRange: w.dateRange,
        top5: w.entries.slice(0, 5).map((e) => ({
          position: e.position,
          status: e.status,
          songId: e.songId,
          title: titleById.get(e.songId)?.title ?? "—",
          artist: titleById.get(e.songId)?.artist ?? "—",
        })),
      };

    return NextResponse.json({
      dryRun: true,
      target,
      paradaId,
      chartSize,
      startYear,
      boundaryWeekIndex: result.boundaryWeekIndex,
      boundaryWeekLabel: result.boundaryWeekLabel,
      monthsScanned: result.monthsScanned,
      totalDebuts: result.debuts.length,
      weeksToCreate: weeks.length,
      firstWeek: sample(firstWeek),
      lastWeek: sample(lastWeek),
    });
  }

  // ── Escrita real ──────────────────────────────────────────────────────
  const tier = scoringTierFromPrimary(isPrimary);
  const allSongIds = Array.from(new Set(weeks.flatMap((w) => w.entries.map((e) => e.songId))));
  const songs = await prisma.song.findMany({ where: { id: { in: allSongIds } }, select: { id: true, title: true, artist: true, spotifyId: true } });
  const songById = new Map(songs.map((s) => [s.id, s]));

  let created = 0;
  let skippedExisting = 0;

  for (const week of weeks) {
    if (created >= MAX_WEEKS_PER_CALL) break;

    const existing = await prisma.chart.findUnique({
      where: { paradaId_weekIndex: { paradaId, weekIndex: week.weekIndex } },
      select: { id: true },
    });
    if (existing) {
      skippedExisting += 1;
      continue; // nunca sobrescreve uma semana já publicada (real ou de uma rodada anterior)
    }

    // Semana de publicação = sábado da própria semana, 02h UTC — mesmo padrão do histórico já importado.
    const publishedAt = new Date(week.weekStartDate.getTime() + 5 * 86_400_000 + 2 * 3_600_000);

    await prisma.chart.create({
      data: {
        userId,
        paradaId,
        weekIndex: week.weekIndex,
        weekLabel: week.weekLabel,
        dateRange: week.dateRange,
        publishedAt,
        weekStartDate: week.weekStartDate,
        maxItems: chartSize,
        isPublished: true,
        entries: {
          create: week.entries.map((e) => {
            const song = songById.get(e.songId);
            const { palette, seed } = paletteFor(song?.artist ?? "", song?.title ?? e.songId);
            return {
              position: e.position,
              songId: e.songId,
              songSpotifyId: song?.spotifyId ?? null,
              points: pointsForChartPosition(e.position, tier, chartSize, "WEEKLY"),
              status: e.status,
              delta: e.delta,
              prevPos: e.prevPos,
              peak: e.peak,
              weeks: e.weeks,
              coverPaletteA: palette[0],
              coverPaletteB: palette[1],
              coverSeed: seed,
            };
          }),
        },
      },
    });
    created += 1;
  }

  return NextResponse.json({
    dryRun: false,
    target,
    paradaId,
    created,
    skippedExisting,
    remaining: Math.max(0, weeks.length - created - skippedExisting),
  });
}

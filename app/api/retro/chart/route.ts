import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBruno } from "@/lib/require-bruno";
import { buildRetroPool, type RetroTarget } from "@/lib/retro/build-pool";
import { buildRetroChart, type RetroMode } from "@/lib/retro/scoring";

const MIN_YEAR = 1990;

function parseMode(raw: string | null): RetroMode {
  return raw === "historico" ? "historico" : "retrospectivo";
}

function parseTarget(raw: string | null): RetroTarget {
  return raw === "clipes" ? "clipes" : "hot100";
}

/**
 * GET /api/retro/chart?year=2005&month=5&mode=retrospectivo&target=hot100
 * Lista as candidatas a estreia do mês (modelo estreia + carry-over), pontuadas.
 * target: "hot100" (singles, 100 posições) | "clipes" (Top 20 de clipes).
 */
export async function GET(req: NextRequest) {
  // Em um primeiro momento, a Hot 100 Retrospectiva é restrita ao @bruno.
  const userId = await requireBruno();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const year = Number(sp.get("year"));
  const month = Number(sp.get("month"));
  const mode = parseMode(sp.get("mode"));
  const target = parseTarget(sp.get("target"));
  const chartSize = target === "clipes" ? 20 : 100;
  const nowYear = new Date().getUTCFullYear();

  if (!Number.isInteger(year) || year < MIN_YEAR || year > nowYear) {
    return NextResponse.json({ error: "invalid_year" }, { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "invalid_month" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { lastfmUser: true } });
  if (!user?.lastfmUser) {
    return NextResponse.json({ error: "no_lastfm_user" }, { status: 400 });
  }

  const pool = await buildRetroPool({ userId, lastfmUser: user.lastfmUser, year, month, mode, target });
  const rows = buildRetroChart(pool.songs, {
    chartDate: pool.chartDate,
    mode,
    now: new Date(),
    chartSize,
  });

  // Estatísticas (faixa de KPIs do mockup) sobre o pool elegível.
  const playById = new Map(pool.songs.map((s) => [s.songId, s]));
  const eligible = rows.filter((r) => r.eligible);
  const excluded = rows.filter((r) => r.eligibilityStatus === "excluded_out");
  const stats = {
    eligible: eligible.length,
    withPeriodPlays: eligible.filter((r) => (playById.get(r.songId)?.periodPlaycount ?? 0) > 0).length,
    everInTop20: eligible.filter((r) => (playById.get(r.songId)?.top20Weeks ?? 0) > 0).length,
    everNumberOne: eligible.filter((r) => (playById.get(r.songId)?.numberOnes ?? 0) > 0).length,
    diamonds: eligible.filter((r) => r.hitLevel === "diamond").length,
    excludedOut: excluded.length,
    catalogOnly: pool.catalogOnly,
    matched: pool.matched,
    unmatched: pool.unmatched,
  };

  // O chart: posições atribuídas em ordem + as marcadas como "Fora" no final
  // (sem posição), para o usuário poder rever/desfazer a exclusão.
  const titleOf = (songId: string) => pool.meta.get(songId)?.title ?? "";
  const ranked = rows
    .filter((r) => r.position != null)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const excludedSorted = excluded.sort((a, b) => titleOf(a.songId).localeCompare(titleOf(b.songId), "pt-BR"));
  const entries = [...ranked, ...excludedSorted]
    .map((r) => {
      const s = playById.get(r.songId);
      const m = pool.meta.get(r.songId);
      return {
        ...r,
        title: m?.title ?? "—",
        artist: m?.artist ?? "—",
        album: m?.album ?? null,
        coverUrl: m?.coverUrl ?? null,
        note: m?.note ?? null,
        releaseRefSource: m?.releaseRefSource ?? null,
        billboardHot100DebutDate: m?.billboardHot100DebutDate?.toISOString().slice(0, 10) ?? null,
        singleReleaseDate: s?.singleReleaseDate?.toISOString().slice(0, 10) ?? null,
        albumReleaseDate: s?.albumReleaseDate?.toISOString().slice(0, 10) ?? null,
        youtubeReleaseDate: s?.youtubeReleaseDate?.toISOString().slice(0, 10) ?? null,
        overallPlaycount: s?.overallPlaycount ?? 0,
        periodPlaycount: s?.periodPlaycount ?? null,
        top20Weeks: s?.top20Weeks ?? 0,
        top20BestPeak: s?.top20BestPeak ?? null,
        numberOnes: s?.numberOnes ?? 0,
        manualAdjustment: s?.manualAdjustment ?? 0,
        importanceLocked: s?.importanceLocked ?? false,
      };
    });

  return NextResponse.json({
    period: { year, month, mode, target },
    chartDate: pool.chartDate.toISOString().slice(0, 10),
    usesRealPeriodData: pool.usesRealPeriodData,
    stats,
    entries,
  });
}

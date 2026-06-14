/**
 * Audita pontos de parada de um usuário: compara DB vs cálculo esperado.
 * Uso: npx tsx scripts/audit-user-points.ts s
 */
import { PrismaClient } from "@prisma/client";
import { pointsForChartPosition, scoringTierFromPrimary } from "../lib/parada-points";

const prisma = new PrismaClient();

async function main() {
  const handle = process.argv[2]?.trim();
  if (!handle) {
    console.error("Uso: npx tsx scripts/audit-user-points.ts <handle>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { handle },
    select: {
      id: true,
      handle: true,
      paradas: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          isPrimary: true,
          cadence: true,
          charts: {
            orderBy: { weekIndex: "desc" },
            take: 5,
            select: {
              id: true,
              weekIndex: true,
              weekLabel: true,
              entries: {
                orderBy: { position: "asc" },
                select: {
                  id: true,
                  position: true,
                  points: true,
                  song: { select: { title: true, artist: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    console.log(`Usuário @${handle} não encontrado.`);
    return;
  }

  console.log(`\n=== Auditoria de pontos: @${user.handle} ===\n`);

  for (const parada of user.paradas) {
    const tier = scoringTierFromPrimary(parada.isPrimary);
    console.log(
      `Parada: ${parada.name} (${parada.isPrimary ? "PRINCIPAL" : "SECUNDÁRIA"}, ${parada.cadence}, tier=${tier})`,
    );

    let mismatches = 0;
    let top20LowPoints = 0;

    for (const chart of parada.charts) {
      const chartSize = chart.entries.length;
      console.log(`\n  Semana ${chart.weekLabel} (${chart.weekIndex}) — ${chartSize} entradas`);

      for (const entry of chart.entries) {
        const expected = pointsForChartPosition(
          entry.position,
          tier,
          chartSize,
          parada.cadence,
        );
        const ok = entry.points === expected;
        if (!ok) {
          mismatches++;
          console.log(
            `    ❌ #${entry.position} "${entry.song.title}" — DB=${entry.points}, esperado=${expected}`,
          );
        }
        if (entry.position <= 20 && entry.points < 81 && tier === "primary") {
          top20LowPoints++;
          console.log(
            `    ⚠️  TOP 20 com <81 pts: #${entry.position} "${entry.song.title}" — ${entry.points} pts (esperado ≥81)`,
          );
        }
      }
    }

    // Agregação como no perfil (soma por música)
    const allCharts = await prisma.chart.findMany({
      where: { paradaId: parada.id },
      orderBy: { weekIndex: "asc" },
      select: {
        weekIndex: true,
        entries: {
          orderBy: { position: "asc" },
          select: {
            position: true,
            points: true,
            song: { select: { title: true, artist: true } },
          },
        },
      },
    });

    const songTotals = new Map<string, { title: string; artist: string; points: number; peak: number }>();
    for (const chart of allCharts) {
      const chartSize = chart.entries.length;
      for (const e of chart.entries) {
        const key = `${e.song.title}\0${e.song.artist}`;
        const calcPts = pointsForChartPosition(e.position, tier, chartSize, parada.cadence);
        const cur = songTotals.get(key) ?? {
          title: e.song.title,
          artist: e.song.artist,
          points: 0,
          peak: e.position,
        };
        cur.points += calcPts;
        cur.peak = Math.min(cur.peak, e.position);
        songTotals.set(key, cur);
      }
    }

    const ranked = [...songTotals.values()].sort((a, b) => b.points - a.points);
    console.log(`\n  Top 20 músicas (pontos agregados recalculados):`);
    ranked.slice(0, 20).forEach((s, i) => {
      const flag = s.peak <= 20 && s.points < 81 ? " ⚠️" : "";
      console.log(
        `    ${i + 1}. ${s.title} — ${s.points} pts (peak #${s.peak})${flag}`,
      );
    });

    console.log(`\n  Resumo: ${mismatches} entradas com pontos incorretos no DB, ${top20LowPoints} no top 20 com <81 pts`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { chartEntriesToEditorialInput, generateWeeklyEditorial } from "@/lib/editorial-generator";
import type { GlobalChartEntry } from "@/lib/types";

async function resolveWeeklyEditorialBody(
  weekIndex: number,
  weekLabel: string,
  globalChart: GlobalChartEntry[],
): Promise<string | null> {
  const stored = await prisma.weeklyEditorial.findUnique({
    where: { weekIndex },
    select: { body: true },
  });
  if (stored?.body?.trim()) return stored.body.trim();

  const generated = await generateWeeklyEditorial(
    chartEntriesToEditorialInput(globalChart),
    weekLabel,
  );
  if (generated?.trim()) return generated.trim();

  return null;
}

export function getWeeklyEditorialBody(
  weekIndex: number,
  weekLabel: string,
  globalChart: GlobalChartEntry[],
): Promise<string | null> {
  return unstable_cache(
    () => resolveWeeklyEditorialBody(weekIndex, weekLabel, globalChart),
    [`weekly-editorial-${weekIndex}`],
    { revalidate: 60 * 60 * 24 * 7, tags: [`weekly-editorial-${weekIndex}`] },
  )();
}

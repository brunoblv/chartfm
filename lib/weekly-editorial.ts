import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { buildWeeklyEditorial } from "@/lib/editorial-generator";
import type { GlobalChartEntry } from "@/lib/types";

async function resolveWeeklyEditorialBody(
  weekIndex: number,
  weekLabel: string,
  globalChart: GlobalChartEntry[],
  publishersThisWeek: number,
): Promise<string | null> {
  const stored = await prisma.weeklyEditorial.findUnique({
    where: { weekIndex },
    select: { body: true },
  });
  if (stored?.body?.trim()) return stored.body.trim();

  return buildWeeklyEditorial(globalChart, weekLabel, publishersThisWeek);
}

export function getWeeklyEditorialBody(
  weekIndex: number,
  weekLabel: string,
  globalChart: GlobalChartEntry[],
  publishersThisWeek: number,
): Promise<string | null> {
  return unstable_cache(
    () => resolveWeeklyEditorialBody(weekIndex, weekLabel, globalChart, publishersThisWeek),
    [`weekly-editorial-${weekIndex}`],
    { revalidate: 60 * 60 * 24 * 7, tags: [`weekly-editorial-${weekIndex}`] },
  )();
}

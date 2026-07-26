import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { buildWeeklyEditorial } from "@/lib/editorial-generator";
import type { GlobalChartEntry } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";

async function resolveWeeklyEditorialBody(
  weekIndex: number,
  weekLabel: string,
  globalChart: GlobalChartEntry[],
  publishersThisWeek: number,
  locale: Locale,
): Promise<string | null> {
  // Override manual do admin fica só em pt-BR; em inglês sempre geramos a partir dos dados.
  if (locale === "pt-BR") {
    const stored = await prisma.weeklyEditorial.findUnique({
      where: { weekIndex },
      select: { body: true },
    });
    if (stored?.body?.trim()) return stored.body.trim();
  }

  return buildWeeklyEditorial(globalChart, weekLabel, publishersThisWeek, locale);
}

export function getWeeklyEditorialBody(
  weekIndex: number,
  weekLabel: string,
  globalChart: GlobalChartEntry[],
  publishersThisWeek: number,
  locale: Locale = "pt-BR",
): Promise<string | null> {
  return unstable_cache(
    () => resolveWeeklyEditorialBody(weekIndex, weekLabel, globalChart, publishersThisWeek, locale),
    [`weekly-editorial-${weekIndex}-${locale}`],
    { revalidate: 60 * 60 * 24 * 7, tags: [`weekly-editorial-${weekIndex}`] },
  )();
}

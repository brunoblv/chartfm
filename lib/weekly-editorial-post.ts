import { prisma } from "@/lib/prisma";
import { getOrCreateRankingWeekSnapshot } from "@/lib/global-snapshot";
import { buildWeeklyEditorial } from "@/lib/editorial-generator";
import { revalidateEditorialPaths } from "@/lib/editorial-picks";
import { buildSongPath } from "@/lib/music-routes";
import type { GlobalChartEntry } from "@/lib/types";

function buildWeeklyEditorialParagraphs(
  entries: GlobalChartEntry[],
  weekLabel: string,
  publishersThisWeek: number,
): string[] | null {
  const body = buildWeeklyEditorial(entries, weekLabel, publishersThisWeek);
  if (!body) return null;
  // buildWeeklyEditorial junta as frases num único parágrafo; separamos de volta
  // em blocos temáticos (líder, movimentação, estreias/retornos) para leitura mais fluida.
  const sentences = body.split(/(?<=[.!?])\s+/).filter(Boolean);
  const paragraphs: string[] = [];
  let current: string[] = [];
  for (const sentence of sentences) {
    current.push(sentence);
    if (current.length >= 2) {
      paragraphs.push(current.join(" "));
      current = [];
    }
  }
  if (current.length > 0) paragraphs.push(current.join(" "));
  return paragraphs;
}

/**
 * Gera (se ainda não existir) o post editorial semanal do Global 100 a partir de
 * dados reais da semana já congelada — sem IA, 100% derivado de aggregateGlobalSongs.
 * Idempotente: usa slug único por weekIndex, então rodar de novo não duplica.
 */
export async function publishWeeklyEditorialPostForWeek(
  weekIndex: number,
  publishedAt: Date = new Date(),
): Promise<{ created: boolean; slug: string } | null> {
  const row = await prisma.globalSnapshot.findUnique({
    where: { weekIndex },
    select: { weekLabel: true, weeklySongs: true },
  });
  if (!row) return null;

  const weekLabel = row.weekLabel;
  const entries = row.weeklySongs as unknown as GlobalChartEntry[];
  if (!entries.length) return null;

  const slug = `panorama-global-100-semana-${weekIndex}`;
  const existing = await prisma.editorialPost.findUnique({ where: { slug }, select: { id: true } });
  if (existing) return { created: false, slug };

  const publishersThisWeek = (
    await prisma.chart.groupBy({ by: ["userId"], where: { weekIndex } })
  ).length;

  const paragraphs = buildWeeklyEditorialParagraphs(entries, weekLabel, publishersThisWeek);
  if (!paragraphs || paragraphs.length === 0) return null;

  const leader = entries[0];
  const title = `Panorama do Global 100 - semana de ${weekLabel}`;
  const excerpt = `Como foi a semana de ${weekLabel} no Global 100 do ChartFM: liderança, maiores subidas e quedas, estreias e retornos.`;

  await prisma.editorialPost.create({
    data: {
      slug,
      title,
      category: "editorial",
      publishedAt,
      author: "Equipe ChartFM",
      excerpt,
      paragraphs,
      tags: ["global-100", "panorama-semanal"],
      relatedLinks: [
        { label: "Ver Global 100 completo", href: `/global/100?week=${weekIndex}` },
        { label: "Como funciona o Global 100", href: "/guides/como-funciona-o-global-100" },
        ...(leader
          ? [
              {
                label: `Ver "${leader.song.title}"`,
                href: buildSongPath({
                  title: leader.song.title,
                  artist: leader.song.artist,
                  slugArtist: leader.song.slugArtist,
                  id: leader.song.id,
                  artistRefId: leader.song.artistRefId,
                  spotifyId: leader.song.spotifyId,
                }),
              },
            ]
          : []),
      ],
      published: true,
    },
  });

  await revalidateEditorialPaths(slug);
  return { created: true, slug };
}

export async function publishWeeklyEditorialPost(now: Date = new Date()): Promise<
  { created: boolean; slug: string } | null
> {
  const { weekIndex } = await getOrCreateRankingWeekSnapshot(now);
  return publishWeeklyEditorialPostForWeek(weekIndex, now);
}

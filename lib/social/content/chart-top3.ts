import { prisma } from "@/lib/prisma";
import { buildHashtags } from "@/lib/social/hashtags";
import { formatSongArtist } from "@/lib/song-artist";
import { computeChartHighlights, computeCatalogMilestones, type HighlightSourceEntry } from "@/lib/social/content/chart-highlights";
import { buildVariedChartNarrative } from "@/lib/social/content/caption-variety";

export type ChartTop3EventType = "GLOBAL100_PUBLISHED" | "AIRPLAY_PUBLISHED" | "ALBUMS_CHART_PUBLISHED";

export type ChartEntryStatus = "new" | "return" | "up" | "down" | "same";

export type ChartTop3Content = {
  chartName: string;
  weekLabel: string;
  /** Até 5 posições (feed/telegram usam só as 3 primeiras; o story usa as 5). */
  top3: { position: number; title: string; artist: string; coverUrl: string | null; status: ChartEntryStatus; delta: number | null }[];
  editorialLine: string | null;
  targetUrl: string;
  hashtags: string[];
};

const CHART_NAME: Record<ChartTop3EventType, string> = {
  GLOBAL100_PUBLISHED: "Global 100",
  AIRPLAY_PUBLISHED: "Global 100 Air Play",
  ALBUMS_CHART_PUBLISHED: "Global 100 Álbuns",
};

const TARGET_URL: Record<ChartTop3EventType, string> = {
  GLOBAL100_PUBLISHED: "/global/100",
  AIRPLAY_PUBLISHED: "/global/airplay",
  ALBUMS_CHART_PUBLISHED: "/global/albums",
};

const MAX_ENTRIES = 5;

type RawEntry = {
  position: number;
  song: { title: string; artist: string; featArtists?: string[]; imageUrl?: string | null };
  cover?: { imageUrl?: string | null };
  status: ChartEntryStatus;
  delta: number | null;
};

/** Busca os dados reais (já congelados) do Top 3 do Global 100 daquela semana — nunca inventa dados. */
async function loadGlobal100Top3(weekIndex: number): Promise<ChartTop3Content | null> {
  const snapshot = await prisma.globalSnapshot.findUnique({ where: { weekIndex }, select: { weeklySongs: true, weekLabel: true } });
  if (!snapshot) return null;
  const weeklySongs = snapshot.weeklySongs as unknown as (RawEntry & HighlightSourceEntry)[];
  if (!weeklySongs.length) return null;

  const top = weeklySongs.slice(0, MAX_ENTRIES);
  const editorialLine = await buildEditorialLine("GLOBAL100_PUBLISHED", weekIndex, snapshot.weekLabel, weeklySongs, top);

  return {
    chartName: CHART_NAME.GLOBAL100_PUBLISHED,
    weekLabel: snapshot.weekLabel,
    top3: top.map((e) => ({
      position: e.position,
      title: e.song.title,
      artist: formatSongArtist({ artist: e.song.artist, featArtists: e.song.featArtists }),
      coverUrl: e.song.imageUrl ?? e.cover?.imageUrl ?? null,
      status: e.status,
      delta: e.delta,
    })),
    editorialLine,
    targetUrl: TARGET_URL.GLOBAL100_PUBLISHED,
    hashtags: buildHashtags(top.map((e) => e.song.artist)),
  };
}

/** Monta o texto narrativo variado (destaques reais da semana) usado como legenda editorial do post. */
async function buildEditorialLine(
  eventType: ChartTop3EventType,
  weekIndex: number,
  weekLabel: string,
  allEntries: HighlightSourceEntry[],
  topEntries: HighlightSourceEntry[],
): Promise<string | null> {
  const highlights = computeChartHighlights(allEntries);
  const candidateArtists = topEntries.slice(0, 3).map((e) => e.song.artist);
  const catalogHighlights = await computeCatalogMilestones(eventType, weekIndex, candidateArtists);
  return buildVariedChartNarrative([...highlights, ...catalogHighlights], CHART_NAME[eventType], weekLabel);
}

async function loadLastfmTop3(mode: "airplay" | "albums", eventType: "AIRPLAY_PUBLISHED" | "ALBUMS_CHART_PUBLISHED", weekIndex: number): Promise<ChartTop3Content | null> {
  const row =
    mode === "airplay"
      ? await prisma.globalAirplaySnapshot.findUnique({ where: { weekIndex }, select: { entries: true, weekLabel: true } })
      : await prisma.globalAlbumsSnapshot.findUnique({ where: { weekIndex }, select: { entries: true, weekLabel: true } });
  if (!row) return null;
  const entries = row.entries as unknown as (RawEntry & HighlightSourceEntry)[];
  if (!entries.length) return null;

  const top = entries.slice(0, MAX_ENTRIES);
  const editorialLine = await buildEditorialLine(eventType, weekIndex, row.weekLabel, entries, top);

  return {
    chartName: CHART_NAME[eventType],
    weekLabel: row.weekLabel,
    top3: top.map((e) => ({
      position: e.position,
      title: e.song.title,
      artist: formatSongArtist({ artist: e.song.artist }),
      coverUrl: e.song.imageUrl ?? e.cover?.imageUrl ?? null,
      status: e.status,
      delta: e.delta,
    })),
    editorialLine,
    targetUrl: TARGET_URL[eventType],
    hashtags: buildHashtags(top.map((e) => e.song.artist)),
  };
}

/** Carrega o Top 3 real (já publicado/congelado) de uma edição de chart, para montar o post social. */
export async function loadChartTop3Content(eventType: ChartTop3EventType, weekIndex: number): Promise<ChartTop3Content | null> {
  if (eventType === "GLOBAL100_PUBLISHED") return loadGlobal100Top3(weekIndex);
  if (eventType === "AIRPLAY_PUBLISHED") return loadLastfmTop3("airplay", eventType, weekIndex);
  return loadLastfmTop3("albums", eventType, weekIndex);
}

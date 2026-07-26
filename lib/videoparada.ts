import { prisma } from "@/lib/prisma";
import { GLOBAL_GENRE_CHARTS } from "@/lib/global-genre-charts";
import { loadGlobalGenreSnapshot } from "@/lib/global-genre-snapshot";
import type { GlobalSnapshotPayload } from "@/lib/global-snapshot";
import { getRankingWeekReference } from "@/lib/chart-week";
import { getGlobalPublishSlot } from "@/lib/global-publish-schedule";
import {
  VIDEOPARADA_PLATFORMS,
  VIDEOPARADA_SHORTS_SECONDS,
  VIDEOPARADA_YOUTUBE_SECONDS,
  type VideoparadaChartOption,
  type VideoparadaClipConfigInput,
  type VideoparadaEntryRow,
  type VideoparadaPlatform,
  type VideoparadaWeekOption,
} from "@/lib/videoparada-shared";

export {
  VIDEOPARADA_PLATFORMS,
  VIDEOPARADA_SHORTS_SECONDS,
  VIDEOPARADA_YOUTUBE_SECONDS,
  type VideoparadaChartOption,
  type VideoparadaClipConfigInput,
  type VideoparadaEntryRow,
  type VideoparadaPlatform,
  type VideoparadaWeekOption,
} from "@/lib/videoparada-shared";

export function listVideoparadaCharts(): VideoparadaChartOption[] {
  return [
    { kind: "global", label: "Top 100 Global", shortLabel: "Global" },
    { kind: "airplay", label: "Global 100 Air Play", shortLabel: "Air Play" },
    ...GLOBAL_GENRE_CHARTS.map((c) => ({
      kind: `genre:${c.slug}`,
      label: c.name,
      shortLabel: c.shortName,
    })),
  ];
}

export function parseGenreSlug(chartKind: string): string | null {
  if (!chartKind.startsWith("genre:")) return null;
  return chartKind.slice("genre:".length) || null;
}

export function isValidVideoparadaChartKind(chartKind: string): boolean {
  if (chartKind === "global" || chartKind === "airplay") return true;
  const slug = parseGenreSlug(chartKind);
  return Boolean(slug && GLOBAL_GENRE_CHARTS.some((c) => c.slug === slug));
}

export function normalizePlatform(value: unknown): VideoparadaPlatform | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (!v) return null;
  return (VIDEOPARADA_PLATFORMS as readonly string[]).includes(v)
    ? (v as VideoparadaPlatform)
    : null;
}

function inferPlatformFromUrl(url: string | null | undefined): VideoparadaPlatform | null {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes("youtu.be") || u.includes("youtube.com")) return "youtube";
  if (u.includes("vimeo.com")) return "vimeo";
  if (u.includes("dailymotion.com") || u.includes("dai.ly")) return "dailymotion";
  return "other";
}

function asSongEntries(
  weeklySongs: GlobalSnapshotPayload["weeklySongs"] | Array<{
    position: number;
    song: { id?: string | null; title: string; artist: string; imageUrl?: string | null };
    cover?: { imageUrl?: string | null };
    status: string;
    delta: number | null;
    peak?: number;
    weeks?: number;
    numberOnes?: number;
  }>,
): Array<{
  position: number;
  songId: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  status: VideoparadaEntryRow["status"];
  delta: number | null;
  peak: number;
  weeks: number;
  numberOnes: number;
}> {
  const out: ReturnType<typeof asSongEntries> = [];
  for (const e of weeklySongs) {
    const songId = e.song?.id;
    if (!songId) continue;
    const status = e.status as VideoparadaEntryRow["status"];
    out.push({
      position: e.position,
      songId,
      title: e.song.title,
      artist: e.song.artist,
      coverUrl: e.cover?.imageUrl ?? e.song.imageUrl ?? null,
      status: ["new", "return", "up", "down", "same"].includes(status) ? status : "same",
      delta: e.delta,
      peak: typeof e.peak === "number" && e.peak > 0 ? e.peak : e.position,
      weeks: typeof e.weeks === "number" && e.weeks > 0 ? e.weeks : 1,
      numberOnes: typeof e.numberOnes === "number" && e.numberOnes > 0 ? e.numberOnes : 0,
    });
  }
  return out;
}

export async function listVideoparadaWeeks(chartKind: string): Promise<VideoparadaWeekOption[]> {
  if (chartKind === "global") {
    const rows = await prisma.globalSnapshot.findMany({
      select: { weekIndex: true, weekLabel: true, dateRange: true },
      orderBy: { weekIndex: "desc" },
      take: 52,
    });
    return rows;
  }
  if (chartKind === "airplay") {
    const rows = await prisma.globalAirplaySnapshot.findMany({
      select: { weekIndex: true, weekLabel: true, dateRange: true },
      orderBy: { weekIndex: "desc" },
      take: 52,
    });
    return rows;
  }
  const slug = parseGenreSlug(chartKind);
  if (!slug) return [];
  const rows = await prisma.globalGenreSnapshot.findMany({
    where: { genreSlug: slug },
    select: { weekIndex: true, weekLabel: true, dateRange: true },
    orderBy: { weekIndex: "desc" },
    take: 52,
  });
  return rows;
}

export async function resolveDefaultVideoparadaWeek(chartKind: string): Promise<number | null> {
  const weeks = await listVideoparadaWeeks(chartKind);
  if (weeks.length) return weeks[0].weekIndex;
  const rankingWeek = getRankingWeekReference(new Date(), await getGlobalPublishSlot());
  return rankingWeek.weekIndex;
}

async function loadChartEntries(
  chartKind: string,
  weekIndex: number,
): Promise<{
  weekLabel: string;
  dateRange: string;
  entries: ReturnType<typeof asSongEntries>;
} | null> {
  if (chartKind === "global") {
    const row = await prisma.globalSnapshot.findUnique({ where: { weekIndex } });
    if (!row) return null;
    return {
      weekLabel: row.weekLabel,
      dateRange: row.dateRange,
      entries: asSongEntries(row.weeklySongs as unknown as GlobalSnapshotPayload["weeklySongs"]),
    };
  }
  if (chartKind === "airplay") {
    const row = await prisma.globalAirplaySnapshot.findUnique({ where: { weekIndex } });
    if (!row) return null;
    return {
      weekLabel: row.weekLabel,
      dateRange: row.dateRange,
      entries: asSongEntries(row.entries as unknown as GlobalSnapshotPayload["weeklySongs"]),
    };
  }
  const slug = parseGenreSlug(chartKind);
  if (!slug) return null;
  const snap = await loadGlobalGenreSnapshot(weekIndex, slug);
  if (!snap) return null;
  return {
    weekLabel: snap.weekLabel,
    dateRange: snap.dateRange,
    entries: asSongEntries(snap.payload.weeklySongs),
  };
}

export async function getVideoparadaAdminPayload(chartKind: string, weekIndex: number) {
  if (!isValidVideoparadaChartKind(chartKind)) {
    return { error: "chart_kind inválido" as const };
  }

  const chart = await loadChartEntries(chartKind, weekIndex);
  if (!chart) {
    return { error: "Snapshot da parada não encontrado para esta semana." as const };
  }

  const songIds = chart.entries.map((e) => e.songId);
  const [configs, clips] = await Promise.all([
    prisma.paradeVideoClipConfig.findMany({
      where: { chartKind, weekIndex, songId: { in: songIds } },
    }),
    prisma.songVideoClip.findMany({
      where: { songId: { in: songIds }, clipType: "OFFICIAL", youtubeId: { not: null } },
      select: { songId: true, youtubeId: true, votes: true },
      orderBy: { votes: "desc" },
    }),
  ]);

  const configBySong = new Map(configs.map((c) => [c.songId, c]));
  const youtubeBySong = new Map<string, string>();
  for (const clip of clips) {
    if (!clip.youtubeId || youtubeBySong.has(clip.songId)) continue;
    youtubeBySong.set(clip.songId, clip.youtubeId);
  }

  const entries: VideoparadaEntryRow[] = chart.entries.map((e) => {
    const cfg = configBySong.get(e.songId);
    return {
      ...e,
      suggestedYoutubeId: youtubeBySong.get(e.songId) ?? null,
      config: {
        id: cfg?.id ?? null,
        videoUrl: cfg?.videoUrl ?? null,
        platform: cfg?.platform ?? null,
        startSeconds: cfg?.startSeconds ?? null,
        endSeconds: cfg?.endSeconds ?? null,
        useAutoChorus: cfg?.useAutoChorus ?? true,
        forceDebut: cfg?.forceDebut ?? false,
        skipAutoVideo: cfg?.skipAutoVideo ?? false,
        notes: cfg?.notes ?? null,
      },
    };
  });

  const chartMeta = listVideoparadaCharts().find((c) => c.kind === chartKind);

  return {
    chartKind,
    chartLabel: chartMeta?.label ?? chartKind,
    weekIndex,
    weekLabel: chart.weekLabel,
    dateRange: chart.dateRange,
    defaults: {
      shortsSeconds: VIDEOPARADA_SHORTS_SECONDS,
      youtubeSeconds: VIDEOPARADA_YOUTUBE_SECONDS,
    },
    entries,
  };
}

function sanitizeSeconds(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export function normalizeClipConfigInput(raw: Partial<VideoparadaClipConfigInput>): VideoparadaClipConfigInput | string {
  const songId = typeof raw.songId === "string" ? raw.songId.trim() : "";
  if (!songId) return "songId obrigatório";
  const position = Number(raw.position);
  if (!Number.isInteger(position) || position < 1) return "position inválida";

  const videoUrl =
    typeof raw.videoUrl === "string" && raw.videoUrl.trim() ? raw.videoUrl.trim() : null;
  let platform = normalizePlatform(raw.platform);
  if (!platform && videoUrl) platform = inferPlatformFromUrl(videoUrl);

  const startSeconds = sanitizeSeconds(raw.startSeconds);
  const endSeconds = sanitizeSeconds(raw.endSeconds);
  if (startSeconds !== null && endSeconds !== null && endSeconds <= startSeconds) {
    return "Segundo final deve ser maior que o inicial";
  }

  const notes =
    typeof raw.notes === "string" && raw.notes.trim() ? raw.notes.trim().slice(0, 2000) : null;

  return {
    songId,
    position,
    videoUrl,
    platform,
    startSeconds,
    endSeconds,
    useAutoChorus: raw.useAutoChorus !== false,
    forceDebut: Boolean(raw.forceDebut),
    skipAutoVideo: Boolean(raw.skipAutoVideo),
    notes,
  };
}

/** Config manual tem prioridade; se tudo é default vazio, remove o registro. */
function isBlankConfig(input: VideoparadaClipConfigInput): boolean {
  return (
    !input.videoUrl &&
    !input.platform &&
    input.startSeconds === null &&
    input.endSeconds === null &&
    input.useAutoChorus &&
    !input.forceDebut &&
    !input.skipAutoVideo &&
    !input.notes
  );
}

export async function upsertVideoparadaConfigs(
  chartKind: string,
  weekIndex: number,
  items: VideoparadaClipConfigInput[],
) {
  if (!isValidVideoparadaChartKind(chartKind)) {
    throw new Error("chart_kind inválido");
  }
  if (!Number.isInteger(weekIndex) || weekIndex < 1) {
    throw new Error("weekIndex inválido");
  }

  const results: Array<{ songId: string; id: string | null; deleted: boolean }> = [];

  for (const input of items) {
    const key = { chartKind, weekIndex, songId: input.songId };
    if (isBlankConfig(input)) {
      await prisma.paradeVideoClipConfig.deleteMany({ where: key });
      results.push({ songId: input.songId, id: null, deleted: true });
      continue;
    }

    const row = await prisma.paradeVideoClipConfig.upsert({
      where: { chartKind_weekIndex_songId: key },
      create: {
        ...key,
        position: input.position,
        videoUrl: input.videoUrl,
        platform: input.platform,
        startSeconds: input.startSeconds,
        endSeconds: input.endSeconds,
        useAutoChorus: input.useAutoChorus,
        forceDebut: input.forceDebut,
        skipAutoVideo: input.skipAutoVideo,
        notes: input.notes,
      },
      update: {
        position: input.position,
        videoUrl: input.videoUrl,
        platform: input.platform,
        startSeconds: input.startSeconds,
        endSeconds: input.endSeconds,
        useAutoChorus: input.useAutoChorus,
        forceDebut: input.forceDebut,
        skipAutoVideo: input.skipAutoVideo,
        notes: input.notes,
      },
    });
    results.push({ songId: input.songId, id: row.id, deleted: false });
  }

  return results;
}

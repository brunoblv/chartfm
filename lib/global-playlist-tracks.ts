import { prisma } from "@/lib/prisma";
import { loadGlobalGenreSnapshot } from "@/lib/global-genre-snapshot";
import { computeGlobalGenreChartData } from "@/lib/global-genre-chart";
import { getGlobalGenreChart } from "@/lib/global-genre-charts";
import { loadGlobalLastfmSnapshot } from "@/lib/global-lastfm-snapshot";
import type { GlobalSnapshotPayload } from "@/lib/global-snapshot";
import { listSpotifyAlbumTracks } from "@/lib/spotify-server";

export type GlobalPlaylistKind = "global100" | "genre" | "airplay" | "albums";
export type GlobalPlaylistPeriod = "weekly" | "overall";

export type GlobalPlaylistSource = {
  kind: GlobalPlaylistKind;
  weekIndex: number;
  genreSlug?: string;
  period?: GlobalPlaylistPeriod;
};

type SongWithSpotify = { song: { spotifyId?: string | null } };

function dedupeTrackIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const t = id.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function trackIdsFromSongEntries(entries: SongWithSpotify[]): string[] {
  return dedupeTrackIds(entries.map((e) => e.song.spotifyId?.trim() || "").filter(Boolean));
}

async function trackIdsFromLastfmEntries(
  entries: Array<{ song: { spotifyId?: string | null; albumSpotifyId?: string | null } }>,
  mode: "airplay" | "albums",
): Promise<string[]> {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const e of entries) {
    let trackId = e.song.spotifyId?.trim() || null;
    if (!trackId && mode === "albums") {
      const albumId = e.song.albumSpotifyId?.trim();
      if (albumId) {
        const tracks = await listSpotifyAlbumTracks(albumId);
        trackId = tracks[0]?.spotifyId ?? null;
      }
    }
    if (trackId && !seen.has(trackId)) {
      seen.add(trackId);
      ids.push(trackId);
    }
  }

  return ids;
}

function songsForPeriod(
  payload: GlobalSnapshotPayload,
  period: GlobalPlaylistPeriod,
): SongWithSpotify[] {
  return period === "overall" ? payload.overallSongs : payload.weeklySongs;
}

export async function resolveGlobalPlaylistTrackIds(source: GlobalPlaylistSource): Promise<{
  trackIds: string[];
  totalEntries: number;
  chartName: string;
  weekLabel: string;
  dateRange: string;
}> {
  const period: GlobalPlaylistPeriod = source.period ?? "weekly";

  if (source.kind === "global100") {
    const row = await prisma.globalSnapshot.findUnique({
      where: { weekIndex: source.weekIndex },
      select: {
        weekLabel: true,
        dateRange: true,
        weeklySongs: true,
        overallSongs: true,
      },
    });
    if (!row) {
      throw new Error("Parada global não encontrada para esta semana.");
    }

    const payload: GlobalSnapshotPayload = {
      weeklySongs: row.weeklySongs as unknown as GlobalSnapshotPayload["weeklySongs"],
      weeklyArtists: [],
      overallSongs: row.overallSongs as unknown as GlobalSnapshotPayload["overallSongs"],
      overallArtists: [],
    };
    const entries = songsForPeriod(payload, period);
    return {
      trackIds: trackIdsFromSongEntries(entries),
      totalEntries: entries.length,
      chartName: period === "overall" ? "Global 100 Overall" : "Global 100",
      weekLabel: row.weekLabel,
      dateRange: row.dateRange,
    };
  }

  if (source.kind === "genre") {
    const slug = source.genreSlug?.trim();
    const chart = slug ? getGlobalGenreChart(slug) : undefined;
    if (!chart) {
      throw new Error("Parada por gênero inválida.");
    }

    const meta = await prisma.globalSnapshot.findUnique({
      where: { weekIndex: source.weekIndex },
      select: { weekLabel: true, dateRange: true },
    });
    const snapshot = await loadGlobalGenreSnapshot(source.weekIndex, slug!);
    const payload =
      snapshot?.payload ??
      (await computeGlobalGenreChartData(source.weekIndex, slug!));
    const entries = songsForPeriod(payload, period);

    return {
      trackIds: trackIdsFromSongEntries(entries),
      totalEntries: entries.length,
      chartName: period === "overall" ? `${chart.name} Overall` : chart.name,
      weekLabel: snapshot?.weekLabel ?? meta?.weekLabel ?? `Semana ${source.weekIndex}`,
      dateRange: snapshot?.dateRange ?? meta?.dateRange ?? "",
    };
  }

  if (source.kind === "airplay" || source.kind === "albums") {
    const mode = source.kind === "albums" ? "albums" : "airplay";
    const snapshot = await loadGlobalLastfmSnapshot(mode, source.weekIndex);
    if (!snapshot) {
      throw new Error("Parada global não encontrada para esta semana.");
    }

    const chartName = mode === "albums" ? "Global 100 Álbuns" : "Global 100 Air Play";
    const entries = snapshot.payload.entries ?? [];

    return {
      trackIds: await trackIdsFromLastfmEntries(entries, mode),
      totalEntries: entries.length,
      chartName,
      weekLabel: snapshot.weekLabel,
      dateRange: snapshot.dateRange,
    };
  }

  throw new Error("Tipo de parada global inválido.");
}

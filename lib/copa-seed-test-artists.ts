import type { PrismaClient } from "@prisma/client";
import {
  buildWeeklyBucketsFromChartRows,
  currentWeekIdxBrt,
  deserializeWeeklyBuckets,
  globalStatsForSongKeys,
  songKey,
  type WeeklyBucketsSerialized,
} from "@/lib/chart-page-common";
import { getArtistColor, getArtistInitials, COPA_UNASSIGNED_GROUP } from "@/lib/copa";
import { GLOBAL_RANKING_FIRST_WEEK_INDEX } from "@/lib/global-ranking-config";

export const COPA_TEST_BOT_HANDLE = "copa-test-bot";
export const DEFAULT_ARTIST_COUNT = 7;
export const MIN_CHARTED_SINGLES = 8;
export const SINGLES_PER_ARTIST = 8;

export type ChartedArtistPick = {
  spotifyId: string;
  name: string;
  imageUrl: string | null;
  songs: { songId: string | null; title: string; peak: number; weeks: number }[];
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function loadGlobalWeeklyBuckets(prisma: PrismaClient) {
  const cached = await prisma.dailyChartSongStats.findFirst({
    orderBy: { snapshotDay: "desc" },
  });
  if (cached) {
    return {
      weeklyBuckets: deserializeWeeklyBuckets(cached.weeklyBuckets as WeeklyBucketsSerialized),
      currentWeekIdx: cached.currentWeekIdx,
    };
  }

  const rows = await prisma.chartEntry.findMany({
    where: { chart: { isPublished: true } },
    select: {
      position: true,
      points: true,
      chart: { select: { weekIndex: true } },
      song: { select: { title: true, artist: true } },
    },
  });

  return {
    weeklyBuckets: buildWeeklyBucketsFromChartRows(rows),
    currentWeekIdx: currentWeekIdxBrt(),
  };
}

function globalEraBuckets(buckets: Map<number, Map<string, number>>) {
  const out = new Map<number, Map<string, number>>();
  for (const [wk, bySong] of buckets) {
    if (wk >= GLOBAL_RANKING_FIRST_WEEK_INDEX) out.set(wk, bySong);
  }
  return out;
}

/**
 * Artistas com pelo menos 8 singles distintos que já entraram no top 100 do Global 100.
 * Usa daily_chart_song_stats + tabela songs (mesma lógica da página do artista),
 * não o JSON dos snapshots — que muitas vezes não traz artistSpotifyId.
 */
export async function findQualifyingCopaArtists(
  prisma: PrismaClient,
  excludeSpotifyIds: Set<string>,
): Promise<ChartedArtistPick[]> {
  const { weeklyBuckets, currentWeekIdx } = await loadGlobalWeeklyBuckets(prisma);
  const eraBuckets = globalEraBuckets(weeklyBuckets);

  const chartedKeys = new Set<string>();
  for (const [, bySong] of eraBuckets) {
    const top100 = [...bySong.entries()].sort((a, b) => b[1] - a[1]).slice(0, 100);
    for (const [key] of top100) chartedKeys.add(key);
  }
  if (chartedKeys.size === 0) return [];

  const songs = await prisma.song.findMany({
    where: { artistSpotifyId: { not: null } },
    select: {
      id: true,
      title: true,
      artist: true,
      artistSpotifyId: true,
      artistRef: { select: { spotifyId: true, name: true, exhibitionName: true, imageUrl: true } },
    },
  });

  const relevant = songs.filter((s) => chartedKeys.has(songKey(s.title, s.artist)));
  if (relevant.length === 0) return [];

  const globalStats = globalStatsForSongKeys(
    relevant.map((s) => songKey(s.title, s.artist)),
    eraBuckets,
    currentWeekIdx,
  );

  type ArtistAcc = {
    spotifyId: string;
    name: string;
    imageUrl: string | null;
    songs: Map<string, { songId: string; title: string; peak: number; weeks: number }>;
  };

  const byArtist = new Map<string, ArtistAcc>();

  for (const song of relevant) {
    const sid = song.artistRef?.spotifyId ?? song.artistSpotifyId;
    if (!sid || excludeSpotifyIds.has(sid)) continue;

    const key = songKey(song.title, song.artist);
    const gs = globalStats.get(key);
    if (!gs || gs.weeks === 0) continue;

    let acc = byArtist.get(sid);
    if (!acc) {
      acc = {
        spotifyId: sid,
        name: song.artistRef?.exhibitionName?.trim() || song.artistRef?.name || song.artist,
        imageUrl: song.artistRef?.imageUrl ?? null,
        songs: new Map(),
      };
      byArtist.set(sid, acc);
    }

    if (song.artistRef?.name) {
      acc.name = song.artistRef.exhibitionName?.trim() || song.artistRef.name;
    }
    if (!acc.imageUrl && song.artistRef?.imageUrl) {
      acc.imageUrl = song.artistRef.imageUrl;
    }

    acc.songs.set(song.id, {
      songId: song.id,
      title: song.title,
      peak: gs.peak === 9999 ? 0 : gs.peak,
      weeks: gs.weeks,
    });
  }

  const missingMeta = [...byArtist.values()].filter((a) => !a.imageUrl);
  if (missingMeta.length > 0) {
    const metaRows = await prisma.artist.findMany({
      where: { spotifyId: { in: missingMeta.map((a) => a.spotifyId) } },
      select: { spotifyId: true, name: true, exhibitionName: true, imageUrl: true },
    });
    for (const row of metaRows) {
      const acc = byArtist.get(row.spotifyId);
      if (!acc) continue;
      acc.name = row.exhibitionName?.trim() || row.name;
      if (row.imageUrl) acc.imageUrl = row.imageUrl;
    }
  }

  return [...byArtist.values()]
    .filter((a) => a.songs.size >= MIN_CHARTED_SINGLES)
    .map((a) => ({
      spotifyId: a.spotifyId,
      name: a.name,
      imageUrl: a.imageUrl,
      songs: [...a.songs.values()]
        .sort((x, y) => x.peak - y.peak || y.weeks - x.weeks)
        .slice(0, SINGLES_PER_ARTIST)
        .map((s) => ({
          songId: s.songId,
          title: s.title,
          peak: s.peak,
          weeks: s.weeks,
        })),
    }));
}

export type SeedCopaTestArtistsOptions = {
  copaId: string;
  ownerHandle?: string;
  count?: number;
};

export type SeedCopaTestArtistsResult = {
  copaId: string;
  ownerHandle: string;
  artists: { id: string; name: string; singles: string[] }[];
};

export async function seedCopaTestArtists(
  prisma: PrismaClient,
  options: SeedCopaTestArtistsOptions,
): Promise<SeedCopaTestArtistsResult> {
  const count = options.count ?? DEFAULT_ARTIST_COUNT;
  const ownerHandle = options.ownerHandle ?? COPA_TEST_BOT_HANDLE;

  const copa = await prisma.copaEdition.findUnique({ where: { id: options.copaId } });
  if (!copa) throw new Error("Copa não encontrada.");
  if (copa.status !== "REGISTRATION") throw new Error("A copa não está em fase de inscrições.");

  const taken = await prisma.copaArtist.findMany({
    where: { copaId: copa.id, artistSpotifyId: { not: null } },
    select: { artistSpotifyId: true },
  });
  const takenIds = new Set(taken.map((a) => a.artistSpotifyId!));

  const qualifying = await findQualifyingCopaArtists(prisma, takenIds);
  if (qualifying.length < count) {
    throw new Error(
      `Só ${qualifying.length} artista(s) com pelo menos 8 singles no Global 100 (precisa ${count}).`,
    );
  }

  const picked = shuffle(qualifying).slice(0, count);

  let owner = await prisma.user.findUnique({ where: { handle: ownerHandle } });
  if (!owner) {
    owner = await prisma.user.create({
      data: {
        handle: ownerHandle,
        name: `Bot Copa (${ownerHandle})`,
        avatarColor: "#6C5CE7",
      },
    });
  }

  let participant = await prisma.copaParticipant.findUnique({
    where: { copaId_userId: { copaId: copa.id, userId: owner.id } },
  });
  if (!participant) {
    participant = await prisma.copaParticipant.create({
      data: { copaId: copa.id, userId: owner.id },
    });
  }

  const existingCount = await prisma.copaArtist.count({
    where: { copaId: copa.id, ownerId: owner.id },
  });
  const slotsLeft = copa.artistsPerUser - existingCount;
  if (slotsLeft <= 0) {
    throw new Error(`@${owner.handle} já tem ${copa.artistsPerUser} artistas nesta copa.`);
  }

  const toAdd = picked.slice(0, Math.min(count, slotsLeft));
  let slotBase = await prisma.copaArtist.count({ where: { copaId: copa.id } });

  const created: SeedCopaTestArtistsResult["artists"] = [];

  for (const artist of toAdd) {
    const copaArtist = await prisma.copaArtist.create({
      data: {
        copaId: copa.id,
        ownerId: owner.id,
        groupLetter: COPA_UNASSIGNED_GROUP,
        slotInGroup: slotBase++,
        artistSpotifyId: artist.spotifyId,
        artistName: artist.name,
        artistImage: artist.imageUrl,
        artistColor: getArtistColor(artist.spotifyId),
        artistInitials: getArtistInitials(artist.name),
        singles: {
          create: artist.songs.map((s, i) => ({
            slotIndex: i,
            songName: s.title,
            songId: s.songId,
          })),
        },
      },
      include: { singles: { orderBy: { slotIndex: "asc" } } },
    });

    created.push({
      id: copaArtist.id,
      name: copaArtist.artistName,
      singles: copaArtist.singles.map((s) => s.songName),
    });
  }

  return {
    copaId: copa.id,
    ownerHandle: owner.handle,
    artists: created,
  };
}

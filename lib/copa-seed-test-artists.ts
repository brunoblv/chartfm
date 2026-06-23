import type { PrismaClient } from "@prisma/client";
import {
  deserializeWeeklyBuckets,
  globalStatsForSongKeys,
  songKey,
  type WeeklyBucketsSerialized,
} from "@/lib/chart-page-common";
import { getArtistColor, getArtistInitials, COPA_UNASSIGNED_GROUP } from "@/lib/copa";
import { GLOBAL_RANKING_FIRST_WEEK_INDEX } from "@/lib/global-ranking-config";

export const COPA_TEST_BOT_HANDLE = "copa-test-bot";
export const DEFAULT_ARTIST_COUNT = 7;
export const MIN_CHARTED_SINGLES = 8; // > 7
export const SINGLES_PER_ARTIST = 7;

type SnapSong = {
  song: {
    id?: string | null;
    title: string;
    artist: string;
    spotifyId?: string | null;
    artistSpotifyId?: string | null;
  };
};

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

/** Artistas com mais de 7 singles distintos que já entraram no Global 100 (snapshots semanais). */
export async function findQualifyingCopaArtists(
  prisma: PrismaClient,
  excludeSpotifyIds: Set<string>,
): Promise<ChartedArtistPick[]> {
  const snapshots = await prisma.globalSnapshot.findMany({
    where: { weekIndex: { gte: GLOBAL_RANKING_FIRST_WEEK_INDEX } },
    select: { weeklySongs: true },
    orderBy: { weekIndex: "asc" },
  });

  const songsByArtist = new Map<string, Map<string, { title: string; artist: string; songId: string | null }>>();

  for (const snap of snapshots) {
    for (const entry of snap.weeklySongs as SnapSong[]) {
      const sid = entry.song.artistSpotifyId?.trim();
      if (!sid || excludeSpotifyIds.has(sid)) continue;
      const dedupeKey = entry.song.spotifyId ?? entry.song.id ?? `${entry.song.title}|${entry.song.artist}`;
      if (!songsByArtist.has(sid)) songsByArtist.set(sid, new Map());
      songsByArtist.get(sid)!.set(dedupeKey, {
        title: entry.song.title,
        artist: entry.song.artist,
        songId: entry.song.id ?? null,
      });
    }
  }

  const qualifyingIds = [...songsByArtist.entries()]
    .filter(([, songs]) => songs.size >= MIN_CHARTED_SINGLES)
    .map(([sid]) => sid);

  if (qualifyingIds.length === 0) return [];

  const artistRows = await prisma.artist.findMany({
    where: { spotifyId: { in: qualifyingIds } },
    select: { spotifyId: true, name: true, exhibitionName: true, imageUrl: true },
  });
  const artistBySpotify = new Map(artistRows.map((a) => [a.spotifyId, a]));

  const cachedStats = await prisma.dailyChartSongStats.findFirst({
    orderBy: { snapshotDay: "desc" },
  });
  const weeklyBuckets = cachedStats
    ? deserializeWeeklyBuckets(cachedStats.weeklyBuckets as WeeklyBucketsSerialized)
    : null;

  const picks: ChartedArtistPick[] = [];

  for (const spotifyId of qualifyingIds) {
    const songsMap = songsByArtist.get(spotifyId)!;
    const meta = artistBySpotify.get(spotifyId);
    const name = meta?.exhibitionName?.trim() || meta?.name || [...songsMap.values()][0]?.title || spotifyId;

    let ranked = [...songsMap.values()].map((s) => ({
      songId: s.songId,
      title: s.title,
      peak: 9999,
      weeks: 0,
    }));

    if (weeklyBuckets) {
      const stats = globalStatsForSongKeys(
        [...songsMap.values()].map((s) => songKey(s.title, s.artist)),
        weeklyBuckets,
        999999,
      );
      ranked = [...songsMap.values()].map((s) => {
        const st = stats.get(songKey(s.title, s.artist));
        return {
          songId: s.songId,
          title: s.title,
          peak: st?.peak ?? 9999,
          weeks: st?.weeks ?? 0,
        };
      });
    }

    ranked.sort((a, b) => a.peak - b.peak || b.weeks - a.weeks);

    picks.push({
      spotifyId,
      name,
      imageUrl: meta?.imageUrl ?? null,
      songs: ranked.slice(0, SINGLES_PER_ARTIST),
    });
  }

  return picks;
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
      `Só ${qualifying.length} artista(s) com mais de 7 singles no Global 100 (precisa ${count}).`,
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

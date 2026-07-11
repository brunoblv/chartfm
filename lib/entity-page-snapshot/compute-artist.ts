import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { COVER_PALETTES } from "@/lib/data";
import {
  loadLatestGlobalWeeklySongPositions,
  loadSongGlobalStatsFromSnapshots,
  resolveSongGlobal100Stats,
  type HistoricalStat,
} from "@/lib/global-snapshot";
import { pointsForPosition, songKey } from "@/lib/chart-page-common";
import { publishedPrimaryParadaChartWhere } from "@/lib/paradas";
import { parseArtistSlug } from "@/lib/music-routes";
import { getSpotifyArtistById } from "@/lib/spotify-server";
import type {
  ArtistAlbumSnapshot,
  ArtistPageSnapshotPayload,
  ArtistSongSnapshot,
  FanSnapshot,
} from "./types";

function artistColor(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return COVER_PALETTES[Math.abs(hash) % COVER_PALETTES.length];
}

function catalogSongCover(songId: string, manual: string | null | undefined): ArtistSongSnapshot["cover"] {
  let hash = 0;
  for (let i = 0; i < songId.length; i++) hash = (hash * 31 + songId.charCodeAt(i)) | 0;
  const pal = COVER_PALETTES[Math.abs(hash) % COVER_PALETTES.length];
  return {
    palette: [pal[0], pal[1]] as [string, string],
    seed: Math.abs(hash) % 1000,
    imageUrl: manual?.trim() || undefined,
  };
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 1000;
}

export async function computeArtistPageSnapshot(
  nameParam: string,
  songGlobalStats?: Map<string, HistoricalStat>,
  currentWeekPositions?: Map<string, number>,
): Promise<ArtistPageSnapshotPayload | null> {
  const parsed = parseArtistSlug(nameParam);
  const artistRef = await prisma.artist.findFirst({
    where:
      parsed.type === "dbId"
        ? { id: parsed.artistId }
        : parsed.type === "spotify"
          ? { spotifyId: parsed.spotifyId }
          : { name: { equals: parsed.name, mode: "insensitive" } },
    select: { id: true, spotifyId: true, name: true, exhibitionName: true, imageUrl: true, spotifyUrl: true },
  });

  const spotifyProfile =
    !artistRef && parsed.type === "spotify" ? await getSpotifyArtistById(parsed.spotifyId) : null;

  const slugNameHint =
    parsed.type === "spotify" && parsed.nameSlug?.trim()
      ? parsed.nameSlug.replace(/-/g, " ").replace(/\s+/g, " ").trim()
      : "";

  const entryOrFilters: Prisma.ChartEntryWhereInput[] = [];
  const spotifyIdsForSong = new Set<string>();
  if (parsed.type === "spotify") spotifyIdsForSong.add(parsed.spotifyId);
  if (artistRef?.spotifyId) spotifyIdsForSong.add(artistRef.spotifyId);
  for (const sid of spotifyIdsForSong) {
    entryOrFilters.push({ song: { artistSpotifyId: sid } });
  }
  const nameCandidates = new Set<string>();
  if (parsed.type === "slug") nameCandidates.add(parsed.name.trim());
  if (artistRef?.name?.trim()) nameCandidates.add(artistRef.name.trim());
  if (slugNameHint) nameCandidates.add(slugNameHint);
  if (spotifyProfile?.name?.trim()) nameCandidates.add(spotifyProfile.name.trim());
  // Correspondência por nome só vale para músicas legadas sem artistSpotifyId vinculado —
  // do contrário, artistas homônimos com spotifyId diferente ficariam misturados.
  for (const n of nameCandidates) {
    if (n) {
      entryOrFilters.push({
        song: { artist: { equals: n, mode: "insensitive" }, artistSpotifyId: null },
      });
    }
  }
  if (artistRef?.id != null) {
    entryOrFilters.push({ song: { feats: { some: { artist: { id: artistRef.id } } } } });
  }
  for (const sid of spotifyIdsForSong) {
    entryOrFilters.push({ song: { feats: { some: { artistSpotifyId: sid } } } });
  }

  if (entryOrFilters.length === 0) return null;

  const canonicalName =
    artistRef?.exhibitionName?.trim() ||
    artistRef?.name ||
    spotifyProfile?.name ||
    (parsed.type === "slug" ? parsed.name : "") ||
    slugNameHint ||
    "Artista";

  const hasArtistIdentity = Boolean(artistRef ?? spotifyProfile);

  const allEntries = await prisma.chartEntry.findMany({
    where: { chart: publishedPrimaryParadaChartWhere, OR: entryOrFilters },
    select: {
      position: true,
      points: true,
      coverPaletteA: true,
      coverPaletteB: true,
      coverSeed: true,
      chart: {
        select: {
          userId: true,
          user: {
            select: { id: true, handle: true, name: true, avatarColor: true, image: true },
          },
        },
      },
      song: {
        select: {
          id: true,
          title: true,
          artist: true,
          album: true,
          spotifyId: true,
          artistSpotifyId: true,
          albumRef: { select: { id: true, coverUrl: true } },
        },
      },
    },
  });

  if (allEntries.length === 0 && !hasArtistIdentity) return null;

  const songCatalogOr: Prisma.SongWhereInput[] = [];
  for (const sid of spotifyIdsForSong) songCatalogOr.push({ artistSpotifyId: sid });
  for (const n of nameCandidates) {
    const t = n?.trim();
    if (t) songCatalogOr.push({ artist: { equals: t, mode: "insensitive" }, artistSpotifyId: null });
  }
  if (artistRef?.id != null) {
    songCatalogOr.push({ feats: { some: { artist: { id: artistRef.id } } } });
  }
  for (const sid of spotifyIdsForSong) {
    songCatalogOr.push({ feats: { some: { artistSpotifyId: sid } } });
  }

  const allRegisteredSongs =
    songCatalogOr.length > 0
      ? await prisma.song.findMany({
          where: { OR: songCatalogOr },
          select: {
            id: true,
            title: true,
            artist: true,
            album: true,
            spotifyId: true,
            artistSpotifyId: true,
            albumRef: { select: { id: true, coverUrl: true } },
          },
          orderBy: [{ title: "asc" }],
        })
      : [];

  const listenersSet = new Set(allEntries.map((e) => e.chart.userId));
  const songsMap = new Map<string, ArtistSongSnapshot>();
  let number1s = 0;
  let totalPoints = 0;

  for (const e of allEntries) {
    const pts = e.points > 0 ? e.points : pointsForPosition(e.position);
    totalPoints += pts;
    if (e.position === 1) number1s += 1;
    const key = songKey(e.song.title, e.song.artist);
    const manual = e.song.albumRef?.coverUrl?.trim() || null;
    const isPrimary =
      e.song.artistSpotifyId != null
        ? spotifyIdsForSong.has(e.song.artistSpotifyId)
        : [...nameCandidates].some((n) => n.toLowerCase() === e.song.artist.trim().toLowerCase());
    const cur = songsMap.get(key) ?? {
      key,
      songId: e.song.id,
      spotifyId: e.song.spotifyId,
      dbArtist: e.song.artist,
      title: e.song.title,
      album: e.song.album ?? "",
      albumRefId: e.song.albumRef?.id ?? null,
      points: 0,
      weeks: 0,
      peak: 9999,
      number1s: 0,
      currentWeekPos: 9999,
      isFeat: !isPrimary,
      cover: {
        palette: [e.coverPaletteA, e.coverPaletteB] as [string, string],
        seed: e.coverSeed,
        imageUrl: manual ?? undefined,
      },
    };
    cur.points += pts;
    if (manual) cur.cover = { ...cur.cover, imageUrl: manual };
    if (cur.albumRefId == null && e.song.albumRef?.id != null) cur.albumRefId = e.song.albumRef.id;
    songsMap.set(key, cur);
  }

  const globalRank = songGlobalStats ?? (await loadSongGlobalStatsFromSnapshots());
  const latestPositions = currentWeekPositions ?? (await loadLatestGlobalWeeklySongPositions());

  const mergedSongsById = new Map<string, ArtistSongSnapshot>();
  const registeredSongIds = new Set(allRegisteredSongs.map((s) => s.id));

  function globalStatsFor(song: { spotifyId: string | null; title: string; artist: string }) {
    return resolveSongGlobal100Stats(
      { spotifyId: song.spotifyId, title: song.title, artist: song.artist },
      globalRank,
      latestPositions,
    );
  }

  for (const db of allRegisteredSongs) {
    const key = songKey(db.title, db.artist);
    const fromChart = songsMap.get(key);
    const gs = globalStatsFor({ spotifyId: db.spotifyId, title: db.title, artist: db.artist });
    const manual = db.albumRef?.coverUrl?.trim() || null;
    const row: ArtistSongSnapshot = fromChart
      ? {
          ...fromChart,
          songId: db.id,
          spotifyId: db.spotifyId ?? fromChart.spotifyId,
          dbArtist: db.artist,
          title: db.title,
          album: db.album ?? fromChart.album,
          albumRefId: db.albumRef?.id ?? fromChart.albumRefId,
          cover: manual ? { ...fromChart.cover, imageUrl: manual } : fromChart.cover,
          weeks: gs.weeks,
          peak: gs.peak,
          number1s: gs.number1s,
          currentWeekPos: gs.currentWeekPos,
        }
      : {
          key,
          songId: db.id,
          spotifyId: db.spotifyId,
          dbArtist: db.artist,
          title: db.title,
          album: db.album ?? "",
          albumRefId: db.albumRef?.id ?? null,
          points: 0,
          isFeat: !(
            db.artistSpotifyId != null
              ? spotifyIdsForSong.has(db.artistSpotifyId)
              : [...nameCandidates].some((n) => n.toLowerCase() === db.artist.trim().toLowerCase())
          ),
          cover: catalogSongCover(db.id, manual),
          weeks: gs.weeks,
          peak: gs.peak,
          number1s: gs.number1s,
          currentWeekPos: gs.currentWeekPos,
        };
    mergedSongsById.set(db.id, row);
  }

  for (const row of songsMap.values()) {
    if (registeredSongIds.has(row.songId)) continue;
    const gs = globalStatsFor({ spotifyId: row.spotifyId, title: row.title, artist: row.dbArtist });
    mergedSongsById.set(row.songId, {
      ...row,
      weeks: gs.weeks,
      peak: gs.peak,
      number1s: gs.number1s,
      currentWeekPos: gs.currentWeekPos,
    });
  }

  const songs = [...mergedSongsById.values()].sort(
    (a, b) => a.currentWeekPos - b.currentWeekPos || b.points - a.points || a.title.localeCompare(b.title),
  );

  const pointsByAlbumDbId = new Map<number, number>();
  const chartPaletteByAlbumDbId = new Map<number, { a: string; b: string; seed: number }>();
  const albumsMapRaw = new Map<
    string,
    { albumId: number | null; name: string; songTitles: Set<string>; points: number; cover: ArtistAlbumSnapshot["cover"] }
  >();
  for (const e of allEntries) {
    const aid = e.song.albumRef?.id;
    if (aid != null) {
      const pts = e.points > 0 ? e.points : pointsForPosition(e.position);
      pointsByAlbumDbId.set(aid, (pointsByAlbumDbId.get(aid) ?? 0) + pts);
      if (!chartPaletteByAlbumDbId.has(aid)) {
        chartPaletteByAlbumDbId.set(aid, { a: e.coverPaletteA, b: e.coverPaletteB, seed: e.coverSeed });
      }
    }
    const albumName = e.song.album?.trim() || "Single";
    if (albumName === "Single") continue;
    const pts = e.points > 0 ? e.points : pointsForPosition(e.position);
    const manual = e.song.albumRef?.coverUrl?.trim() || null;
    const existing = albumsMapRaw.get(albumName);
    if (!existing) {
      albumsMapRaw.set(albumName, {
        albumId: e.song.albumRef?.id ?? null,
        name: albumName,
        songTitles: new Set([e.song.title]),
        points: pts,
        cover: {
          palette: [e.coverPaletteA, e.coverPaletteB] as [string, string],
          seed: e.coverSeed,
          imageUrl: manual,
        },
      });
    } else {
      existing.points += pts;
      existing.songTitles.add(e.song.title);
      if (manual && !existing.cover.imageUrl) existing.cover = { ...existing.cover, imageUrl: manual };
    }
  }

  const spotifyIdsArr = [...spotifyIdsForSong];
  const dbAlbumRows =
    spotifyIdsArr.length > 0
      ? await prisma.album.findMany({
          where: { artistSpotifyId: { in: spotifyIdsArr } },
          select: {
            id: true,
            spotifyId: true,
            title: true,
            coverUrl: true,
            _count: { select: { songs: true } },
          },
          orderBy: [{ releaseDate: "desc" }],
        })
      : [];

  const fromDbAlbums: ArtistAlbumSnapshot[] = dbAlbumRows.map((a) => {
    const pts = pointsByAlbumDbId.get(a.id) ?? 0;
    const palFromChart = chartPaletteByAlbumDbId.get(a.id);
    const pal = palFromChart
      ? ([palFromChart.a, palFromChart.b] as [string, string])
      : artistColor(a.title);
    const manual = a.coverUrl?.trim() || null;
    return {
      albumId: a.id,
      name: a.title,
      songs: a._count.songs,
      points: pts,
      cover: {
        palette: pal,
        seed: palFromChart?.seed ?? hashSeed(a.spotifyId),
        imageUrl: manual ?? undefined,
      },
    };
  });

  const dbAlbumIds = new Set(dbAlbumRows.map((d) => d.id));
  const dbAlbumTitles = new Set(dbAlbumRows.map((d) => d.title.toLowerCase()));

  const fromChartNamesOnly: ArtistAlbumSnapshot[] = [...albumsMapRaw.values()]
    .filter((raw) => {
      if (raw.albumId != null && dbAlbumIds.has(raw.albumId)) return false;
      if (dbAlbumTitles.has(raw.name.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => b.points - a.points)
    .map((a) => ({
      albumId: a.albumId,
      name: a.name,
      songs: a.songTitles.size,
      points: a.points,
      cover: a.cover,
    }));

  const catalogAlbumsFromSongs = new Map<number, ArtistAlbumSnapshot>();
  for (const s of allRegisteredSongs) {
    const ref = s.albumRef;
    if (!ref?.id) continue;
    if (dbAlbumIds.has(ref.id)) continue;
    const name = s.album?.trim() || ref.id.toString();
    const pts = pointsByAlbumDbId.get(ref.id) ?? 0;
    const manual = ref.coverUrl?.trim() || null;
    const pal = chartPaletteByAlbumDbId.get(ref.id);
    const palette = pal ? ([pal.a, pal.b] as [string, string]) : artistColor(name);
    const seed = pal?.seed ?? hashSeed(s.id + String(ref.id));
    const prev = catalogAlbumsFromSongs.get(ref.id);
    const trackCount = (prev?.songs ?? 0) + 1;
    const displayName = (s.album?.trim() || prev?.name || name).trim();
    catalogAlbumsFromSongs.set(ref.id, {
      albumId: ref.id,
      name: displayName,
      songs: trackCount,
      points: pts,
      cover: {
        palette,
        seed,
        imageUrl: manual ?? prev?.cover.imageUrl,
      },
    });
  }

  const allAlbums: ArtistAlbumSnapshot[] = (() => {
    if (fromDbAlbums.length > 0) {
      const byId = new Map<number, ArtistAlbumSnapshot>();
      for (const a of fromDbAlbums) {
        if (a.albumId != null) byId.set(a.albumId, a);
      }
      for (const extra of [...catalogAlbumsFromSongs.values(), ...fromChartNamesOnly]) {
        if (extra.albumId != null && byId.has(extra.albumId)) continue;
        if (extra.albumId != null) byId.set(extra.albumId, extra);
      }
      return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (catalogAlbumsFromSongs.size > 0) {
      return [...catalogAlbumsFromSongs.values()].sort((a, b) => a.name.localeCompare(b.name));
    }
    return [...albumsMapRaw.values()]
      .sort((a, b) => b.points - a.points)
      .map((a) => ({
        albumId: a.albumId,
        name: a.name,
        songs: a.songTitles.size,
        points: a.points,
        cover: a.cover,
      }));
  })();

  const fanMap = new Map<string, FanSnapshot>();
  for (const e of allEntries) {
    const pts = e.points > 0 ? e.points : pointsForPosition(e.position);
    const existing = fanMap.get(e.chart.user.id) ?? {
      user: {
        id: e.chart.user.id,
        handle: e.chart.user.handle,
        name: e.chart.user.name,
        avatar: e.chart.user.avatarColor,
        image: e.chart.user.image,
      },
      points: 0,
    };
    existing.points += pts;
    fanMap.set(e.chart.user.id, existing);
  }
  const bigFans = [...fanMap.values()].sort((a, b) => b.points - a.points).slice(0, 4);

  return {
    builtAt: new Date().toISOString(),
    canonicalName,
    palette: artistColor(canonicalName),
    heroImageUrl: artistRef?.imageUrl ?? spotifyProfile?.imageUrl ?? null,
    heroSpotifyUrl: artistRef?.spotifyUrl ?? spotifyProfile?.spotifyUrl ?? null,
    artistRefId: artistRef?.id ?? null,
    listenersCount: listenersSet.size,
    number1s: songs.reduce((sum, s) => sum + s.number1s, 0),
    totalPoints,
    songs,
    allAlbums,
    bigFans,
  };
}

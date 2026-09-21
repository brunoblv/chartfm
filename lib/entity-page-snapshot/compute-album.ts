import { prisma } from "@/lib/prisma";
import { COVER_PALETTES } from "@/lib/data";
import { pointsForPosition, songKey } from "@/lib/chart-page-common";
import {
  loadSongGlobalStatsFromSnapshots,
  songSnapshotAggKey,
  type HistoricalStat,
} from "@/lib/global-snapshot";
import { parseAlbumSlug, slugify } from "@/lib/music-routes";
import type { AlbumPageSnapshotPayload, AlbumSongSnapshot, FanSnapshot } from "./types";

function albumColor(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return COVER_PALETTES[Math.abs(hash) % COVER_PALETTES.length];
}

export async function computeAlbumPageSnapshot(
  slug: string,
  globalRankStats?: Map<string, HistoricalStat>,
): Promise<AlbumPageSnapshotPayload | null> {
  const parsed = parseAlbumSlug(slug);
  if (!parsed) return null;

  const firstArtistWord =
    parsed.type === "slug"
      ? (parsed.artistSlug.split("-").find((w) => w.length > 0) ?? parsed.artistSlug)
      : null;

  const artistRef =
    parsed.type === "artistAlbumIds"
      ? await prisma.artist.findUnique({
          where: { id: parsed.artistId },
          select: { id: true, spotifyId: true, name: true, imageUrl: true, spotifyUrl: true },
        })
      : await prisma.artist.findFirst({
          where: { name: { contains: firstArtistWord ?? "", mode: "insensitive" } },
          select: { id: true, spotifyId: true, name: true, imageUrl: true, spotifyUrl: true },
        });

  const allEntries = await prisma.chartEntry.findMany({
    where:
      parsed.type === "artistAlbumIds"
        ? {
            chart: { isPublished: true },
            song: {
              albumRef: { id: parsed.albumId },
              artistRef: { id: parsed.artistId },
            },
          }
        : {
            chart: { isPublished: true },
            OR: [
              ...(artistRef?.spotifyId ? [{ song: { artistSpotifyId: artistRef.spotifyId } }] : []),
              { song: { artist: { contains: firstArtistWord ?? "", mode: "insensitive" } } },
            ],
          },
    select: {
      position: true,
      points: true,
      coverPaletteA: true,
      coverPaletteB: true,
      coverSeed: true,
      chart: {
        select: {
          weekIndex: true,
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
          albumRef: { select: { id: true, coverUrl: true, exhibitionName: true, releaseDate: true } },
          artistRef: { select: { id: true } },
        },
      },
    },
  });

  const albumEntries =
    parsed.type === "artistAlbumIds"
      ? allEntries
      : allEntries.filter((e) => slugify(e.song.album ?? "") === parsed.albumSlug);

  if (albumEntries.length === 0) return null;

  const canonicalAlbum =
    (albumEntries[0].song.albumRef?.exhibitionName?.trim() || albumEntries[0].song.album) ?? "";
  const canonicalArtist = artistRef?.name ?? albumEntries[0].song.artist;
  const coverImageUrl =
    albumEntries.find((e) => e.song.albumRef?.coverUrl?.trim())?.song.albumRef?.coverUrl?.trim() ?? null;
  const releaseDate =
    albumEntries.find((e) => e.song.albumRef?.releaseDate)?.song.albumRef?.releaseDate ?? null;
  const firstEntry = albumEntries[0];
  const palette = albumColor(canonicalAlbum + canonicalArtist);

  const songsMap = new Map<string, AlbumSongSnapshot>();
  let totalPoints = 0;

  for (const e of albumEntries) {
    const pts = e.points > 0 ? e.points : pointsForPosition(e.position);
    totalPoints += pts;

    const key = songKey(e.song.title, e.song.artist);
    const manual = e.song.albumRef?.coverUrl?.trim() || null;
    const cur = songsMap.get(key) ?? {
      key,
      songId: e.song.id,
      spotifyId: e.song.spotifyId,
      artistSpotifyId: e.song.artistSpotifyId,
      dbArtist: e.song.artist,
      title: e.song.title,
      points: 0,
      weeks: 0,
      peak: 9999,
      number1s: 0,
      cover: {
        palette: [e.coverPaletteA, e.coverPaletteB] as [string, string],
        seed: e.coverSeed,
        imageUrl: manual ?? undefined,
      },
    };
    cur.points += pts;
    if (manual) cur.cover = { ...cur.cover, imageUrl: manual };
    songsMap.set(key, cur);
  }

  const globalRank = globalRankStats ?? (await loadSongGlobalStatsFromSnapshots());

  const songs = [...songsMap.values()]
    .map((s) => {
      const gs = globalRank.get(
        songSnapshotAggKey({
          spotifyId: s.spotifyId,
          title: s.title,
          artist: s.dbArtist,
          slugArtist: s.dbArtist,
        }),
      );
      return {
        ...s,
        weeks: gs?.weeks ?? 0,
        peak: gs?.peak ?? 0,
        number1s: gs?.numberOnes ?? 0,
      };
    })
    .sort((a, b) => b.points - a.points);

  // Número 1s do álbum precisa somar a mesma métrica (Global 100) exibida na tabela por faixa,
  // não a contagem de posição 1 em paradas de usuários — caso contrário resumo e tabela divergem.
  const number1sAlbum = songs.reduce((sum, s) => sum + s.number1s, 0);

  const fanMap = new Map<string, FanSnapshot>();
  for (const e of albumEntries) {
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
  const topFans = [...fanMap.values()].sort((a, b) => b.points - a.points).slice(0, 4);

  const albumDbId =
    parsed.type === "artistAlbumIds"
      ? parsed.albumId
      : (albumEntries.find((e) => e.song.albumRef?.id)?.song.albumRef?.id ?? null);

  return {
    builtAt: new Date().toISOString(),
    canonicalAlbum,
    canonicalArtist,
    coverImageUrl,
    releaseDate: releaseDate ? releaseDate.toISOString() : null,
    palette,
    coverForHero: {
      palette: [firstEntry.coverPaletteA, firstEntry.coverPaletteB] as [string, string],
      seed: firstEntry.coverSeed,
      imageUrl: coverImageUrl,
    },
    stats: [
      { label: "Pontos totais", value: totalPoints, color: "var(--accent)" },
      { label: "Ouvintes únicos", value: new Set(albumEntries.map((e) => e.chart.userId)).size, color: "#8338EC" },
      { label: "Faixas rankeadas", value: songsMap.size, color: "#3A86FF" },
      { label: "Número 1s", value: number1sAlbum, color: "#FFD700" },
    ],
    songs,
    topFans,
    artistSpotifyId: albumEntries[0].song.artistSpotifyId,
    artistDbId: artistRef?.id ?? albumEntries[0].song.artistRef?.id ?? null,
    albumDbId,
  };
}

import Link from "next/link";
import { ChevronLeft, Play, Star } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import {
  loadLatestGlobalWeeklySongPositions,
  loadSongGlobalStatsFromSnapshots,
  resolveSongGlobal100Stats,
} from "@/lib/global-snapshot";
import { pointsForPosition, songKey } from "@/lib/chart-page-common";
import { artistEntityKey } from "@/lib/entity-page-snapshot/keys";
import { getLatestEntityPageSnapshot } from "@/lib/entity-page-snapshot/store";
import type { ArtistPageSnapshotPayload } from "@/lib/entity-page-snapshot/types";
import { Cover } from "@/components/ui/Cover";
import { Avatar } from "@/components/ui/Avatar";
import { COVER_PALETTES } from "@/lib/data";
import { buildSongPath, parseArtistSlug, buildAlbumPath } from "@/lib/music-routes";
import { authOptions } from "@/lib/auth-options";
import { isPrivilegedRole } from "@/lib/permissions";
import { getSpotifyArtistById } from "@/lib/spotify-server";
import { publishedPrimaryParadaChartWhere } from "@/lib/paradas";
import { buildArtistContext } from "@/lib/entity-context-text";

function artistColor(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return COVER_PALETTES[Math.abs(hash) % COVER_PALETTES.length];
}

const PAGE_SIZE = 10;
const ALBUM_PAGE_SIZE = 12;
const VALID_TABS = ["songs", "albums", "user-songs", "user-albums"] as const;
type Tab = typeof VALID_TABS[number];

function artistPageHref(artistSlug: string, tab: Tab, page = 1): string {
  const q = new URLSearchParams({ tab });
  if (page > 1) q.set("page", String(page));
  return `/artist/${artistSlug}?${q.toString()}`;
}

function catalogSongCover(songId: string, manual: string | null | undefined): SongRow["cover"] {
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

function buildPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

function PaginationBar({
  artistSlug,
  tab,
  palette,
  safePage,
  totalPages,
  totalItems,
  pageSize,
  inCard = true,
}: {
  artistSlug: string;
  tab: Tab;
  palette: [string, string];
  safePage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  inCard?: boolean;
}) {
  if (totalItems <= pageSize) return null;

  return (
    <div
      style={{
        padding: inCard ? "16px 24px" : "16px 0 0",
        borderTop: inCard ? "1px solid var(--divider)" : undefined,
        marginTop: inCard ? undefined : 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <span style={{ fontSize: 13, color: "#86868B" }}>
        {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, totalItems)} de {totalItems}
        {" · "}
        Página {safePage} de {totalPages}
      </span>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {safePage > 1 ? (
          <Link
            href={artistPageHref(artistSlug, tab, safePage - 1)}
            style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--divider-strong)", fontSize: 13, fontWeight: 600, textDecoration: "none", color: "var(--text)" }}
          >
            ←
          </Link>
        ) : (
          <span style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)", fontSize: 13, color: "#C7C7CC" }}>←</span>
        )}
        {buildPageNumbers(safePage, totalPages).map((p, idx) =>
          p === "..." ? (
            <span key={`e-${idx}`} style={{ padding: "6px 4px", fontSize: 13, color: "#86868B" }}>…</span>
          ) : (
            <Link
              key={p}
              href={artistPageHref(artistSlug, tab, p)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                background: p === safePage ? palette[0] : "transparent",
                color: p === safePage ? "white" : "var(--text)",
                border: p === safePage ? "none" : "1px solid var(--divider-strong)",
              }}
            >
              {p}
            </Link>
          ),
        )}
        {safePage < totalPages ? (
          <Link
            href={artistPageHref(artistSlug, tab, safePage + 1)}
            style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--divider-strong)", fontSize: 13, fontWeight: 600, textDecoration: "none", color: "var(--text)" }}
          >
            →
          </Link>
        ) : (
          <span style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)", fontSize: 13, color: "#C7C7CC" }}>→</span>
        )}
      </div>
    </div>
  );
}

type SongRow = {
  key: string;
  songId: string;
  spotifyId: string | null;
  dbArtist: string;
  title: string;
  album: string;
  albumRefId: number | null;
  points: number;
  cover: { palette: [string, string]; seed: number; imageUrl?: string | null };
  weeks: number;
  peak: number;
  number1s: number;
  currentWeekPos: number;
  isFeat?: boolean;
};

type UserSongRow = {
  key: string;
  songId: string;
  spotifyId: string | null;
  dbArtist: string;
  title: string;
  album: string;
  albumRefId: number | null;
  userPoints: number;
  appearances: number;
  bestPosition: number;
  number1s: number;
  cover: { palette: [string, string]; seed: number; imageUrl?: string | null };
};

type AlbumRow = {
  albumId: number | null;
  name: string;
  songs: number;
  points: number;
  cover: { palette: [string, string]; seed: number; imageUrl?: string | null };
};

export default async function ArtistPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const [{ name }, sp] = await Promise.all([params, searchParams]);
  const tab: Tab = VALID_TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "songs";
  const currentPage = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const session = await getServerSession(authOptions);
  const currentUserId = session?.user?.id ?? null;
  const me = currentUserId
    ? await prisma.user.findUnique({ where: { id: currentUserId }, select: { role: true } })
    : null;
  const canEditArtist = isPrivilegedRole(me?.role);

  const parsed = parseArtistSlug(name);
  const artistRef = await prisma.artist.findFirst({
    where:
      parsed.type === "dbId"
        ? { id: parsed.artistId }
        : parsed.type === "spotify"
          ? { spotifyId: parsed.spotifyId }
          : { name: { equals: parsed.name, mode: "insensitive" } },
    select: { id: true, spotifyId: true, name: true, exhibitionName: true, imageUrl: true, spotifyUrl: true, bio: true },
  });

  const cachedSnapshot = await getLatestEntityPageSnapshot<ArtistPageSnapshotPayload>(
    "ARTIST",
    artistEntityKey(parsed, artistRef),
  );

  /** Perfil Spotify quando não há linha em `Artist` (evita URL vazia na query e melhora o hero). */
  const spotifyProfile =
    !artistRef && parsed.type === "spotify" && !cachedSnapshot
      ? await getSpotifyArtistById(parsed.spotifyId)
      : null;

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
  // Músicas onde o artista aparece como feat
  if (artistRef?.id != null) {
    entryOrFilters.push({ song: { feats: { some: { artist: { id: artistRef.id } } } } });
  }
  for (const sid of spotifyIdsForSong) {
    entryOrFilters.push({ song: { feats: { some: { artistSpotifyId: sid } } } });
  }

  if (entryOrFilters.length === 0) {
    return (
      <Shell title="Artista" subtitle="Não encontrado">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>
          <p style={{ fontSize: 16, marginBottom: 20 }}>Não encontramos dados para este artista.</p>
          <Link href="/discover" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
            ← Voltar para descobrir
          </Link>
        </div>
      </Shell>
    );
  }

  const canonicalDbName =
    artistRef?.name?.trim() ||
    (parsed.type === "slug" ? parsed.name.trim() : "") ||
    spotifyProfile?.name?.trim() ||
    slugNameHint ||
    "";
  let canonicalName =
    artistRef?.exhibitionName?.trim() ||
    artistRef?.name ||
    spotifyProfile?.name ||
    (parsed.type === "slug" ? parsed.name : "") ||
    slugNameHint ||
    canonicalDbName ||
    "Artista";
  let palette = artistColor(canonicalName);
  if (cachedSnapshot) {
    canonicalName = cachedSnapshot.payload.canonicalName;
    palette = cachedSnapshot.payload.palette;
  }

  const allEntries = await prisma.chartEntry.findMany({
    where: {
      chart: publishedPrimaryParadaChartWhere,
      OR: entryOrFilters,
    },
    select: {
      position: true,
      points: true,
      coverPaletteA: true,
      coverPaletteB: true,
      coverSeed: true,
      chart: {
        select: {
          id: true,
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
          albumRef: { select: { id: true, coverUrl: true } },
        },
      },
    },
  });

  const hasArtistIdentity = Boolean(artistRef ?? spotifyProfile);
  if (allEntries.length === 0 && !hasArtistIdentity) {
    return (
      <Shell title="Artista" subtitle="Não encontrado">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>
          <p style={{ fontSize: 16, marginBottom: 20 }}>Não encontramos dados para este artista.</p>
          <Link href="/discover" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
            ← Voltar para descobrir
          </Link>
        </div>
      </Shell>
    );
  }

  const songCatalogOr: Prisma.SongWhereInput[] = [];
  for (const sid of spotifyIdsForSong) songCatalogOr.push({ artistSpotifyId: sid });
  for (const n of nameCandidates) {
    const t = n?.trim();
    if (t) songCatalogOr.push({ artist: { equals: t, mode: "insensitive" }, artistSpotifyId: null });
  }
  // Músicas onde o artista aparece como feat
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

  // ── Global stats ──────────────────────────────────────────────────────────
  const listenersSet = new Set(allEntries.map((e) => e.chart.userId));
  const songsMap = new Map<string, SongRow>();
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

  const fanMap = new Map<string, { user: { id: string; handle: string; name: string; avatar: string; image: string | null }; points: number }>();
  for (const e of allEntries) {
    const pts = e.points > 0 ? e.points : pointsForPosition(e.position);
    const existing = fanMap.get(e.chart.user.id) ?? {
      user: { id: e.chart.user.id, handle: e.chart.user.handle, name: e.chart.user.name, avatar: e.chart.user.avatarColor, image: e.chart.user.image },
      points: 0,
    };
    existing.points += pts;
    fanMap.set(e.chart.user.id, existing);
  }

  const pointsByAlbumDbId = new Map<number, number>();
  const chartPaletteByAlbumDbId = new Map<number, { a: string; b: string; seed: number }>();
  const albumsMapRaw = new Map<string, { albumId: number | null; name: string; songTitles: Set<string>; points: number; cover: AlbumRow["cover"] }>();
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
        cover: { palette: [e.coverPaletteA, e.coverPaletteB] as [string, string], seed: e.coverSeed, imageUrl: manual },
      });
    } else {
      existing.points += pts;
      existing.songTitles.add(e.song.title);
      if (manual && !existing.cover.imageUrl) existing.cover = { ...existing.cover, imageUrl: manual };
    }
  }

  let songs: SongRow[];
  let allAlbums: AlbumRow[];
  let bigFans: { user: { id: string; handle: string; name: string; avatar: string; image: string | null }; points: number }[];
  let listenersCount: number;
  let number1sTotal: number;
  let totalPointsCached: number;

  if (cachedSnapshot) {
    const p = cachedSnapshot.payload;
    songs = p.songs as SongRow[];
    allAlbums = p.allAlbums as AlbumRow[];
    bigFans = p.bigFans;
    listenersCount = p.listenersCount;
    number1sTotal = p.number1s;
    totalPointsCached = p.totalPoints;
  } else {
  const mergedSongsById = new Map<string, SongRow>();
  const registeredSongIds = new Set(allRegisteredSongs.map((s) => s.id));

  for (const db of allRegisteredSongs) {
    const key = songKey(db.title, db.artist);
    const fromChart = songsMap.get(key);
    const manual = db.albumRef?.coverUrl?.trim() || null;
    const row: SongRow = fromChart
      ? {
          ...fromChart,
          songId: db.id,
          spotifyId: db.spotifyId ?? fromChart.spotifyId,
          dbArtist: db.artist,
          title: db.title,
          album: db.album ?? fromChart.album,
          albumRefId: db.albumRef?.id ?? fromChart.albumRefId,
          cover: manual ? { ...fromChart.cover, imageUrl: manual } : fromChart.cover,
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
          weeks: 0,
          peak: 0,
          number1s: 0,
          currentWeekPos: 9999,
        };
    mergedSongsById.set(db.id, row);
  }

  for (const row of songsMap.values()) {
    if (registeredSongIds.has(row.songId)) continue;
    mergedSongsById.set(row.songId, { ...row });
  }

  songs = [...mergedSongsById.values()].sort(
    (a, b) => a.currentWeekPos - b.currentWeekPos || b.points - a.points || a.title.localeCompare(b.title),
  );

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

  const fromDbAlbums: AlbumRow[] = dbAlbumRows.map((a) => {
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

  const fromChartNamesOnly: AlbumRow[] = [...albumsMapRaw.values()]
    .filter((raw) => {
      if (raw.albumId != null && dbAlbumIds.has(raw.albumId)) return false;
      if (dbAlbumTitles.has(raw.name.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => b.points - a.points)
    .map((a) => ({ albumId: a.albumId, name: a.name, songs: a.songTitles.size, points: a.points, cover: a.cover }));

  /** Álbuns referenciados por músicas do artista que não estão na lista `Album` deste Spotify id (ex.: outro selo). */
  const catalogAlbumsFromSongs = new Map<number, AlbumRow>();
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

  allAlbums = (() => {
    if (fromDbAlbums.length > 0) {
      const byId = new Map<number, AlbumRow>();
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
      .map((a) => ({ albumId: a.albumId, name: a.name, songs: a.songTitles.size, points: a.points, cover: a.cover }));
  })();

  listenersCount = listenersSet.size;
  number1sTotal = number1s;
  totalPointsCached = totalPoints;
  bigFans = [...fanMap.values()].sort((a, b) => b.points - a.points).slice(0, 4);
  }

  {
    const globalRank = await loadSongGlobalStatsFromSnapshots();
    const latestPositions = await loadLatestGlobalWeeklySongPositions();
    songs = songs
      .map((s) => {
        const gs = resolveSongGlobal100Stats(
          { spotifyId: s.spotifyId, title: s.title, artist: s.dbArtist },
          globalRank,
          latestPositions,
        );
        return { ...s, ...gs };
      })
      .sort(
        (a, b) => a.currentWeekPos - b.currentWeekPos || b.points - a.points || a.title.localeCompare(b.title),
      );
    number1sTotal = songs.reduce((sum, s) => sum + s.number1s, 0);
  }

  if (cachedSnapshot) {
    listenersCount = listenersSet.size;
    totalPointsCached = totalPoints;
    bigFans = [...fanMap.values()].sort((a, b) => b.points - a.points).slice(0, 4);
    songs = songs.map((s) => ({ ...s, points: songsMap.get(s.key)?.points ?? 0 }));
    allAlbums = allAlbums.map((a) => ({
      ...a,
      points:
        a.albumId != null
          ? (pointsByAlbumDbId.get(a.albumId) ?? 0)
          : (albumsMapRaw.get(a.name)?.points ?? 0),
    }));
  }

  // ── Context text (AdSense/SEO) ────────────────────────────────────────────
  // Deriva um parágrafo único a partir dos dados já computados acima (não inventa números).
  const bestSong = songs.reduce<{ title: string; peak: number } | null>((best, s) => {
    if (s.peak <= 0) return best;
    if (!best || s.peak < best.peak) return { title: s.title, peak: s.peak };
    return best;
  }, null);

  const thisWeekSongs = songs.filter((s) => s.currentWeekPos < 9999);
  const thisWeekSongCount = thisWeekSongs.length;
  const thisWeekTopSong = thisWeekSongs.reduce<{ title: string; position: number } | null>((top, s) => {
    if (!top || s.currentWeekPos < top.position) return { title: s.title, position: s.currentWeekPos };
    return top;
  }, null);

  const artistContextText = buildArtistContext({
    name: canonicalName,
    songCount: songs.length,
    listenersCount,
    totalPoints: totalPointsCached,
    bestSong,
    thisWeekSongCount,
    thisWeekTopSong,
  });

  // ── User-specific data ────────────────────────────────────────────────────
  const userEntries = currentUserId ? allEntries.filter((e) => e.chart.userId === currentUserId) : [];

  const userSongsMap = new Map<string, UserSongRow>();
  for (const e of userEntries) {
    const key = songKey(e.song.title, e.song.artist);
    const manual = e.song.albumRef?.coverUrl?.trim() || null;
    const pts = e.points > 0 ? e.points : pointsForPosition(e.position);
    const cur = userSongsMap.get(key) ?? {
      key,
      songId: e.song.id,
      spotifyId: e.song.spotifyId,
      dbArtist: e.song.artist,
      title: e.song.title,
      album: e.song.album ?? "",
      albumRefId: e.song.albumRef?.id ?? null,
      userPoints: 0,
      appearances: 0,
      bestPosition: 9999,
      number1s: 0,
      cover: {
        palette: [e.coverPaletteA, e.coverPaletteB] as [string, string],
        seed: e.coverSeed,
        imageUrl: manual ?? undefined,
      },
    };
    cur.userPoints += pts;
    cur.appearances += 1;
    cur.bestPosition = Math.min(cur.bestPosition, e.position);
    if (e.position === 1) cur.number1s += 1;
    if (manual) cur.cover = { ...cur.cover, imageUrl: manual };
    if (cur.albumRefId == null && e.song.albumRef?.id != null) cur.albumRefId = e.song.albumRef.id;
    userSongsMap.set(key, cur);
  }
  const userSongs = [...userSongsMap.values()].sort((a, b) => b.userPoints - a.userPoints);

  const userAlbumsMapRaw = new Map<string, { albumId: number | null; name: string; songTitles: Set<string>; points: number; cover: AlbumRow["cover"] }>();
  for (const e of userEntries) {
    const albumName = e.song.album?.trim() || "Single";
    if (albumName === "Single") continue;
    const pts = e.points > 0 ? e.points : pointsForPosition(e.position);
    const manual = e.song.albumRef?.coverUrl?.trim() || null;
    const existing = userAlbumsMapRaw.get(albumName);
    if (!existing) {
      userAlbumsMapRaw.set(albumName, {
        albumId: e.song.albumRef?.id ?? null,
        name: albumName,
        songTitles: new Set([e.song.title]),
        points: pts,
        cover: { palette: [e.coverPaletteA, e.coverPaletteB] as [string, string], seed: e.coverSeed, imageUrl: manual },
      });
    } else {
      existing.points += pts;
      existing.songTitles.add(e.song.title);
      if (manual && !existing.cover.imageUrl) existing.cover = { ...existing.cover, imageUrl: manual };
    }
  }
  const userAlbums: AlbumRow[] = [...userAlbumsMapRaw.values()]
    .sort((a, b) => b.points - a.points)
    .map((a) => ({ albumId: a.albumId, name: a.name, songs: a.songTitles.size, points: a.points, cover: a.cover }));

  const userTotalPoints = userSongs.reduce((sum, s) => sum + s.userPoints, 0);
  const userNumber1s = userSongs.reduce((sum, s) => sum + s.number1s, 0);
  const userTotalAppearances = userEntries.length;

  // ── Pagination ────────────────────────────────────────────────────────────
  const activeSongs = tab === "user-songs" ? userSongs : songs;
  const songTotalPages = Math.max(1, Math.ceil(activeSongs.length / PAGE_SIZE));
  const safeSongPage = Math.min(currentPage, songTotalPages);
  const paginatedSongs = activeSongs.slice((safeSongPage - 1) * PAGE_SIZE, safeSongPage * PAGE_SIZE);

  const activeAlbums = tab === "user-albums" ? userAlbums : allAlbums;
  const albumTotalPages = Math.max(1, Math.ceil(activeAlbums.length / ALBUM_PAGE_SIZE));
  const safeAlbumPage = Math.min(currentPage, albumTotalPages);
  const paginatedAlbums = activeAlbums.slice((safeAlbumPage - 1) * ALBUM_PAGE_SIZE, safeAlbumPage * ALBUM_PAGE_SIZE);

  const isUserTab = tab === "user-songs" || tab === "user-albums";
  const showUserStats = isUserTab && Boolean(currentUserId);

  const heroImageUrl =
    artistRef?.imageUrl ?? spotifyProfile?.imageUrl ?? cachedSnapshot?.payload.heroImageUrl ?? null;
  const heroSpotifyUrl =
    artistRef?.spotifyUrl ?? spotifyProfile?.spotifyUrl ?? cachedSnapshot?.payload.heroSpotifyUrl ?? null;
  const globalStats = [
    { label: "Usuários únicos", value: listenersCount, icon: "🎧", color: "#FA243C" },
    { label: "Músicas cadastradas", value: songs.length, icon: "🎵", color: "#8338EC" },
    { label: "Número 1s", value: number1sTotal, icon: "👑", color: "#FFD700" },
    { label: "Pontos totais", value: totalPointsCached, icon: "⭐", color: "#FB5607" },
  ];

  const userStatsCards = [
    { label: "Músicas votadas", value: userSongs.length, icon: "🎵", color: "#8338EC" },
    { label: "Semanas nas paradas", value: userTotalAppearances, icon: "🎧", color: "#FA243C" },
    { label: "#1s seus", value: userNumber1s, icon: "👑", color: "#FFD700" },
    { label: "Seus pontos", value: userTotalPoints, icon: "⭐", color: "#FB5607" },
  ];

  const activeStats = showUserStats ? userStatsCards : isUserTab ? [] : globalStats;

  const globalSubTabs: { id: Tab; label: string }[] = [
    { id: "songs", label: "Músicas" },
    { id: "albums", label: "Álbuns" },
  ];

  const userSubTabs: { id: Tab; label: string }[] = [
    { id: "user-songs", label: "Músicas" },
    { id: "user-albums", label: "Álbuns" },
  ];

  const subTabs = isUserTab ? userSubTabs : globalSubTabs;

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <Shell title="" noPadding>
      {/* Hero */}
      <div style={{
        background: `linear-gradient(180deg, ${palette[0]} 0%, ${palette[1]} 50%, var(--bg) 100%)`,
        padding: "48px 40px 40px 40px",
      }}>
        <Link href="/discover" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: 500, textDecoration: "none", marginBottom: 32 }}>
          <ChevronLeft size={16} />
          Voltar
        </Link>
        <div style={{ display: "flex", gap: 40, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{
            width: 200, height: 200, borderRadius: "50%", flexShrink: 0,
            background: heroImageUrl
              ? `url(${heroImageUrl}) center/cover no-repeat`
              : `radial-gradient(circle at 30% 30%, ${palette[1]}, ${palette[0]})`,
            boxShadow: "0 16px 40px rgba(0,0,0,0.3)",
          }} />
          <div style={{ color: "white", flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.8, marginBottom: 8 }}>Artista</div>
            <h1 style={{ fontSize: 72, fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 1, marginBottom: 16 }}>{canonicalName}</h1>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 14, opacity: 0.9, marginBottom: 24 }}>
              {showUserStats ? (
                <>
                  <span><strong>{userSongs.length}</strong> músicas votadas</span>
                  <span><strong>{userTotalAppearances}</strong> semanas nas paradas</span>
                  <span><strong>{userNumber1s}</strong> #1s seus</span>
                  <span><strong>{userTotalPoints}</strong> seus pontos</span>
                </>
              ) : (
                <>
                  <span><strong>{listenersCount}</strong> ouvintes</span>
                  <span><strong>{songs.length}</strong> músicas cadastradas</span>
                  <span><strong>{number1sTotal}</strong> #1s</span>
                  <span><strong>{totalPointsCached}</strong> pontos</span>
                </>
              )}
            </div>
            <a
              href={heroSpotifyUrl ?? `https://open.spotify.com/search/${encodeURIComponent(canonicalName)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "white", color: palette[0], padding: "12px 24px", borderRadius: 100, fontSize: 14, fontWeight: 700, textDecoration: "none" }}
            >
              <Play size={16} fill={palette[0]} />
              Ouvir
            </a>
            {canEditArtist && artistRef?.id ? (
              <div style={{ marginTop: 10 }}>
                <Link href={`/artist/${name}/edit`} style={{ color: "white", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
                  Editar artista
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div style={{ padding: "36px 40px 80px 40px" }}>
        {/* Super-tab nav: Global 100 | Do usuário */}
        <div style={{ display: "flex", gap: 0, marginBottom: 0, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
          {(["songs", "user-songs"] as const).map((superTab) => {
            const isActive = isUserTab ? superTab === "user-songs" : superTab === "songs";
            const label = superTab === "songs" ? "Global 100" : "Do usuário";
            // preserve the sub-tab (music vs album) when switching super-tab
            const targetTab = superTab === "songs"
              ? (tab === "user-albums" ? "albums" : "songs")
              : (tab === "albums" ? "user-albums" : "user-songs");
            return (
              <Link
                key={superTab}
                href={artistPageHref(name, isActive ? tab : targetTab)}
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: isActive ? 700 : 500,
                  textDecoration: "none",
                  color: isActive ? palette[0] : "#86868B",
                  borderBottom: `2px solid ${isActive ? palette[0] : "transparent"}`,
                  marginBottom: -1,
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <div
          style={{
            marginBottom: 40,
            padding: "28px 30px",
            background: "var(--surface)",
            border: "1px solid var(--divider)",
            borderRadius: 20,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--accent)",
              marginBottom: 6,
            }}
          >
            No ChartFM
          </div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "var(--text)",
              marginBottom: 16,
            }}
          >
            {canonicalName} na comunidade
          </h2>
          {artistRef?.bio && (
            <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-subtle)", marginBottom: 16 }}>
              {artistRef.bio}
            </p>
          )}
          {artistContextText && (
            <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-subtle)" }}>
              {artistContextText}
            </p>
          )}
          <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-muted)", marginTop: 16 }}>
            Esta página reúne o desempenho de todas as músicas do artista nas paradas da comunidade, com pontos
            acumulados, semanas no ranking, pico e número de vezes em 1º lugar no Global 100. As músicas que estão
            no Global 100 nesta semana aparecem primeiro, ordenadas pela posição atual; as demais são listadas por
            pontos acumulados.
          </p>
        </div>

        {/* Stats cards */}
        {activeStats.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 28, marginBottom: 28 }}>
            {activeStats.map((s) => (
              <div key={s.label} style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: s.color + "18", display: "grid", placeItems: "center", marginBottom: 12, fontSize: 22 }}>{s.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Sub-tab nav: Músicas | Álbuns */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid rgba(0,0,0,0.06)", paddingBottom: 0 }}>
          {subTabs.map((t) => (
            <Link
              key={t.id}
              href={artistPageHref(name, t.id)}
              style={{
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                borderRadius: "8px 8px 0 0",
                color: tab === t.id ? palette[0] : "#86868B",
                borderBottom: tab === t.id ? `2px solid ${palette[0]}` : "2px solid transparent",
                marginBottom: -1,
                transition: "color 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {/* Tab: Músicas / Músicas na parada */}
        {(tab === "songs" || tab === "user-songs") && (
          <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", marginBottom: 40 }}>
            {tab === "user-songs" && !currentUserId ? (
              <div style={{ padding: 48, textAlign: "center", color: "#86868B" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--text)" }}>Faça login para ver suas músicas</div>
                <div style={{ fontSize: 14, marginBottom: 20 }}>Veja quais músicas deste artista aparecem nas suas paradas pessoais.</div>
                <Link href="/login" style={{ display: "inline-block", background: palette[0], color: "white", textDecoration: "none", padding: "10px 24px", borderRadius: 100, fontSize: 14, fontWeight: 700 }}>
                  Entrar
                </Link>
              </div>
            ) : tab === "user-songs" && userSongs.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "#86868B" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🎵</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>Nenhuma música nas suas paradas</div>
                <div style={{ fontSize: 14 }}>Você ainda não adicionou músicas deste artista às suas paradas.</div>
              </div>
            ) : tab === "songs" && songs.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "#86868B" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🎵</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>Nenhuma música cadastrada</div>
                <div style={{ fontSize: 14 }}>Ainda não há faixas deste artista no banco de dados.</div>
              </div>
            ) : (
              <>
                <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--divider)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em" }}>
                    {tab === "user-songs" ? "Nas suas paradas" : "Músicas"}
                  </h2>
                  <span style={{ fontSize: 13, color: "#86868B" }}>{activeSongs.length} no total</span>
                </div>
                <div style={{ padding: "0 8px" }}>
                  {/* Header */}
                  {tab === "songs" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "40px 56px minmax(0,1fr) 100px 100px 100px 100px", padding: "8px 16px", gap: 0 }}>
                      {["#", "", "Música", "Pontos", "Semanas", "Pico", "#1s"].map((h, i) => (
                        <div key={i} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B", padding: "8px 6px" }}>{h}</div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "40px 56px minmax(0,1fr) 110px 100px 80px 110px", padding: "8px 16px", gap: 0 }}>
                      {["#", "", "Música", "Seus pontos", "Semanas", "#1s", "Melhor pos."].map((h, i) => (
                        <div key={i} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B", padding: "8px 6px" }}>{h}</div>
                      ))}
                    </div>
                  )}

                  {/* Rows */}
                  {tab === "songs"
                    ? (paginatedSongs as SongRow[]).map((s, i) => (
                        <div key={s.key} style={{ display: "grid", gridTemplateColumns: "40px 56px minmax(0,1fr) 100px 100px 100px 100px", alignItems: "center", padding: "4px 16px", borderRadius: 8, gap: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{(safeSongPage - 1) * PAGE_SIZE + i + 1}</div>
                          <div style={{ padding: "6px 6px" }}>
                            <Cover cover={s.cover} song={{ title: s.title, artist: canonicalName, album: s.album, spotifyId: s.spotifyId ?? undefined }} size={44} rounded={8} />
                          </div>
                          <div style={{ padding: "0 12px", minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                              <Link href={buildSongPath({ title: s.title, artist: s.dbArtist, id: s.songId, artistId: s.isFeat ? undefined : artistRef?.id, slugArtist: s.dbArtist, spotifyId: s.spotifyId })} style={{ display: "block", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", color: "inherit" }}>
                                {s.title}
                              </Link>
                              {s.isFeat && (
                                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", background: "#8338EC18", color: "#8338EC", padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>feat.</span>
                              )}
                            </div>
                            {s.isFeat ? (
                              <div style={{ fontSize: 12, color: "#86868B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {s.dbArtist}
                              </div>
                            ) : s.album.trim() ? (
                              <Link href={buildAlbumPath(s.album.trim(), canonicalName, { artistId: artistRef?.id, albumId: s.albumRefId })} style={{ display: "block", fontSize: 12, color: "#86868B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }}>
                                {s.album}
                              </Link>
                            ) : null}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{s.points}</div>
                          <div style={{ fontSize: 14, color: "#86868B", fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{s.weeks}</div>
                          <div style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", padding: "0 6px", display: "flex", alignItems: "center", gap: 4 }}>
                            {s.peak === 1 && <Star size={12} color="#FA243C" fill="#FA243C" />}
                            {s.peak > 0 ? `#${s.peak}` : "-"}
                          </div>
                          <div style={{ fontSize: 14, color: "#86868B", fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{s.number1s}</div>
                        </div>
                      ))
                    : (paginatedSongs as UserSongRow[]).map((s, i) => (
                        <div key={s.key} style={{ display: "grid", gridTemplateColumns: "40px 56px minmax(0,1fr) 110px 100px 80px 110px", alignItems: "center", padding: "4px 16px", borderRadius: 8, gap: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{(safeSongPage - 1) * PAGE_SIZE + i + 1}</div>
                          <div style={{ padding: "6px 6px" }}>
                            <Cover cover={s.cover} song={{ title: s.title, artist: canonicalName, album: s.album, spotifyId: s.spotifyId ?? undefined }} size={44} rounded={8} />
                          </div>
                          <div style={{ padding: "0 12px", minWidth: 0 }}>
                            <Link href={buildSongPath({ title: s.title, artist: canonicalName, id: s.songId, artistId: artistRef?.id, slugArtist: s.dbArtist, spotifyId: s.spotifyId })} style={{ display: "block", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", color: "inherit" }}>
                              {s.title}
                            </Link>
                            {s.album.trim() ? (
                              <Link href={buildAlbumPath(s.album.trim(), canonicalName, { artistId: artistRef?.id, albumId: s.albumRefId })} style={{ display: "block", fontSize: 12, color: "#86868B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }}>
                                {s.album}
                              </Link>
                            ) : null}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: palette[0], fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{s.userPoints}</div>
                          <div style={{ fontSize: 14, color: "#86868B", fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{s.appearances}</div>
                          <div style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", padding: "0 6px", display: "flex", alignItems: "center", gap: 4 }}>
                            {s.number1s > 0 && <Star size={12} color="#FA243C" fill="#FA243C" />}
                            {s.number1s}
                          </div>
                          <div style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", padding: "0 6px", display: "flex", alignItems: "center", gap: 4 }}>
                            {s.bestPosition === 1 && <Star size={12} color="#FA243C" fill="#FA243C" />}
                            #{s.bestPosition}
                          </div>
                        </div>
                      ))
                  }
                </div>

                <PaginationBar
                  artistSlug={name}
                  tab={tab}
                  palette={palette}
                  safePage={safeSongPage}
                  totalPages={songTotalPages}
                  totalItems={activeSongs.length}
                  pageSize={PAGE_SIZE}
                />
              </>
            )}
          </div>
        )}

        {/* Tab: Álbuns / Álbuns por pontuação */}
        {(tab === "albums" || tab === "user-albums") && (
          <div style={{ marginBottom: 40 }}>
            {tab === "user-albums" && !currentUserId ? (
              <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--text)" }}>Faça login para ver seus álbuns</div>
                <div style={{ fontSize: 14, marginBottom: 20 }}>Veja quais álbuns deste artista você mais pontuou nas suas paradas.</div>
                <Link href="/login" style={{ display: "inline-block", background: palette[0], color: "white", textDecoration: "none", padding: "10px 24px", borderRadius: 100, fontSize: 14, fontWeight: 700 }}>
                  Entrar
                </Link>
              </div>
            ) : tab === "user-albums" && userAlbums.length === 0 ? (
              <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>💿</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>Nenhum álbum nas suas paradas</div>
                <div style={{ fontSize: 14 }}>Você ainda não adicionou músicas deste artista às suas paradas.</div>
              </div>
            ) : tab === "albums" && allAlbums.length === 0 ? (
              <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>💿</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>Nenhum álbum cadastrado</div>
                <div style={{ fontSize: 14 }}>Ainda não há álbuns deste artista vinculados no banco ou nas paradas.</div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em" }}>
                    {tab === "user-albums" ? "Seus álbuns favoritos" : "Álbuns"}
                  </h2>
                  <span style={{ fontSize: 13, color: "#86868B" }}>
                    {activeAlbums.length} álbuns
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
                  {paginatedAlbums.map((album) => (
                    <Link key={album.name} href={buildAlbumPath(album.name, canonicalName, { artistId: artistRef?.id, albumId: album.albumId })} style={{ textDecoration: "none" }}>
                      <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 16 }}>
                        <Cover cover={album.cover} song={{ title: album.name, artist: canonicalName, album: album.name }} size={128} rounded={10} />
                        <div style={{ marginTop: 10, fontSize: 14, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{album.name}</div>
                        <div style={{ fontSize: 12, color: "#86868B" }}>{album.songs} {album.songs === 1 ? "faixa" : "faixas"}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: palette[0], marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{album.points} pts</div>
                      </div>
                    </Link>
                  ))}
                </div>
                <PaginationBar
                  artistSlug={name}
                  tab={tab}
                  palette={palette}
                  safePage={safeAlbumPage}
                  totalPages={albumTotalPages}
                  totalItems={activeAlbums.length}
                  pageSize={ALBUM_PAGE_SIZE}
                  inCard={false}
                />
              </>
            )}
          </div>
        )}

        {/* Top fans — só na visão Global 100 */}
        {!isUserTab && allEntries.length > 0 ? (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 16 }}>Maiores fãs</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {bigFans.map(({ user, points }) => (
                <Link key={user.id} href={`/profile/${user.handle}`} style={{ textDecoration: "none" }}>
                  <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 20, textAlign: "center" }}>
                    <Avatar user={user} imageUrl={user.image} size={56} />
                    <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{user.name}</div>
                    <div style={{ fontSize: 12, color: "#86868B", marginBottom: 8 }}>@{user.handle}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B", marginBottom: 4 }}>Pontos no artista</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: palette[0], fontVariantNumeric: "tabular-nums" }}>{points}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Shell>
  );
}

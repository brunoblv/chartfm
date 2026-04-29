import Link from "next/link";
import { ChevronLeft, Play, Star } from "lucide-react";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { buildWeekIndexFromDate, getPreviousClosedWeekDate } from "@/lib/chart-week";
import { Shell } from "@/components/layout/Shell";
import { Cover } from "@/components/ui/Cover";
import { Avatar } from "@/components/ui/Avatar";
import { COVER_PALETTES } from "@/lib/data";
import { buildSongPath, parseArtistSlug, buildAlbumPath } from "@/lib/music-routes";
import { authOptions } from "@/lib/auth-options";

function artistColor(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return COVER_PALETTES[Math.abs(hash) % COVER_PALETTES.length];
}

function pointsForPosition(position: number): number {
  return 101 - position;
}

function songKey(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}|${artist.trim().toLowerCase()}`;
}

const PAGE_SIZE = 10;
const VALID_TABS = ["songs", "albums", "user-songs", "user-albums"] as const;
type Tab = typeof VALID_TABS[number];

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

type SongRow = {
  key: string;
  songId: string;
  spotifyId: string | null;
  dbArtist: string;
  title: string;
  album: string;
  points: number;
  cover: { palette: [string, string]; seed: number; imageUrl?: string | null };
  weeks: number;
  peak: number;
  number1s: number;
  currentWeekPos: number;
};

type UserSongRow = {
  key: string;
  songId: string;
  spotifyId: string | null;
  dbArtist: string;
  title: string;
  album: string;
  userPoints: number;
  appearances: number;
  bestPosition: number;
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
  const currentPage = Math.max(1, parseInt(sp.page ?? "1", 10));

  const session = await getServerSession(authOptions);
  const currentUserId = session?.user?.id ?? null;

  const parsed = parseArtistSlug(name);
  const artistRef = await prisma.artist.findFirst({
    where:
      parsed.type === "dbId"
        ? { id: parsed.artistId }
        : parsed.type === "spotify"
          ? { spotifyId: parsed.spotifyId }
          : { name: { equals: parsed.name, mode: "insensitive" } },
    select: { id: true, spotifyId: true, name: true, imageUrl: true, spotifyUrl: true },
  });
  const requestedName = parsed.type === "slug" ? parsed.name : (artistRef?.name ?? "");
  const canonicalName = artistRef?.name ?? requestedName;
  const palette = artistColor(canonicalName);

  const allEntries = await prisma.chartEntry.findMany({
    where: {
      chart: { isPublished: true },
      OR: [
        ...(artistRef?.spotifyId ? [{ song: { artistSpotifyId: artistRef.spotifyId } }] : []),
        { song: { artist: { equals: canonicalName, mode: "insensitive" } } },
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
          coverImageUrl: true,
          spotifyId: true,
          albumRef: { select: { id: true, coverUrl: true } },
        },
      },
    },
  });

  if (allEntries.length === 0) {
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
    const cur = songsMap.get(key) ?? {
      key,
      songId: e.song.id,
      spotifyId: e.song.spotifyId,
      dbArtist: e.song.artist,
      title: e.song.title,
      album: e.song.album ?? "",
      points: 0,
      weeks: 0,
      peak: 9999,
      number1s: 0,
      currentWeekPos: 9999,
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

  const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const currentWeekDate = getPreviousClosedWeekDate(nowBRT);
  const currentWeekIdx = buildWeekIndexFromDate(currentWeekDate);

  const globalRows = await prisma.chartEntry.findMany({
    where: { chart: { isPublished: true } },
    select: {
      position: true,
      points: true,
      chart: { select: { weekIndex: true } },
      song: { select: { title: true, artist: true } },
    },
  });

  const weeklyBuckets = new Map<number, Map<string, number>>();
  for (const row of globalRows) {
    const wk = row.chart.weekIndex;
    const key = songKey(row.song.title, row.song.artist);
    const pts = row.points > 0 ? row.points : pointsForPosition(row.position);
    const bySong = weeklyBuckets.get(wk) ?? new Map<string, number>();
    bySong.set(key, (bySong.get(key) ?? 0) + pts);
    weeklyBuckets.set(wk, bySong);
  }

  const artistSongKeys = new Set(songsMap.keys());
  const globalStatsBySong = new Map<string, { weeks: number; peak: number; number1s: number; currentWeekPos: number }>();
  for (const key of artistSongKeys) {
    globalStatsBySong.set(key, { weeks: 0, peak: 9999, number1s: 0, currentWeekPos: 9999 });
  }
  for (const [wk, bySong] of weeklyBuckets) {
    const top100 = [...bySong.entries()].sort((a, b) => b[1] - a[1]).slice(0, 100);
    top100.forEach(([key], idx) => {
      if (!artistSongKeys.has(key)) return;
      const pos = idx + 1;
      const cur = globalStatsBySong.get(key)!;
      cur.weeks += 1;
      cur.peak = Math.min(cur.peak, pos);
      if (pos === 1) cur.number1s += 1;
      if (wk === currentWeekIdx) cur.currentWeekPos = pos;
      globalStatsBySong.set(key, cur);
    });
  }

  const songs = [...songsMap.values()]
    .map((s) => {
      const gs = globalStatsBySong.get(s.key);
      return {
        ...s,
        weeks: gs?.weeks ?? 0,
        peak: gs?.peak === 9999 ? 0 : (gs?.peak ?? 0),
        number1s: gs?.number1s ?? 0,
        currentWeekPos: gs?.currentWeekPos ?? 9999,
      };
    })
    .sort((a, b) => a.currentWeekPos - b.currentWeekPos || b.points - a.points);

  // ── All albums ────────────────────────────────────────────────────────────
  const albumsMapRaw = new Map<string, { albumId: number | null; name: string; songTitles: Set<string>; points: number; cover: AlbumRow["cover"] }>();
  for (const e of allEntries) {
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
  const allAlbums: AlbumRow[] = [...albumsMapRaw.values()]
    .sort((a, b) => b.points - a.points)
    .map((a) => ({ albumId: a.albumId, name: a.name, songs: a.songTitles.size, points: a.points, cover: a.cover }));

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
      userPoints: 0,
      appearances: 0,
      bestPosition: 9999,
      cover: {
        palette: [e.coverPaletteA, e.coverPaletteB] as [string, string],
        seed: e.coverSeed,
        imageUrl: manual ?? undefined,
      },
    };
    cur.userPoints += pts;
    cur.appearances += 1;
    cur.bestPosition = Math.min(cur.bestPosition, e.position);
    if (manual) cur.cover = { ...cur.cover, imageUrl: manual };
    userSongsMap.set(key, cur);
  }
  const userSongs = [...userSongsMap.values()].sort((a, b) => b.userPoints - a.userPoints);

  const userAlbumsMapRaw = new Map<string, { name: string; songTitles: Set<string>; points: number; cover: AlbumRow["cover"] }>();
  for (const e of userEntries) {
    const albumName = e.song.album?.trim() || "Single";
    if (albumName === "Single") continue;
    const pts = e.points > 0 ? e.points : pointsForPosition(e.position);
    const manual = e.song.albumRef?.coverUrl?.trim() || null;
    const existing = userAlbumsMapRaw.get(albumName);
    if (!existing) {
      userAlbumsMapRaw.set(albumName, {
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
    .map((a) => ({ name: a.name, songs: a.songTitles.size, points: a.points, cover: a.cover }));

  // ── Pagination ────────────────────────────────────────────────────────────
  const activeSongs = tab === "user-songs" ? userSongs : songs;
  const totalPages = Math.ceil(activeSongs.length / PAGE_SIZE);
  const safePage = Math.min(currentPage, totalPages || 1);
  const paginatedSongs = activeSongs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // ── Fans ──────────────────────────────────────────────────────────────────
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
  const bigFans = [...fanMap.values()].sort((a, b) => b.points - a.points).slice(0, 4);

  const stats = [
    { label: "Usuários únicos", value: listenersSet.size, icon: "🎧", color: "#FA243C" },
    { label: "Músicas rankeadas", value: songsMap.size, icon: "🎵", color: "#8338EC" },
    { label: "Número 1s", value: number1s, icon: "👑", color: "#FFD700" },
    { label: "Pontos totais", value: totalPoints, icon: "⭐", color: "#FB5607" },
  ];

  const tabDefs: { id: Tab; label: string }[] = [
    { id: "songs", label: "Músicas Global 100" },
    { id: "albums", label: "Albuns overall" },
    { id: "user-songs", label: "Músicas na sua parada" },
    { id: "user-albums", label: "Albuns na sua parada" },
  ];

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <Shell title="" noPadding>
      {/* Hero */}
      <div style={{
        background: `linear-gradient(180deg, ${palette[0]} 0%, ${palette[1]} 50%, #FBFBFD 100%)`,
        padding: "48px 40px 40px 40px",
      }}>
        <Link href="/discover" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: 500, textDecoration: "none", marginBottom: 32 }}>
          <ChevronLeft size={16} />
          Voltar
        </Link>
        <div style={{ display: "flex", gap: 40, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{
            width: 200, height: 200, borderRadius: "50%", flexShrink: 0,
            background: artistRef?.imageUrl
              ? `url(${artistRef.imageUrl}) center/cover no-repeat`
              : `radial-gradient(circle at 30% 30%, ${palette[1]}, ${palette[0]})`,
            boxShadow: "0 16px 40px rgba(0,0,0,0.3)",
          }} />
          <div style={{ color: "white", flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.8, marginBottom: 8 }}>Artista</div>
            <h1 style={{ fontSize: 72, fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 1, marginBottom: 16 }}>{canonicalName}</h1>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 14, opacity: 0.9, marginBottom: 24 }}>
              <span><strong>{listenersSet.size}</strong> ouvintes</span>
              <span><strong>{songsMap.size}</strong> músicas rankeadas</span>
              <span><strong>{number1s}</strong> #1s</span>
              <span><strong>{totalPoints}</strong> pontos</span>
            </div>
            <a
              href={artistRef?.spotifyUrl ?? `https://open.spotify.com/search/${encodeURIComponent(canonicalName)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "white", color: palette[0], padding: "12px 24px", borderRadius: 100, fontSize: 14, fontWeight: 700, textDecoration: "none" }}
            >
              <Play size={16} fill={palette[0]} />
              Ouvir
            </a>
          </div>
        </div>
      </div>

      <div style={{ padding: "36px 40px 80px 40px" }}>
        {/* Stats cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 40 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: s.color + "18", display: "grid", placeItems: "center", marginBottom: 12, fontSize: 22 }}>{s.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tab nav */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid rgba(0,0,0,0.06)", paddingBottom: 0 }}>
          {tabDefs.map((t) => (
            <Link
              key={t.id}
              href={`?tab=${t.id}`}
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
          <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden", marginBottom: 40 }}>
            {tab === "user-songs" && !currentUserId ? (
              <div style={{ padding: 48, textAlign: "center", color: "#86868B" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#1D1D1F" }}>Faça login para ver suas músicas</div>
                <div style={{ fontSize: 14, marginBottom: 20 }}>Veja quais músicas deste artista aparecem nas suas paradas pessoais.</div>
                <Link href="/login" style={{ display: "inline-block", background: palette[0], color: "white", textDecoration: "none", padding: "10px 24px", borderRadius: 100, fontSize: 14, fontWeight: 700 }}>
                  Entrar
                </Link>
              </div>
            ) : tab === "user-songs" && userSongs.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "#86868B" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🎵</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#1D1D1F", marginBottom: 8 }}>Nenhuma música nas suas paradas</div>
                <div style={{ fontSize: 14 }}>Você ainda não adicionou músicas deste artista às suas paradas.</div>
              </div>
            ) : (
              <>
                <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
                    <div style={{ display: "grid", gridTemplateColumns: "40px 56px minmax(0,1fr) 110px 100px 110px", padding: "8px 16px", gap: 0 }}>
                      {["#", "", "Música", "Seus pontos", "Semanas", "Melhor pos."].map((h, i) => (
                        <div key={i} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B", padding: "8px 6px" }}>{h}</div>
                      ))}
                    </div>
                  )}

                  {/* Rows */}
                  {tab === "songs"
                    ? (paginatedSongs as SongRow[]).map((s, i) => (
                        <div key={s.key} style={{ display: "grid", gridTemplateColumns: "40px 56px minmax(0,1fr) 100px 100px 100px 100px", alignItems: "center", padding: "4px 16px", borderRadius: 8, gap: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{(safePage - 1) * PAGE_SIZE + i + 1}</div>
                          <div style={{ padding: "6px 6px" }}>
                            <Cover cover={s.cover} song={{ title: s.title, artist: canonicalName, album: s.album, spotifyId: s.spotifyId ?? undefined }} size={44} rounded={8} />
                          </div>
                          <div style={{ padding: "0 12px", minWidth: 0 }}>
                            <Link href={buildSongPath({ title: s.title, artist: canonicalName, id: s.songId, artistId: artistRef?.id, slugArtist: s.dbArtist, spotifyId: s.spotifyId })} style={{ display: "block", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", color: "inherit" }}>
                              {s.title}
                            </Link>
                            <div style={{ fontSize: 12, color: "#86868B" }}>{s.album}</div>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{s.points}</div>
                          <div style={{ fontSize: 14, color: "#86868B", fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{s.weeks}</div>
                          <div style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", padding: "0 6px", display: "flex", alignItems: "center", gap: 4 }}>
                            {s.peak === 1 && <Star size={12} color="#FA243C" fill="#FA243C" />}
                            {s.peak > 0 ? `#${s.peak}` : "—"}
                          </div>
                          <div style={{ fontSize: 14, color: "#86868B", fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{s.number1s}</div>
                        </div>
                      ))
                    : (paginatedSongs as UserSongRow[]).map((s, i) => (
                        <div key={s.key} style={{ display: "grid", gridTemplateColumns: "40px 56px minmax(0,1fr) 110px 100px 110px", alignItems: "center", padding: "4px 16px", borderRadius: 8, gap: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{(safePage - 1) * PAGE_SIZE + i + 1}</div>
                          <div style={{ padding: "6px 6px" }}>
                            <Cover cover={s.cover} song={{ title: s.title, artist: canonicalName, album: s.album, spotifyId: s.spotifyId ?? undefined }} size={44} rounded={8} />
                          </div>
                          <div style={{ padding: "0 12px", minWidth: 0 }}>
                            <Link href={buildSongPath({ title: s.title, artist: canonicalName, id: s.songId, artistId: artistRef?.id, slugArtist: s.dbArtist, spotifyId: s.spotifyId })} style={{ display: "block", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", color: "inherit" }}>
                              {s.title}
                            </Link>
                            <div style={{ fontSize: 12, color: "#86868B" }}>{s.album}</div>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: palette[0], fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{s.userPoints}</div>
                          <div style={{ fontSize: 14, color: "#86868B", fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{s.appearances}</div>
                          <div style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", padding: "0 6px", display: "flex", alignItems: "center", gap: 4 }}>
                            {s.bestPosition === 1 && <Star size={12} color="#FA243C" fill="#FA243C" />}
                            #{s.bestPosition}
                          </div>
                        </div>
                      ))
                  }
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: "#86868B" }}>
                      {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, activeSongs.length)} de {activeSongs.length}
                    </span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {safePage > 1 ? (
                        <Link href={`?tab=${tab}&page=${safePage - 1}`} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.12)", fontSize: 13, fontWeight: 600, textDecoration: "none", color: "#1D1D1F" }}>←</Link>
                      ) : (
                        <span style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)", fontSize: 13, color: "#C7C7CC" }}>←</span>
                      )}
                      {buildPageNumbers(safePage, totalPages).map((p, idx) =>
                        p === "..." ? (
                          <span key={`e-${idx}`} style={{ padding: "6px 4px", fontSize: 13, color: "#86868B" }}>…</span>
                        ) : (
                          <Link key={p} href={`?tab=${tab}&page=${p}`} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", background: p === safePage ? palette[0] : "transparent", color: p === safePage ? "white" : "#1D1D1F", border: p === safePage ? "none" : "1px solid rgba(0,0,0,0.12)" }}>
                            {p}
                          </Link>
                        )
                      )}
                      {safePage < totalPages ? (
                        <Link href={`?tab=${tab}&page=${safePage + 1}`} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.12)", fontSize: 13, fontWeight: 600, textDecoration: "none", color: "#1D1D1F" }}>→</Link>
                      ) : (
                        <span style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)", fontSize: 13, color: "#C7C7CC" }}>→</span>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab: Álbuns / Álbuns por pontuação */}
        {(tab === "albums" || tab === "user-albums") && (
          <div style={{ marginBottom: 40 }}>
            {tab === "user-albums" && !currentUserId ? (
              <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 48, textAlign: "center", color: "#86868B" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#1D1D1F" }}>Faça login para ver seus álbuns</div>
                <div style={{ fontSize: 14, marginBottom: 20 }}>Veja quais álbuns deste artista você mais pontuou nas suas paradas.</div>
                <Link href="/login" style={{ display: "inline-block", background: palette[0], color: "white", textDecoration: "none", padding: "10px 24px", borderRadius: 100, fontSize: 14, fontWeight: 700 }}>
                  Entrar
                </Link>
              </div>
            ) : tab === "user-albums" && userAlbums.length === 0 ? (
              <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 48, textAlign: "center", color: "#86868B" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>💿</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#1D1D1F", marginBottom: 8 }}>Nenhum álbum nas suas paradas</div>
                <div style={{ fontSize: 14 }}>Você ainda não adicionou músicas deste artista às suas paradas.</div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em" }}>
                    {tab === "user-albums" ? "Seus álbuns favoritos" : "Álbuns"}
                  </h2>
                  <span style={{ fontSize: 13, color: "#86868B" }}>
                    {(tab === "albums" ? allAlbums : userAlbums).length} álbuns
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
                  {(tab === "albums" ? allAlbums : userAlbums).map((album) => (
                    <Link key={album.name} href={buildAlbumPath(album.name, canonicalName, { artistId: artistRef?.id, albumId: album.albumId })} style={{ textDecoration: "none" }}>
                      <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 16 }}>
                        <Cover cover={album.cover} song={{ title: album.name, artist: canonicalName, album: album.name }} size={128} rounded={10} />
                        <div style={{ marginTop: 10, fontSize: 14, fontWeight: 700, color: "#1D1D1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{album.name}</div>
                        <div style={{ fontSize: 12, color: "#86868B" }}>{album.songs} {album.songs === 1 ? "faixa" : "faixas"}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: palette[0], marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{album.points} pts</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Top fans */}
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 16 }}>Maiores fãs</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {bigFans.map(({ user, points }) => (
              <Link key={user.id} href={`/profile/${user.handle}`} style={{ textDecoration: "none" }}>
                <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 20, textAlign: "center" }}>
                  <Avatar user={user} imageUrl={user.image} size={56} />
                  <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: "#1D1D1F" }}>{user.name}</div>
                  <div style={{ fontSize: 12, color: "#86868B", marginBottom: 8 }}>@{user.handle}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B", marginBottom: 4 }}>Pontos no artista</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: palette[0], fontVariantNumeric: "tabular-nums" }}>{points}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}

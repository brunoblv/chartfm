import Link from "next/link";
import { ChevronLeft, Play, Star } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { buildWeekIndexFromDate, getPreviousClosedWeekDate } from "@/lib/chart-week";
import { Shell } from "@/components/layout/Shell";
import { Cover } from "@/components/ui/Cover";
import { Avatar } from "@/components/ui/Avatar";
import { COVER_PALETTES } from "@/lib/data";
import { buildSongPath, parseArtistSlug } from "@/lib/music-routes";

function artistColor(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % COVER_PALETTES.length;
  return COVER_PALETTES[idx];
}

function pointsForPosition(position: number): number {
  return 101 - position;
}

function songKey(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}|${artist.trim().toLowerCase()}`;
}

type ArtistSongRow = {
  key: string;
  songId: string;
  spotifyId: string | null;
  dbArtist: string;
  title: string;
  album: string;
  points: number;
  weeks: number;
  peak: number;
  number1s: number;
  cover: { palette: [string, string]; seed: number; imageUrl?: string | null };
  currentWeekPos: number;
};

export default async function ArtistPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const parsed = parseArtistSlug(name);

  const artistRef = await prisma.artist.findFirst({
    where:
      parsed.type === "spotify"
        ? { spotifyId: parsed.spotifyId }
        : { name: { equals: parsed.name, mode: "insensitive" } },
    select: { spotifyId: true, name: true, imageUrl: true, spotifyUrl: true },
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
            select: {
              id: true,
              handle: true,
              name: true,
              avatarColor: true,
              image: true,
            },
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

  const listenersSet = new Set(allEntries.map((e) => e.chart.userId));
  const songsMap = new Map<string, ArtistSongRow>();
  let number1s = 0;
  let totalPoints = 0;

  for (const e of allEntries) {
    const pts = e.points > 0 ? e.points : pointsForPosition(e.position);
    totalPoints += pts;
    if (e.position === 1) number1s += 1;

    const key = songKey(e.song.title, e.song.artist);
    const manual = e.song.coverImageUrl?.trim() || null;
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

  // Para métricas globais (semanas, pico, #1s), precisamos rankear TODAS as músicas por semana (top 100).
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
    const top100 = [...bySong.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100);
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
      const globalStats = globalStatsBySong.get(s.key);
      return {
        ...s,
        weeks: globalStats?.weeks ?? 0,
        peak: globalStats?.peak === 9999 ? 0 : (globalStats?.peak ?? 0),
        number1s: globalStats?.number1s ?? 0,
        currentWeekPos: globalStats?.currentWeekPos ?? 9999,
      };
    })
    .sort((a, b) => a.currentWeekPos - b.currentWeekPos || b.points - a.points)
    .slice(0, 10);

  const fanMap = new Map<
    string,
    {
      user: { id: string; handle: string; name: string; avatar: string; image: string | null };
      points: number;
    }
  >();
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

  const stats = [
    { label: "Usuários únicos", value: listenersSet.size, icon: "🎧", color: "#FA243C" },
    { label: "Músicas rankeadas", value: songsMap.size, icon: "🎵", color: "#8338EC" },
    { label: "Número 1s", value: number1s, icon: "👑", color: "#FFD700" },
    { label: "Pontos totais", value: totalPoints, icon: "⭐", color: "#FB5607" },
  ];

  return (
    <Shell title="" noPadding>
      {/* Hero */}
      <div style={{
        background: `linear-gradient(180deg, ${palette[0]} 0%, ${palette[1]} 50%, #FBFBFD 100%)`,
        padding: "48px 40px 40px 40px",
        position: "relative",
      }}>
        <Link href="/discover" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: 500, textDecoration: "none", marginBottom: 32 }}>
          <ChevronLeft size={16} />
          Voltar
        </Link>

        <div style={{ display: "flex", gap: 40, alignItems: "flex-end", flexWrap: "wrap" }}>
          {/* Avatar */}
          <div
            style={{
              width: 200,
              height: 200,
              borderRadius: "50%",
              background: artistRef?.imageUrl
                ? `url(${artistRef.imageUrl}) center/cover no-repeat`
                : `radial-gradient(circle at 30% 30%, ${palette[1]}, ${palette[0]})`,
              boxShadow: "0 16px 40px rgba(0,0,0,0.3)",
              flexShrink: 0,
            }}
          />

          <div style={{ color: "white", flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.8, marginBottom: 8 }}>
              Artista
            </div>
            <h1 style={{ fontSize: 72, fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 1, marginBottom: 16 }}>
              {canonicalName}
            </h1>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 14, opacity: 0.9, marginBottom: 24 }}>
              <span><strong>{listenersSet.size}</strong> ouvintes</span>
              <span><strong>{songsMap.size}</strong> músicas rankeadas</span>
              <span><strong>{number1s}</strong> #1s</span>
              <span><strong>{totalPoints}</strong> pontos</span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <a
                href={artistRef?.spotifyUrl ?? `https://open.spotify.com/search/${encodeURIComponent(canonicalName)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "white", color: palette[0], border: "none",
                padding: "12px 24px", borderRadius: 100, fontSize: 14, fontWeight: 700,
                textDecoration: "none",
              }}>
                <Play size={16} fill={palette[0]} />
                Ouvir
              </a>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "36px 40px 80px 40px" }}>
        {/* Stats cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 40 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: s.color + "18", display: "grid", placeItems: "center", marginBottom: 12, fontSize: 22 }}>
                {s.icon}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Popular songs */}
        <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden", marginBottom: 40 }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em" }}>Músicas populares</h2>
          </div>
          <div style={{ padding: "0 8px" }}>
            {/* Header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "40px 56px minmax(0,1fr) 100px 100px 100px 100px",
              padding: "8px 16px",
              gap: 0,
            }}>
              {["#", "", "Música", "Pontos", "Semanas", "Pico", "#1s"].map((h, i) => (
                <div key={i} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B", padding: "8px 6px" }}>{h}</div>
              ))}
            </div>
            {songs.map((s, i) => (
              <div key={s.title} style={{
                display: "grid",
                gridTemplateColumns: "40px 56px minmax(0,1fr) 100px 100px 100px 100px",
                alignItems: "center",
                padding: "4px 16px",
                borderRadius: 8,
                gap: 0,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#000000", fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{i + 1}</div>
                <div style={{ padding: "6px 6px" }}>
                  <Cover cover={s.cover} song={{ title: s.title, artist: canonicalName, album: s.album }} size={44} rounded={8} />
                </div>
                <div style={{ padding: "0 12px", minWidth: 0 }}>
                  <Link
                    href={buildSongPath({
                      title: s.title,
                      artist: canonicalName,
                      id: s.spotifyId ? undefined : s.songId,
                      slugArtist: s.dbArtist,
                      spotifyId: s.spotifyId,
                    })}
                    style={{ display: "block", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", color: "inherit" }}
                  >
                    {s.title}
                  </Link>
                  <div style={{ fontSize: 12, color: "#86868B" }}>{s.album}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{s.points}</div>
                <div style={{ fontSize: 14, color: "#86868B", fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{s.weeks}</div>
                <div style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", padding: "0 6px", display: "flex", alignItems: "center", gap: 4 }}>
                  {s.peak === 1 && <Star size={12} color="#FA243C" fill="#FA243C" />}
                  #{s.peak}
                </div>
                <div style={{ fontSize: 14, color: "#86868B", fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>
                  {s.number1s}
                </div>
              </div>
            ))}
          </div>
        </div>

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

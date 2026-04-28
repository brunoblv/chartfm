import Link from "next/link";
import { ChevronLeft, Star } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { buildWeekIndexFromDate, getPreviousClosedWeekDate } from "@/lib/chart-week";
import { Shell } from "@/components/layout/Shell";
import { Cover } from "@/components/ui/Cover";
import { Avatar } from "@/components/ui/Avatar";
import { COVER_PALETTES } from "@/lib/data";
import { parseAlbumSlug, buildArtistPath, buildSongPath, slugify } from "@/lib/music-routes";

function pointsForPosition(position: number): number {
  return 101 - position;
}

function songKey(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}|${artist.trim().toLowerCase()}`;
}

function albumColor(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % COVER_PALETTES.length;
  return COVER_PALETTES[idx];
}

export default async function AlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = parseAlbumSlug(slug);

  if (!parsed) {
    return (
      <Shell title="Álbum" subtitle="Não encontrado">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>
          <p style={{ fontSize: 16, marginBottom: 20 }}>URL de álbum inválida.</p>
          <Link href="/discover" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
            ← Voltar para descobrir
          </Link>
        </div>
      </Shell>
    );
  }

  const { artistSlug, albumSlug } = parsed;
  const firstArtistWord = artistSlug.split("-").find((w) => w.length > 0) ?? artistSlug;

  // Resolve artist
  const artistRef = await prisma.artist.findFirst({
    where: { name: { contains: firstArtistWord, mode: "insensitive" } },
    select: { spotifyId: true, name: true, imageUrl: true, spotifyUrl: true },
  });

  // Fetch all entries for this artist, then filter by album in memory
  const allEntries = await prisma.chartEntry.findMany({
    where: {
      chart: { isPublished: true },
      OR: [
        ...(artistRef?.spotifyId ? [{ song: { artistSpotifyId: artistRef.spotifyId } }] : []),
        { song: { artist: { contains: firstArtistWord, mode: "insensitive" } } },
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
          coverImageUrl: true,
          spotifyId: true,
          artistSpotifyId: true,
        },
      },
    },
  });

  // Filter to this album only (slugify match)
  const albumEntries = allEntries.filter(
    (e) => slugify(e.song.album ?? "") === albumSlug,
  );

  if (albumEntries.length === 0) {
    return (
      <Shell title="Álbum" subtitle="Não encontrado">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>
          <p style={{ fontSize: 16, marginBottom: 20 }}>Não encontramos dados para este álbum.</p>
          <Link href="/discover" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
            ← Voltar para descobrir
          </Link>
        </div>
      </Shell>
    );
  }

  const canonicalAlbum = albumEntries[0].song.album ?? "";
  const canonicalArtist =
    artistRef?.name ?? albumEntries[0].song.artist;
  const coverImageUrl = albumEntries.find((e) => e.song.coverImageUrl?.trim())?.song.coverImageUrl?.trim() ?? null;
  const firstEntry = albumEntries[0];
  const palette = albumColor(canonicalAlbum + canonicalArtist);

  const listenersSet = new Set(albumEntries.map((e) => e.chart.userId));

  type SongRow = {
    key: string;
    songId: string;
    spotifyId: string | null;
    artistSpotifyId: string | null;
    dbArtist: string;
    title: string;
    points: number;
    cover: { palette: [string, string]; seed: number; imageUrl?: string | null };
    weeks: number;
    peak: number;
    number1s: number;
  };

  const songsMap = new Map<string, SongRow>();
  let totalPoints = 0;
  let number1sAlbum = 0;

  for (const e of albumEntries) {
    const pts = e.points > 0 ? e.points : pointsForPosition(e.position);
    totalPoints += pts;
    if (e.position === 1) number1sAlbum += 1;

    const key = songKey(e.song.title, e.song.artist);
    const manual = e.song.coverImageUrl?.trim() || null;
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

  // Compute global weekly stats per song
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
      };
    })
    .sort((a, b) => b.points - a.points);

  // Top fans
  const fanMap = new Map<string, { user: { id: string; handle: string; name: string; avatar: string; image: string | null }; points: number }>();
  for (const e of albumEntries) {
    const pts = e.points > 0 ? e.points : pointsForPosition(e.position);
    const existing = fanMap.get(e.chart.user.id) ?? {
      user: { id: e.chart.user.id, handle: e.chart.user.handle, name: e.chart.user.name, avatar: e.chart.user.avatarColor, image: e.chart.user.image },
      points: 0,
    };
    existing.points += pts;
    fanMap.set(e.chart.user.id, existing);
  }
  const topFans = [...fanMap.values()].sort((a, b) => b.points - a.points).slice(0, 4);

  const coverForHero = {
    palette: [firstEntry.coverPaletteA, firstEntry.coverPaletteB] as [string, string],
    seed: firstEntry.coverSeed,
    imageUrl: coverImageUrl,
  };

  const stats = [
    { label: "Pontos totais", value: totalPoints, color: "#FA243C" },
    { label: "Ouvintes únicos", value: listenersSet.size, color: "#8338EC" },
    { label: "Faixas rankeadas", value: songsMap.size, color: "#3A86FF" },
    { label: "Número 1s", value: number1sAlbum, color: "#FFD700" },
  ];

  const artistSpotifyId = albumEntries[0].song.artistSpotifyId;

  return (
    <Shell title="" noPadding>
      {/* Hero */}
      <div style={{
        background: `linear-gradient(180deg, ${palette[0]} 0%, ${palette[1]} 50%, #FBFBFD 100%)`,
        padding: "48px 40px 40px 40px",
      }}>
        <Link
          href={buildArtistPath(canonicalArtist, artistSpotifyId)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: 500, textDecoration: "none", marginBottom: 32 }}
        >
          <ChevronLeft size={16} />
          {canonicalArtist}
        </Link>

        <div style={{ display: "flex", gap: 40, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flexShrink: 0, boxShadow: "0 16px 48px rgba(0,0,0,0.35)", borderRadius: 14 }}>
            <Cover
              cover={coverForHero}
              song={{ title: canonicalAlbum, artist: canonicalArtist, album: canonicalAlbum, spotifyId: albumEntries[0].song.spotifyId ?? undefined, imageUrl: coverImageUrl }}
              size={200}
              rounded={14}
            />
          </div>

          <div style={{ color: "white", flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.8, marginBottom: 8 }}>
              Álbum
            </div>
            <h1 style={{ fontSize: 56, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 12 }}>
              {canonicalAlbum}
            </h1>
            <Link
              href={buildArtistPath(canonicalArtist, artistSpotifyId)}
              style={{ display: "inline-block", fontSize: 18, fontWeight: 600, color: "rgba(255,255,255,0.9)", textDecoration: "none", marginBottom: 20 }}
            >
              {canonicalArtist}
            </Link>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 14, opacity: 0.9 }}>
              <span><strong>{listenersSet.size}</strong> ouvintes</span>
              <span><strong>{songsMap.size}</strong> faixas</span>
              <span><strong>{totalPoints}</strong> pontos</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "36px 40px 80px 40px" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 40 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tracklist */}
        <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden", marginBottom: 40 }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em" }}>Faixas</h2>
          </div>
          <div style={{ padding: "0 8px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "40px 56px minmax(0,1fr) 100px 100px 100px 100px", padding: "8px 16px", gap: 0 }}>
              {["#", "", "Música", "Pontos", "Semanas", "Pico", "#1s"].map((h, i) => (
                <div key={i} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B", padding: "8px 6px" }}>{h}</div>
              ))}
            </div>
            {songs.map((s, i) => (
              <div
                key={s.key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 56px minmax(0,1fr) 100px 100px 100px 100px",
                  alignItems: "center",
                  padding: "4px 16px",
                  borderRadius: 8,
                  gap: 0,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "#000", fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{i + 1}</div>
                <div style={{ padding: "6px 6px" }}>
                  <Cover cover={s.cover} song={{ title: s.title, artist: canonicalArtist, album: canonicalAlbum, spotifyId: s.spotifyId ?? undefined }} size={44} rounded={8} />
                </div>
                <div style={{ padding: "0 12px", minWidth: 0 }}>
                  <Link
                    href={buildSongPath({ title: s.title, artist: canonicalArtist, id: s.spotifyId ? undefined : s.songId, slugArtist: s.dbArtist, spotifyId: s.spotifyId })}
                    style={{ display: "block", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", color: "inherit" }}
                  >
                    {s.title}
                  </Link>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{s.points}</div>
                <div style={{ fontSize: 14, color: "#86868B", fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{s.weeks}</div>
                <div style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", padding: "0 6px", display: "flex", alignItems: "center", gap: 4 }}>
                  {s.peak === 1 && <Star size={12} color="#FA243C" fill="#FA243C" />}
                  {s.peak > 0 ? `#${s.peak}` : "—"}
                </div>
                <div style={{ fontSize: 14, color: "#86868B", fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{s.number1s}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top fans */}
        {topFans.length > 0 && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 16 }}>Maiores fãs do álbum</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {topFans.map(({ user, points }) => (
                <Link key={user.id} href={`/profile/${user.handle}`} style={{ textDecoration: "none" }}>
                  <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 20, textAlign: "center" }}>
                    <Avatar user={user} imageUrl={user.image} size={56} />
                    <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: "#1D1D1F" }}>{user.name}</div>
                    <div style={{ fontSize: 12, color: "#86868B", marginBottom: 8 }}>@{user.handle}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B", marginBottom: 4 }}>Pontos no álbum</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: palette[0], fontVariantNumeric: "tabular-nums" }}>{points}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

import Link from "next/link";
import { ChevronLeft, Play, Star } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { Cover } from "@/components/ui/Cover";
import { Avatar } from "@/components/ui/Avatar";
import { parseSongSlug, buildArtistPath } from "@/lib/music-routes";
import type { ParsedSongSlug } from "@/lib/music-routes";

function pointsForPosition(position: number): number {
  return 101 - position;
}

function songKey(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}|${artist.trim().toLowerCase()}`;
}

function buildSongWhereFromSlug(parsed: ParsedSongSlug) {
  if (parsed.type === "spotify") return { song: { spotifyId: parsed.spotifyId } };
  return {
    song: {
      title: { equals: parsed.title, mode: "insensitive" as const },
      artist: { equals: parsed.artist, mode: "insensitive" as const },
    },
  };
}

export default async function SongPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = parseSongSlug(slug);
  if (!parsed) {
    return (
      <Shell title="Música" subtitle="Não encontrada">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>
          <p style={{ fontSize: 16, marginBottom: 20 }}>Não encontramos essa música.</p>
          <Link href="/discover" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
            ← Voltar para descobrir
          </Link>
        </div>
      </Shell>
    );
  }

  const entries = await prisma.chartEntry.findMany({
    where: {
      chart: { isPublished: true },
      ...buildSongWhereFromSlug(parsed),
    },
    select: {
      position: true,
      points: true,
      coverPaletteA: true,
      coverPaletteB: true,
      coverSeed: true,
      chart: { select: { weekIndex: true, userId: true } },
      song: { select: { title: true, artist: true, album: true, spotifyId: true, artistSpotifyId: true } },
    },
  });

  if (entries.length === 0) {
    return (
      <Shell title="Música" subtitle="Não encontrada">
        <div style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", color: "#86868B" }}>
          <p style={{ fontSize: 16, marginBottom: 20 }}>Não encontramos dados para essa música.</p>
          <Link href="/discover" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
            ← Voltar para descobrir
          </Link>
        </div>
      </Shell>
    );
  }

  const first = entries[0];
  const title = first.song.title;
  const artist = first.song.artist;
  const album = first.song.album ?? "";
  const spotifyId = first.song.spotifyId;
  const artistSpotifyId = first.song.artistSpotifyId;
  const totalPoints = entries.reduce((sum, e) => sum + (e.points > 0 ? e.points : pointsForPosition(e.position)), 0);
  const users = new Set(entries.map((e) => e.chart.userId)).size;
  const chartEntries = entries.length;
  const topUsersMap = new Map<
    string,
    {
      user: { id: string; handle: string; name: string; avatarColor: string; image: string | null };
      points: number;
    }
  >();
  for (const e of entries) {
    const pts = e.points > 0 ? e.points : pointsForPosition(e.position);
    const current = topUsersMap.get(e.chart.userId) ?? {
      user: {
        id: e.chart.userId,
        handle: "",
        name: "",
        avatarColor: "#FA243C",
        image: null,
      },
      points: 0,
    };
    current.points += pts;
    topUsersMap.set(e.chart.userId, current);
  }
  const topUsersIds = [...topUsersMap.keys()];
  const topUsersRows = topUsersIds.length
    ? await prisma.user.findMany({
        where: { id: { in: topUsersIds } },
        select: { id: true, handle: true, name: true, avatarColor: true, image: true },
      })
    : [];
  const topUsersById = new Map(topUsersRows.map((u) => [u.id, u]));
  const topUsers = [...topUsersMap.entries()]
    .map(([userId, row]) => {
      const user = topUsersById.get(userId);
      if (!user) return null;
      return { user, points: row.points };
    })
    .filter((row): row is { user: NonNullable<typeof topUsersRows[number]>; points: number } => Boolean(row))
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  const globalRows = await prisma.chartEntry.findMany({
    where: { chart: { isPublished: true } },
    select: {
      position: true,
      points: true,
      chart: { select: { weekIndex: true } },
      song: { select: { title: true, artist: true } },
    },
  });
  const targetKey = songKey(title, artist);
  const weeklyBuckets = new Map<number, Map<string, number>>();
  for (const row of globalRows) {
    const wk = row.chart.weekIndex;
    const key = songKey(row.song.title, row.song.artist);
    const pts = row.points > 0 ? row.points : pointsForPosition(row.position);
    const bySong = weeklyBuckets.get(wk) ?? new Map<string, number>();
    bySong.set(key, (bySong.get(key) ?? 0) + pts);
    weeklyBuckets.set(wk, bySong);
  }
  let weeksTop100 = 0;
  let peak = 9999;
  let number1s = 0;
  for (const [, bySong] of weeklyBuckets) {
    const top100 = [...bySong.entries()].sort((a, b) => b[1] - a[1]).slice(0, 100);
    const idx = top100.findIndex(([k]) => k === targetKey);
    if (idx >= 0) {
      const pos = idx + 1;
      weeksTop100 += 1;
      peak = Math.min(peak, pos);
      if (pos === 1) number1s += 1;
    }
  }

  return (
    <Shell title="" noPadding>
      <div style={{ padding: "48px 40px 40px 40px" }}>
        <Link href="/discover" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#86868B", fontSize: 14, fontWeight: 500, textDecoration: "none", marginBottom: 24 }}>
          <ChevronLeft size={16} />
          Voltar
        </Link>
        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <Cover
            cover={{ palette: [first.coverPaletteA, first.coverPaletteB], seed: first.coverSeed }}
            song={{ title, artist, album, spotifyId: spotifyId ?? undefined }}
            size={180}
            rounded={14}
          />
          <div style={{ minWidth: 280 }}>
            <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05 }}>{title}</div>
            <Link href={buildArtistPath(artist, artistSpotifyId)} style={{ display: "inline-block", marginTop: 8, fontSize: 16, fontWeight: 600, color: "#1D1D1F", textDecoration: "none" }}>
              {artist}
            </Link>
            {album && <div style={{ fontSize: 14, color: "#86868B", marginTop: 6 }}>{album}</div>}
            {spotifyId && (
              <a
                href={`https://open.spotify.com/track/${spotifyId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 8, background: "#1DB954", color: "white", textDecoration: "none", borderRadius: 100, padding: "10px 18px", fontSize: 14, fontWeight: 700 }}
              >
                <Play size={14} fill="white" />
                Ouvir
              </a>
            )}
          </div>
        </div>

        <div style={{ marginTop: 30, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {[
            { label: "Pontos totais", value: totalPoints },
            { label: "Usuários únicos", value: users },
            { label: "Semanas no Top 100", value: weeksTop100 },
            { label: "#1s no Top 100", value: number1s },
          ].map((s) => (
            <div key={s.label} style={{ background: "white", borderRadius: 16, border: "1px solid rgba(0,0,0,0.06)", padding: 16 }}>
              <div style={{ fontSize: 11, color: "#86868B", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{s.label}</div>
              <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, background: "white", borderRadius: 16, border: "1px solid rgba(0,0,0,0.06)", padding: 16 }}>
          <div style={{ fontSize: 12, color: "#86868B", marginBottom: 6 }}>Pico no Global Top 100</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 28, fontWeight: 800 }}>
            {peak === 1 && <Star size={18} color="#FA243C" fill="#FA243C" />}
            {peak === 9999 ? "—" : `#${peak}`}
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 14 }}>Top 5 usuários da música</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            {topUsers.map((row) => (
              <Link key={row.user.id} href={`/profile/${row.user.handle}`} style={{ textDecoration: "none" }}>
                <div style={{ background: "white", borderRadius: 14, border: "1px solid rgba(0,0,0,0.06)", padding: 14, textAlign: "center" }}>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <Avatar
                      user={{ name: row.user.name, avatar: row.user.avatarColor }}
                      imageUrl={row.user.image}
                      size={52}
                    />
                  </div>
                  <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: "#1D1D1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.user.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#86868B" }}>@{row.user.handle}</div>
                  <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: "#FA243C" }}>{row.points} pts</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 24, fontSize: 13, color: "#86868B" }}>
          Entradas em paradas de usuários: {chartEntries}
        </div>
      </div>
    </Shell>
  );
}

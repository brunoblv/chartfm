import Link from "next/link";
import { ChevronLeft, Play, Star } from "lucide-react";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth-options";
import { Shell } from "@/components/layout/Shell";
import { Cover } from "@/components/ui/Cover";
import { Avatar } from "@/components/ui/Avatar";
import { isPrivilegedRole } from "@/lib/permissions";
import { parseSongSlug, buildArtistPath } from "@/lib/music-routes";
import { resolveSongIdFromParsed } from "@/lib/resolve-song-id";
import { formatChartPeriod } from "@/lib/chart-week";

function pointsForPosition(position: number): number {
  return 101 - position;
}

function songKey(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}|${artist.trim().toLowerCase()}`;
}

/** Apenas o intervalo de datas (sem o sufixo "Semana …"). */
function chartDateRangeOnly(chart: { weekLabel: string; dateRange: string }): string {
  const full = formatChartPeriod(chart);
  const marker = " - ";
  const cut = full.lastIndexOf(marker);
  return cut >= 0 ? full.slice(0, cut) : full;
}

export default async function SongPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getServerSession(authOptions);
  const me = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
    : null;
  const canEditSong = isPrivilegedRole(me?.role);
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

  const songId = await resolveSongIdFromParsed(parsed);
  if (!songId) {
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

  const entries = await prisma.chartEntry.findMany({
    where: {
      chart: { isPublished: true },
      songId,
    },
    select: {
      position: true,
      points: true,
      status: true,
      coverPaletteA: true,
      coverPaletteB: true,
      coverSeed: true,
      chart: {
        select: {
          id: true,
          weekIndex: true,
          userId: true,
          weekLabel: true,
          dateRange: true,
        },
      },
      song: {
        select: {
          title: true,
          artist: true,
          album: true,
          coverImageUrl: true,
          albumRef: { select: { coverUrl: true } },
          spotifyId: true,
          artistSpotifyId: true,
          artistRef: { select: { id: true } },
        },
      },
    },
  });

  const songRow =
    entries[0]?.song ??
    (await prisma.song.findUnique({
      where: { id: songId },
      select: {
        title: true,
        artist: true,
        album: true,
        coverImageUrl: true,
        albumRef: { select: { coverUrl: true } },
        spotifyId: true,
        artistSpotifyId: true,
        artistRef: { select: { id: true } },
      },
    }));

  if (!songRow) {
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
  const title = songRow.title;
  const artist = songRow.artist;
  const album = songRow.album ?? "";
  const spotifyId = songRow.spotifyId;
  const artistSpotifyId = songRow.artistSpotifyId;
  const artistDbId = songRow.artistRef?.id ?? null;
  const coverImageUrl = songRow.albumRef?.coverUrl?.trim() || songRow.coverImageUrl?.trim() || null;
  const paletteA = first?.coverPaletteA ?? "#FA243C";
  const paletteB = first?.coverPaletteB ?? "#FFE66D";
  const coverSeed = first?.coverSeed ?? 0;
  const totalPoints = entries.reduce((sum, e) => sum + (e.points > 0 ? e.points : pointsForPosition(e.position)), 0);
  const hasChartPresence = entries.length > 0;
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

  const currentUserId = session?.user?.id ?? null;
  const myEntries = currentUserId ? entries.filter((e) => e.chart.userId === currentUserId) : [];

  const myAppearancesSorted = [...myEntries]
    .sort((a, b) => a.chart.weekIndex - b.chart.weekIndex)
    .map((e) => ({
      chartId: e.chart.id,
      position: e.position,
      dateRange: chartDateRangeOnly({ weekLabel: e.chart.weekLabel, dateRange: e.chart.dateRange }),
      year: Math.floor(e.chart.weekIndex / 100),
    }));

  return (
    <Shell title="" noPadding>
      <div style={{ padding: "48px 40px 40px 40px" }}>
        <Link href="/discover" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#86868B", fontSize: 14, fontWeight: 500, textDecoration: "none", marginBottom: 24 }}>
          <ChevronLeft size={16} />
          Voltar
        </Link>
        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <Cover
            cover={{
              palette: [paletteA, paletteB],
              seed: coverSeed,
              imageUrl: coverImageUrl,
            }}
            song={{
              title,
              artist,
              album,
              spotifyId: spotifyId ?? undefined,
              imageUrl: coverImageUrl,
            }}
            size={180}
            rounded={14}
          />
          <div style={{ minWidth: 280 }}>
            <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05 }}>{title}</div>
            <Link href={buildArtistPath(artist, artistSpotifyId, artistDbId)} style={{ display: "inline-block", marginTop: 8, fontSize: 16, fontWeight: 600, color: "#1D1D1F", textDecoration: "none" }}>
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
            {canEditSong && (
              <div style={{ marginTop: 10 }}>
                <Link href={`/song/${slug}/edit`} style={{ fontSize: 13, fontWeight: 700, color: "#FA243C", textDecoration: "none" }}>
                  Editar música
                </Link>
              </div>
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

        {!currentUserId && (
          <div style={{ marginTop: 20, padding: 16, background: "white", borderRadius: 16, border: "1px solid rgba(0,0,0,0.06)", fontSize: 14, color: "#86868B", lineHeight: 1.5 }}>
            <span style={{ color: "#1D1D1F", fontWeight: 600 }}>Suas paradas com esta música</span>
            {" — "}
            entre na sua conta para ver posição, datas e ano em cada semana em que você publicou esta faixa.
          </div>
        )}

        {currentUserId && myAppearancesSorted.length > 0 && (
          <div style={{ marginTop: 20, background: "white", borderRadius: 16, border: "1px solid rgba(0,0,0,0.06)", padding: 18 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>Nas suas paradas</h2>
            <p style={{ fontSize: 13, color: "#86868B", marginBottom: 14, lineHeight: 1.45 }}>
              Cada linha é uma semana em que a música apareceu na sua parada publicada: posição na lista, intervalo da semana e ano.
            </p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 0 }}>
              {myAppearancesSorted.map((row, i) => {
                const last = i === myAppearancesSorted.length - 1;
                return (
                  <li
                    key={row.chartId}
                    style={{
                      fontSize: 14,
                      lineHeight: 1.45,
                      paddingBottom: last ? 0 : 12,
                      borderBottom: last ? "none" : "1px solid rgba(0,0,0,0.06)",
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "8px 14px" }}>
                      <span style={{ fontWeight: 700, color: "#FA243C", fontVariantNumeric: "tabular-nums" }}>#{row.position}</span>
                      <span style={{ fontWeight: 600, color: "#1D1D1F" }}>{row.dateRange}</span>
                      <span style={{ fontSize: 13, color: "#86868B", fontVariantNumeric: "tabular-nums" }}>{row.year}</span>
                      <Link href={`/chart/${row.chartId}`} style={{ fontSize: 12, fontWeight: 600, color: "#FA243C", textDecoration: "none" }}>
                        Ver parada →
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {currentUserId && myAppearancesSorted.length === 0 && (
          <div style={{ marginTop: 20, padding: 16, background: "rgba(0,0,0,0.04)", borderRadius: 12, fontSize: 14, color: "#86868B", lineHeight: 1.5 }}>
            Esta música ainda não aparece em nenhuma das suas paradas publicadas. Quando você votar com ela, aparecerá aqui a posição, a data e o ano de cada semana.
          </div>
        )}

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

        {!hasChartPresence && (
          <div style={{ marginTop: 20, padding: 14, background: "rgba(0,0,0,0.04)", borderRadius: 12, fontSize: 14, color: "#86868B" }}>
            Esta faixa ainda não aparece em nenhuma parada publicada. Os números abaixo ficam zerados até alguém votar com ela.
          </div>
        )}
        <div style={{ marginTop: 24, fontSize: 13, color: "#86868B" }}>
          Entradas em paradas de usuários: {chartEntries}
        </div>
      </div>
    </Shell>
  );
}

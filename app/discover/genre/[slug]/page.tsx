import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { prisma } from "@/lib/prisma";
import { buildArtistPath, buildSongPath } from "@/lib/music-routes";
import { getRankingWeekReference } from "@/lib/chart-week";

const GENRES = [
  { slug: "pop", name: "Pop", tags: ["pop"] },
  { slug: "hip-hop-rap", name: "Hip-Hop/Rap", tags: ["hip hop", "rap", "trap"] },
  { slug: "sertanejo", name: "Sertanejo", tags: ["sertanejo"] },
  { slug: "rnb-soul", name: "R&B/Soul", tags: ["r&b", "soul", "neo soul"] },
  { slug: "indie-alt", name: "Indie/Alt", tags: ["indie", "alternative", "alt"] },
  { slug: "funk", name: "Funk", tags: ["funk"] },
  { slug: "eletronica", name: "Eletronica", tags: ["electronic", "dance", "house", "techno", "edm", "eletronica", "eletronic"] },
  { slug: "k-pop", name: "K-Pop", tags: ["k-pop", "kpop"] },
] as const;

function pointsForPosition(position: number) {
  return 101 - position;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeArtistName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function matchesGenre(artistGenres: string[], artistName: string, genreTags: readonly string[]) {
  const normalizedTags = genreTags.map((tag) => normalizeText(tag));
  const normalizedArtistGenres = artistGenres.map((genre) => normalizeText(genre));
  if (normalizedArtistGenres.some((genre) => normalizedTags.some((tag) => genre.includes(tag)))) return true;
  const normalizedName = normalizeText(artistName);
  return normalizedTags.some((tag) => normalizedName.includes(tag));
}

export default async function DiscoverGenrePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const selectedGenre = GENRES.find((genre) => genre.slug === slug);
  if (!selectedGenre) notFound();

  const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const rankingWeek = getRankingWeekReference(nowBRT);

  const weeklyEntries = await prisma.chartEntry.findMany({
    where: { chart: { weekIndex: rankingWeek.weekIndex, isPublished: true } },
    select: {
      position: true,
      chart: { select: { userId: true } },
      song: {
        select: {
          title: true,
          artist: true,
          spotifyId: true,
          artistSpotifyId: true,
          artistRef: { select: { id: true, spotifyId: true, name: true, genres: true } },
        },
      },
    },
  });

  const bySong = new Map<
    string,
    {
      title: string;
      artist: string;
      slugArtist: string;
      spotifyId: string | null;
      artistSpotifyId: string | null;
      artistRefId: number | null;
      points: number;
      users: Set<string>;
    }
  >();

  for (const row of weeklyEntries) {
    const artistName = normalizeArtistName(row.song.artistRef?.name || row.song.artist);
    const artistGenres = row.song.artistRef?.genres ?? [];
    if (!matchesGenre(artistGenres, artistName, selectedGenre.tags)) continue;

    const title = row.song.title.trim();
    const key = `${title.toLowerCase()}|${artistName.toLowerCase()}`;
    const current = bySong.get(key) ?? {
      title,
      artist: artistName,
      slugArtist: row.song.artist.trim(),
      spotifyId: row.song.spotifyId ?? null,
      artistSpotifyId: row.song.artistSpotifyId ?? row.song.artistRef?.spotifyId ?? null,
      artistRefId: row.song.artistRef?.id ?? null,
      points: 0,
      users: new Set<string>(),
    };
    current.points += pointsForPosition(row.position);
    current.users.add(row.chart.userId);
    bySong.set(key, current);
  }

  const songs = [...bySong.values()]
    .sort((a, b) => b.points - a.points || b.users.size - a.users.size || a.title.localeCompare(b.title, "pt-BR"))
    .slice(0, 100);

  return (
    <Shell title={`${selectedGenre.name}`} subtitle={`Músicas do gênero • ${rankingWeek.weekLabel}`}>
      <section style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", margin: 0 }}>
            Lista de músicas de {selectedGenre.name}
          </h2>
          <Link href="/discover" style={{ fontSize: 13, fontWeight: 600, color: "#FA243C", textDecoration: "none" }}>
            ← Voltar para descobrir
          </Link>
        </div>
      </section>

      {songs.length === 0 ? (
        <div style={{ fontSize: 14, color: "#86868B" }}>
          Ainda não há músicas desse gênero nas paradas da semana.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {songs.map((song, idx) => (
            <div
              key={`${song.title}-${song.artist}-${idx}`}
              style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr auto auto",
                alignItems: "center",
                gap: 10,
                background: "white",
                border: "1px solid rgba(0,0,0,0.06)",
                borderRadius: 12,
                padding: "12px 14px",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "#86868B" }}>#{idx + 1}</div>
              <div style={{ minWidth: 0 }}>
                <Link
                  href={buildSongPath({ title: song.title, artist: song.artist, slugArtist: song.slugArtist, spotifyId: song.spotifyId })}
                  style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#1D1D1F", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {song.title}
                </Link>
                <Link
                  href={buildArtistPath(song.artist, song.artistSpotifyId, song.artistRefId)}
                  style={{ display: "block", fontSize: 12, color: "#86868B", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}
                >
                  {song.artist}
                </Link>
              </div>
              <div style={{ fontSize: 12, color: "#86868B", fontWeight: 600 }}>{song.users.size} usuários</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#FA243C" }}>{song.points} pts</div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

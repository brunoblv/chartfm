import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { getRankingWeekReference } from "@/lib/chart-week";
import { GlobalTabs } from "@/components/global/GlobalTabs";
import { getSpotifyArtistById, searchSpotifyArtist, spotifyConfigured } from "@/lib/spotify-server";
import { computeGlobalSnapshotData, getOrCreateRankingWeekSnapshot } from "@/lib/global-snapshot";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Parada Global | ChartFM",
  description: "A parada global semanal do ChartFM. Veja quais músicas e artistas são mais chartados pelos curadores da plataforma essa semana.",
};

type ArtistImageKey = { name: string; spotifyId: string | null };
type GlobalSongLike = Awaited<ReturnType<typeof computeGlobalSnapshotData>>["weeklySongs"][number];

function isMissingImageUrl(url: string | null | undefined): boolean {
  return url === undefined || url === null || url === "";
}

async function resolveArtistImages(artists: ArtistImageKey[]): Promise<Map<string, string | null>> {
  const imageMap = new Map<string, string | null>();

  const spotifyIds = [...new Set(artists.map((a) => a.spotifyId).filter((x): x is string => Boolean(x)))];
  if (spotifyIds.length) {
    const byId = await prisma.artist.findMany({
      where: { spotifyId: { in: spotifyIds } },
      select: { spotifyId: true, imageUrl: true },
    });
    const idToUrl = new Map(byId.map((r) => [r.spotifyId, r.imageUrl]));
    for (const a of artists) {
      if (!a.spotifyId) continue;
      const u = idToUrl.get(a.spotifyId);
      if (!isMissingImageUrl(u ?? undefined)) imageMap.set(a.name, u!);
    }
  }

  const names = [...new Set(artists.map((a) => a.name))];
  const byName = names.length
    ? await prisma.artist.findMany({
        where: { name: { in: names } },
        select: { name: true, imageUrl: true },
      })
    : [];
  const nameToUrl = new Map(byName.map((r) => [r.name, r.imageUrl]));

  for (const a of artists) {
    if (!isMissingImageUrl(imageMap.get(a.name))) continue;
    const fromName = nameToUrl.get(a.name);
    if (!isMissingImageUrl(fromName ?? undefined)) imageMap.set(a.name, fromName!);
  }

  for (const a of artists) {
    if (!imageMap.has(a.name)) imageMap.set(a.name, null);
  }

  if (!spotifyConfigured()) return imageMap;

  const missing = artists.filter((a) => isMissingImageUrl(imageMap.get(a.name)));
  const CHUNK = 10;
  for (let i = 0; i < missing.length; i += CHUNK) {
    await Promise.all(
      missing.slice(i, i + CHUNK).map(async (a) => {
        const fromId = a.spotifyId ? await getSpotifyArtistById(a.spotifyId) : null;
        const result = fromId ?? (await searchSpotifyArtist(a.name));
        const url = result?.imageUrl ?? null;
        imageMap.set(a.name, url);
        if (result) {
          await prisma.artist.upsert({
            where: { spotifyId: result.spotifyId },
            create: {
              spotifyId: result.spotifyId,
              name: result.name,
              genres: result.genres ?? [],
              imageUrl: result.imageUrl,
              spotifyUrl: result.spotifyUrl,
            },
            update: {
              name: result.name,
              genres: result.genres ?? [],
              spotifyUrl: result.spotifyUrl ?? undefined,
              ...(result.imageUrl ? { imageUrl: result.imageUrl } : {}),
            },
          });
        }
      })
    );
  }
  return imageMap;
}

async function hydrateSongCovers(entries: GlobalSongLike[]): Promise<GlobalSongLike[]> {
  if (!entries.length) return entries;
  const ids = [...new Set(entries.map((e) => e.song.id).filter((id): id is string => Boolean(id)))];
  const rows = await prisma.song.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      spotifyId: true,
      albumRef: { select: { coverUrl: true } },
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const bySpotifyId = new Map(rows.filter((r) => r.spotifyId).map((r) => [r.spotifyId as string, r]));

  return entries.map((entry) => {
    const refById = entry.song.id ? byId.get(entry.song.id) : undefined;
    const refBySpotifyId = entry.song.spotifyId ? bySpotifyId.get(entry.song.spotifyId) : undefined;
    const ref = refById ?? refBySpotifyId;
    const imageUrl = ref?.albumRef?.coverUrl?.trim() || null;
    return {
      ...entry,
      song: { ...entry.song, imageUrl },
      cover: { ...entry.cover, imageUrl },
    };
  });
}

type GlobalPageProps = {
  searchParams?: Promise<{ week?: string }> | { week?: string };
};

export default async function GlobalPage({ searchParams }: GlobalPageProps) {
  const params = searchParams
    ? ("then" in searchParams ? await searchParams : searchParams)
    : {};
  const requestedWeek = Number(params.week ?? "");
  const rankingWeek = getRankingWeekReference(new Date());
  const availableWeeks = await prisma.chart.findMany({
    where: { weekIndex: { lte: rankingWeek.weekIndex } },
    select: { weekIndex: true, weekLabel: true, dateRange: true },
    distinct: ["weekIndex"],
    orderBy: { weekIndex: "desc" },
  });
  const availableWeekIndexes = availableWeeks.map((w) => w.weekIndex);
  const weekIndex =
    Number.isFinite(requestedWeek) && availableWeekIndexes.includes(requestedWeek)
      ? requestedWeek
      : availableWeekIndexes[0] ?? rankingWeek.weekIndex;
  const currentMeta = availableWeeks.find((w) => w.weekIndex === weekIndex);

  const snapshotRow = await prisma.globalSnapshot.findUnique({ where: { weekIndex } });
  const snapshot = snapshotRow
    ? {
        weekIndex,
        weekLabel: snapshotRow.weekLabel,
        dateRange: snapshotRow.dateRange,
        payload: {
          weeklySongs: snapshotRow.weeklySongs as unknown as Awaited<ReturnType<typeof getOrCreateRankingWeekSnapshot>>["payload"]["weeklySongs"],
          weeklyArtists: snapshotRow.weeklyArtists as unknown as Awaited<ReturnType<typeof getOrCreateRankingWeekSnapshot>>["payload"]["weeklyArtists"],
          overallSongs: snapshotRow.overallSongs as unknown as Awaited<ReturnType<typeof getOrCreateRankingWeekSnapshot>>["payload"]["overallSongs"],
          overallArtists: snapshotRow.overallArtists as unknown as Awaited<ReturnType<typeof getOrCreateRankingWeekSnapshot>>["payload"]["overallArtists"],
        },
      }
    : {
        weekIndex,
        weekLabel: currentMeta?.weekLabel ?? rankingWeek.weekLabel,
        dateRange: currentMeta?.dateRange ?? rankingWeek.dateRange,
        payload: await computeGlobalSnapshotData(weekIndex),
      };
  const weekNow = snapshot.weekLabel;
  const weekRangeNow = snapshot.dateRange;
  const globalSongs = await hydrateSongCovers(snapshot.payload.weeklySongs);
  const overallSongs = await hydrateSongCovers(snapshot.payload.overallSongs);
  const topArtists = snapshot.payload.weeklyArtists;
  const topArtistsOverall = snapshot.payload.overallArtists;
  const uniqueParadas = await prisma.chart.count({ where: { weekIndex } });
  const currentIndexInList = availableWeekIndexes.indexOf(weekIndex);
  const newerWeek = currentIndexInList > 0 ? availableWeekIndexes[currentIndexInList - 1] : null;
  const olderWeek =
    currentIndexInList >= 0 && currentIndexInList < availableWeekIndexes.length - 1
      ? availableWeekIndexes[currentIndexInList + 1]
      : null;
  const imageMap = await resolveArtistImages(
    [...topArtists, ...topArtistsOverall].map((a) => ({ name: a.name, spotifyId: a.spotifyId }))
  );
  const topArtistsWithImages = topArtists.map((a) => ({
    ...a,
    imageUrl: imageMap.get(a.name) ?? null,
  }));
  const topArtistsOverallWithImages = topArtistsOverall.map((a) => ({
    ...a,
    imageUrl: imageMap.get(a.name) ?? null,
  }));

  return (
    <Shell title="Parada Global">
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        <p style={{ fontSize: 15, color: "var(--text-muted)", letterSpacing: "-0.01em", margin: 0 }}>
          A Parada Global é o reflexo do que a comunidade do ChartFM está ouvindo em conjunto. Todas as paradas pessoais dos usuários são combinadas para formar um ranking coletivo que destaca as músicas, artistas e álbuns mais populares da plataforma a cada semana.
        </p>
        <p style={{ fontSize: 15, color: "var(--text-muted)", letterSpacing: "-0.01em", margin: 0 }}>
          Inspirada nas grandes charts musicais, a Parada Global transforma gostos individuais em uma visão ampla do que está movimentando a comunidade naquele momento. Cada posição é construída a partir das escolhas reais dos usuários, criando uma experiência dinâmica onde novos lançamentos, hits virais, clássicos revisitados e descobertas inesperadas podem disputar espaço lado a lado.
        </p>
        <p style={{ fontSize: 15, color: "var(--text-muted)", letterSpacing: "-0.01em", margin: 0 }}>
          Acompanhe a evolução das músicas ao longo das semanas, veja quais artistas estão dominando o ranking e descubra tendências que surgem organicamente dentro da comunidade. A Parada Global é o ponto de encontro entre fãs de música, charts e cultura pop.
        </p>
      </div>
      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, #1D1D1F 0%, #2C2C2E 100%)",
        borderRadius: 20,
        padding: "48px 48px",
        marginBottom: 40,
        display: "flex",
        gap: 40,
        alignItems: "center",
        color: "white",
      }}>
        <div style={{
          width: 140, height: 140, borderRadius: 20, flexShrink: 0,
          background: "radial-gradient(circle at 30% 30%, #FA243C, #FF5858)",
          boxShadow: "0 16px 40px rgba(250,36,60,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.7, marginBottom: 8 }}>{weekNow}</div>
          <h1 style={{ fontSize: 64, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 12 }}>Parada Global</h1>
          <p style={{ fontSize: 15, opacity: 0.8, maxWidth: 480, lineHeight: 1.6, marginBottom: 16 }}>
            Cada música ganha <strong>101 − posição</strong> pontos por parada em que aparece. A soma decide o ranking semanal global.
          </p>
          <div style={{ display: "flex", gap: 20, fontSize: 14, opacity: 0.7 }}>
            <span>{uniqueParadas} paradas consideradas</span>
            <span>·</span>
            <span>{globalSongs.length} músicas</span>
            <span>·</span>
            <span>{weekRangeNow}</span>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            {olderWeek ? (
              <Link
                href={`/global?week=${olderWeek}`}
                style={{
                  border: "1px solid rgba(255,255,255,0.25)",
                  color: "white",
                  padding: "8px 14px",
                  borderRadius: 10,
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                ← Semana anterior
              </Link>
            ) : (
              <span style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)", padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
                ← Semana anterior
              </span>
            )}
            {newerWeek ? (
              <Link
                href={`/global?week=${newerWeek}`}
                style={{
                  border: "1px solid rgba(255,255,255,0.25)",
                  color: "white",
                  padding: "8px 14px",
                  borderRadius: 10,
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Próxima semana →
              </Link>
            ) : (
              <span style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)", padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
                Próxima semana →
              </span>
            )}
          </div>
        </div>
      </div>

      <GlobalTabs
        weeklySongs={globalSongs}
        weeklyArtists={topArtistsWithImages}
        overallSongs={overallSongs}
        overallArtists={topArtistsOverallWithImages}
      />
    </Shell>
  );
}

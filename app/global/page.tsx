import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { getRankingWeekReference } from "@/lib/chart-week";
import { GlobalTabs } from "@/components/global/GlobalTabs";
import { getSpotifyArtistById, searchSpotifyArtist, spotifyConfigured } from "@/lib/spotify-server";
import { getOrCreateRankingWeekSnapshot } from "@/lib/global-snapshot";

type ArtistImageKey = { name: string; spotifyId: string | null };

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
              imageUrl: result.imageUrl,
              spotifyUrl: result.spotifyUrl,
            },
            update: {
              name: result.name,
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

export default async function GlobalPage() {
  const rankingWeek = getRankingWeekReference(new Date());
  const weekNow = rankingWeek.weekLabel;
  const weekRangeNow = rankingWeek.dateRange;
  const snapshot = await getOrCreateRankingWeekSnapshot(new Date());
  const globalSongs = snapshot.payload.weeklySongs;
  const overallSongs = snapshot.payload.overallSongs;
  const topArtists = snapshot.payload.weeklyArtists;
  const topArtistsOverall = snapshot.payload.overallArtists;
  const uniqueParadas = await prisma.chart.count({ where: { weekIndex: rankingWeek.weekIndex } });
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
    <Shell title="Parada Global" subtitle="A parada agregada de toda a plataforma">
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

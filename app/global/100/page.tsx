import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { getRankingWeekReference } from "@/lib/chart-week";
import { GlobalTabs } from "@/components/global/GlobalTabs";
import { AdSlot } from "@/components/ui/AdSlot";
import type { GlobalSnapshotPayload } from "@/lib/global-snapshot";
import { loadCoverUrlsForSongIds } from "@/lib/chart-entry-cover";
import { BookOpen, BarChart2, Users, TrendingUp, Music, ChevronLeft, Youtube } from "lucide-react";
import { GlobalHero } from "@/components/global/GlobalHero";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("global.metaTitle"),
    description: t("global.metaDescription"),
    alternates: { canonical: "/global/100" },
  };
}

type ArtistImageKey = { name: string; spotifyId: string | null };
type GlobalSongLike = GlobalSnapshotPayload["weeklySongs"][number];

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

  return imageMap;
}

async function hydrateSongCovers(entries: GlobalSongLike[]): Promise<GlobalSongLike[]> {
  if (!entries.length) return entries;

  const songIds = [
    ...new Set(entries.map((e) => e.song.id).filter((id): id is string => Boolean(id))),
  ];
  const coverBySongId = songIds.length > 0 ? await loadCoverUrlsForSongIds(prisma, songIds) : new Map();

  return entries.map((entry) => {
    const id = entry.song.id;
    const imageUrl =
      (id ? coverBySongId.get(id) ?? null : null) ||
      entry.song.imageUrl?.trim() ||
      entry.cover.imageUrl?.trim() ||
      null;
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

export default async function Global100Page({ searchParams }: GlobalPageProps) {
  const { t } = await getServerTranslations();
  const params = searchParams
    ? ("then" in searchParams ? await searchParams : searchParams)
    : {};
  const requestedWeek = Number(params.week ?? "");
  const rankingWeek = getRankingWeekReference(new Date());
  const availableSnapshots = await prisma.globalSnapshot.findMany({
    where: { weekIndex: { lte: rankingWeek.weekIndex } },
    select: { weekIndex: true, weekLabel: true, dateRange: true },
    orderBy: { weekIndex: "desc" },
  });
  const availableWeekIndexes = availableSnapshots.map((w) => w.weekIndex);
  const weekIndex =
    Number.isFinite(requestedWeek) && availableWeekIndexes.includes(requestedWeek)
      ? requestedWeek
      : availableWeekIndexes[0] ?? rankingWeek.weekIndex;
  const currentMeta = availableSnapshots.find((w) => w.weekIndex === weekIndex) ?? null;

  const snapshotRow = await prisma.globalSnapshot.findUnique({ where: { weekIndex } });
  const youtubePlaylistId = snapshotRow?.youtubePlaylistId ?? null;
  const snapshot = {
    weekIndex,
    weekLabel: snapshotRow?.weekLabel ?? currentMeta?.weekLabel ?? rankingWeek.weekLabel,
    dateRange: snapshotRow?.dateRange ?? currentMeta?.dateRange ?? rankingWeek.dateRange,
    payload: {
      weeklySongs: (snapshotRow?.weeklySongs as GlobalSnapshotPayload["weeklySongs"] | undefined) ?? [],
      weeklyArtists: (snapshotRow?.weeklyArtists as GlobalSnapshotPayload["weeklyArtists"] | undefined) ?? [],
      overallSongs: (snapshotRow?.overallSongs as GlobalSnapshotPayload["overallSongs"] | undefined) ?? [],
      overallArtists: (snapshotRow?.overallArtists as GlobalSnapshotPayload["overallArtists"] | undefined) ?? [],
    },
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
  const prevSnapshotRow = olderWeek
    ? await prisma.globalSnapshot.findUnique({ where: { weekIndex: olderWeek } })
    : null;
  const prevWeeklySongs = prevSnapshotRow
    ? (prevSnapshotRow.weeklySongs as unknown as typeof globalSongs)
    : [];

  function songKey(song: { spotifyId?: string | null; title: string; artist: string }): string {
    if (song.spotifyId) return `spotify:${song.spotifyId}`;
    return `local:${song.title.trim().toLowerCase()}|${song.artist.trim().toLowerCase()}`;
  }
  const currentKeySet = new Set(globalSongs.map((s) => songKey(s.song)));
  const weeklyDropoutsRaw = prevWeeklySongs.filter((s) => !currentKeySet.has(songKey(s.song)));
  const weeklyDropouts = await hydrateSongCovers(weeklyDropoutsRaw);

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

  const FAQ_GLOBAL = [
    {
      q: "O que é o Global 100?",
      a: "É a parada coletiva do ChartFM: as músicas mais populares da semana, com base nas paradas pessoais publicadas pelos usuários.",
    },
    {
      q: "Com que frequência a parada é atualizada?",
      a: "O Global 100 é consolidado toda segunda-feira às 01h00 (horário de Brasília), refletindo as charts publicadas pelos usuários durante a semana anterior. O histórico de semanas anteriores também está disponível para consulta.",
    },
    {
      q: "Como participar da parada global?",
      a: "Basta criar uma conta no ChartFM e publicar sua parada pessoal semanal. Assim que você submete sua chart, as músicas escolhidas entram automaticamente no cálculo do ranking global daquela semana.",
    },
    {
      q: "As charts pessoais influenciam o ranking?",
      a: "Sim, diretamente. Cada parada publicada por um usuário contribui para o Global 100. Quanto mais fãs de música incluem uma música em suas charts, maior o impacto dela no ranking coletivo. É a democracia musical em ação.",
    },
    {
      q: "A parada global é igual às charts de streaming?",
      a: "Não. O Global 100 do ChartFM não mede reproduções automáticas nem algoritmos de plataformas. Cada entrada representa uma escolha deliberada e intencional de um usuário real. Isso torna o ranking mais representativo do gosto musical genuíno da comunidade.",
    },
  ];

  return (
    <Shell title="Global 100" subtitle={t("global.subtitle")}>
      <Link
        href="/global"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 24,
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-muted)",
          textDecoration: "none",
        }}
      >
        <ChevronLeft size={16} />
        Todas as paradas globais
      </Link>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 8 }}>
          Sobre a parada
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16 }}>
          {[
            { icon: <Music size={20} />, title: "Curadoria da comunidade", desc: "Cada música entra porque alguém escolheu colocá-la na própria parada." },
            { icon: <Users size={20} />, title: "Mais fãs de música, mais força", desc: "Quanto mais usuários incluem uma música, maior sua presença no ranking." },
            { icon: <BarChart2 size={20} />, title: "Atualizado toda semana", desc: "A consolidação ocorre toda segunda-feira com base nas paradas da semana anterior." },
            { icon: <TrendingUp size={20} />, title: "Histórico preservado", desc: "Cada semana gera um snapshot permanente para consulta histórica." },
          ].map((item) => (
            <div key={item.title} style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 14, padding: "18px 20px" }}>
              <div style={{ color: "#FA243C", marginBottom: 10 }}>{item.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <GlobalHero
        title="Global 100"
        pointsRule={t("global.pointsRule")}
        basePath="/global/100"
        weekNow={weekNow}
        weekRangeNow={weekRangeNow}
        statPrimaryLabel={t("global.chartsCount", { count: uniqueParadas })}
        songsCount={globalSongs.length}
        olderWeek={olderWeek}
        newerWeek={newerWeek}
      />

      {youtubePlaylistId && (
        <div style={{ marginBottom: 24 }}>
          <a
            href={`https://www.youtube.com/playlist?list=${youtubePlaylistId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#FF0000",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: 100,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
              boxShadow: "0 2px 8px rgba(255,0,0,0.30)",
            }}
          >
            <Youtube size={16} fill="white" />
            Ouvir no YouTube
          </a>
        </div>
      )}

      <section style={{ marginBottom: 52 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 8 }}>
          Rankings da semana {weekNow}
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
          Rankings consolidados com base em {uniqueParadas} paradas pessoais publicadas na semana {weekRangeNow}.
        </p>
        <AdSlot slotId="COLE_AQUI_SLOT_ID_3" format="rectangle" style={{ margin: "0 0 28px 0" }} />

        <GlobalTabs
          weeklySongs={globalSongs}
          weeklyArtists={topArtistsWithImages}
          overallSongs={overallSongs}
          overallArtists={topArtistsOverallWithImages}
          weeklyDropouts={weeklyDropouts}
        />
      </section>

      <section style={{ borderTop: "1px solid var(--divider)", paddingTop: 40, maxWidth: 820 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
          <BookOpen size={18} color="#FA243C" />
          Perguntas frequentes sobre o Global 100
        </h2>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {FAQ_GLOBAL.map((item, i) => (
            <div
              key={item.q}
              style={{
                borderTop: i === 0 ? "1px solid var(--divider)" : "none",
                borderBottom: "1px solid var(--divider)",
                padding: "20px 0",
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{item.q}</div>
              <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.75, margin: 0 }}>{item.a}</p>
            </div>
          ))}
        </div>
      </section>
    </Shell>
  );
}
